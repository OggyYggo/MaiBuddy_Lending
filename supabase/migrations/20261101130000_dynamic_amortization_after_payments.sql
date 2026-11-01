-- Re-amortize future installments from the actual principal balance after
-- every posted principal payment. Any unpaid principal from the current
-- installment is added to the next installment exactly once.
CREATE OR REPLACE FUNCTION public.recalculate_future_loan_schedule(
  p_loan_id UUID,
  p_after_installment INTEGER,
  p_outstanding_principal NUMERIC,
  p_unpaid_principal NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan public.loans%ROWTYPE;
  v_period_count INTEGER;
  v_remaining_periods INTEGER;
  v_base_balance NUMERIC;
  v_schedule_balance NUMERIC;
  v_base_payment NUMERIC;
  v_base_principal NUMERIC;
  v_principal_due NUMERIC;
  v_interest_due NUMERIC;
  v_carry_forward NUMERIC := 0;
  v_item RECORD;
BEGIN
  v_carry_forward := GREATEST(COALESCE(p_unpaid_principal, 0), 0);

  SELECT * INTO v_loan
  FROM public.loans
  WHERE id = p_loan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan not found';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_period_count
  FROM public.schedule_items
  WHERE loan_id = p_loan_id
    AND installment_no > p_after_installment
    AND status <> 'paid';

  IF v_period_count = 0 THEN
    RETURN;
  END IF;

  IF v_carry_forward > 0 THEN
    -- The arrears are moving to the next installment, so clear them from the
    -- current row to avoid counting the same principal due twice in the table.
    UPDATE public.schedule_items
    SET principal_due = principal_paid,
        status = 'partial'
    WHERE loan_id = p_loan_id
      AND installment_no = p_after_installment;
  END IF;

  -- Keep the current installment's unpaid principal earmarked for the next
  -- installment; spread the remaining balance over the rest of the term.
  v_base_balance := GREATEST(p_outstanding_principal - v_carry_forward, 0);
  v_schedule_balance := GREATEST(p_outstanding_principal, 0);
  v_remaining_periods := v_period_count;

  IF v_loan.repayment_style = 'EQUAL_PAYMENT' THEN
    IF v_loan.monthly_rate = 0 THEN
      v_base_payment := v_base_balance / v_period_count;
    ELSE
      v_base_payment := ROUND(
        v_base_balance * v_loan.monthly_rate /
        (1 - POWER(1 + v_loan.monthly_rate, -v_period_count)),
        2
      );
    END IF;
  END IF;

  FOR v_item IN
    SELECT id, installment_no, principal_paid, interest_paid
    FROM public.schedule_items
    WHERE loan_id = p_loan_id
      AND installment_no > p_after_installment
      AND status <> 'paid'
    ORDER BY installment_no ASC
  LOOP
    v_interest_due := ROUND(v_loan.monthly_rate * v_schedule_balance, 2);

    IF v_remaining_periods = 1 THEN
      v_base_principal := v_base_balance;
    ELSIF v_loan.repayment_style = 'EQUAL_PRINCIPAL' THEN
      v_base_principal := ROUND(v_base_balance / v_remaining_periods, 2);
    ELSIF v_loan.monthly_rate = 0 THEN
      v_base_principal := v_base_balance / v_remaining_periods;
    ELSE
      v_base_principal := v_base_payment - ROUND(v_loan.monthly_rate * v_base_balance, 2);
    END IF;

    v_principal_due := v_base_principal + v_carry_forward;

    UPDATE public.schedule_items
    SET principal_due = v_principal_due,
        interest_due = v_interest_due,
        status = CASE
          WHEN COALESCE(v_item.principal_paid, 0) >= v_principal_due
           AND COALESCE(v_item.interest_paid, 0) >= v_interest_due THEN 'paid'
          WHEN COALESCE(v_item.principal_paid, 0) > 0
            OR COALESCE(v_item.interest_paid, 0) > 0 THEN 'partial'
          ELSE 'pending'
        END
    WHERE id = v_item.id;

    -- Paid principal is already included in the ledger balance passed to this
    -- function, so project only the unpaid part when calculating later interest.
    v_schedule_balance := GREATEST(
      v_schedule_balance - GREATEST(v_principal_due - COALESCE(v_item.principal_paid, 0), 0),
      0
    );
    v_base_balance := GREATEST(v_base_balance - v_base_principal, 0);
    v_carry_forward := 0;
    v_remaining_periods := v_remaining_periods - 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_future_loan_schedule(UUID, INTEGER, NUMERIC, NUMERIC)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_payment(
  p_payment_id UUID,
  p_loan_id UUID,
  p_amount NUMERIC,
  p_received_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_payment public.payments%ROWTYPE;
  v_loan public.loans%ROWTYPE;
  v_allocated NUMERIC;
  v_schedule_id UUID;
  v_installment_no INTEGER;
  v_unpaid_principal NUMERIC := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id AND loan_id = p_loan_id AND status = 'pending'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending payment not found for this loan';
  END IF;
  IF p_amount <> v_payment.amount THEN
    RAISE EXCEPTION 'Payment amount does not match the pending payment';
  END IF;

  SELECT * INTO v_loan
  FROM public.loans
  WHERE id = p_loan_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan not found';
  END IF;

  -- Principal is derived from the immutable ledger, so duplicate timestamps
  -- cannot cause the balance to be read from the wrong ledger row.
  v_balance := v_loan.principal - COALESCE((
    SELECT SUM(amount)
    FROM public.ledger_entries
    WHERE loan_id = p_loan_id AND type = 'principal'
  ), 0);

  IF v_payment.payment_type = 'principal' THEN
    IF p_amount > v_balance THEN
      RAISE EXCEPTION 'Principal payment exceeds the remaining principal balance';
    END IF;

    v_allocated := p_amount;
    v_balance := v_balance - v_allocated;

    SELECT id, installment_no INTO v_schedule_id, v_installment_no
    FROM public.schedule_items
    WHERE loan_id = p_loan_id AND status <> 'paid'
    ORDER BY
      CASE WHEN due_date <= p_received_at::DATE THEN 0 ELSE 1 END,
      CASE WHEN due_date <= p_received_at::DATE THEN due_date END DESC,
      due_date ASC,
      installment_no ASC
    LIMIT 1;

    IF v_schedule_id IS NOT NULL THEN
      UPDATE public.schedule_items
      SET principal_paid = LEAST(principal_due, principal_paid + v_allocated),
          status = CASE
            WHEN LEAST(principal_due, principal_paid + v_allocated) >= principal_due
             AND interest_paid >= interest_due THEN 'paid'
            ELSE 'partial'
          END
      WHERE id = v_schedule_id;

      SELECT GREATEST(principal_due - principal_paid, 0)
      INTO v_unpaid_principal
      FROM public.schedule_items
      WHERE id = v_schedule_id;

      IF v_loan.repayment_style <> 'LUMP_SUM' THEN
        PERFORM public.recalculate_future_loan_schedule(
          p_loan_id,
          v_installment_no,
          v_balance,
          v_unpaid_principal
        );
      END IF;
    END IF;
  ELSIF v_payment.payment_type = 'interest' THEN
    v_allocated := p_amount;
    UPDATE public.schedule_items
    SET interest_paid = LEAST(interest_due, interest_paid + v_allocated),
        status = CASE
          WHEN principal_paid >= principal_due
           AND LEAST(interest_due, interest_paid + v_allocated) >= interest_due THEN 'paid'
          ELSE 'partial'
        END
    WHERE id = (
      SELECT id
      FROM public.schedule_items
      WHERE loan_id = p_loan_id AND status <> 'paid'
      ORDER BY
        CASE WHEN due_date <= p_received_at::DATE THEN 0 ELSE 1 END,
        CASE WHEN due_date <= p_received_at::DATE THEN due_date END DESC,
        due_date ASC,
        installment_no ASC
      LIMIT 1
    );
  ELSE
    -- Penalty payments remain separate from principal and schedule allocation.
    v_allocated := p_amount;
  END IF;

  INSERT INTO public.ledger_entries (loan_id, type, amount, balance_after, payment_id, created_at)
  VALUES (p_loan_id, v_payment.payment_type, v_allocated, v_balance, p_payment_id, p_received_at);

  IF v_payment.payment_type = 'principal' AND v_balance = 0 THEN
    UPDATE public.loans SET status = 'paid', updated_at = NOW() WHERE id = p_loan_id;
  END IF;

  UPDATE public.payments SET status = 'confirmed' WHERE id = p_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_payment(UUID, UUID, NUMERIC, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment(UUID, UUID, NUMERIC, TIMESTAMPTZ) TO authenticated;
NOTIFY pgrst, 'reload schema';
