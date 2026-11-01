-- Restore the original fixed amortization amounts without changing recorded
-- payments, due dates, or ledger history.
DO $$
DECLARE
  v_loan public.loans%ROWTYPE;
  v_item RECORD;
  v_balance NUMERIC;
  v_payment NUMERIC;
  v_principal_due NUMERIC;
  v_interest_due NUMERIC;
BEGIN
  FOR v_loan IN
    SELECT * FROM public.loans ORDER BY id
  LOOP
    v_balance := v_loan.principal;

    IF v_loan.repayment_style = 'LUMP_SUM' THEN
      UPDATE public.schedule_items
      SET principal_due = v_loan.principal,
          interest_due = ROUND(v_loan.principal * v_loan.monthly_rate * v_loan.term_months, 2),
          status = CASE
            WHEN principal_paid >= v_loan.principal
             AND interest_paid >= ROUND(v_loan.principal * v_loan.monthly_rate * v_loan.term_months, 2) THEN 'paid'
            WHEN principal_paid > 0 OR interest_paid > 0 THEN 'partial'
            WHEN status = 'overdue' THEN 'overdue'
            ELSE 'pending'
          END
      WHERE loan_id = v_loan.id;
      CONTINUE;
    END IF;

    IF v_loan.repayment_style = 'EQUAL_PAYMENT' THEN
      IF v_loan.monthly_rate = 0 THEN
        v_payment := v_loan.principal / v_loan.term_months;
      ELSE
        v_payment := ROUND(
          v_loan.principal * v_loan.monthly_rate /
          (1 - POWER(1 + v_loan.monthly_rate, -v_loan.term_months)),
          2
        );
      END IF;
    END IF;

    FOR v_item IN
      SELECT id, installment_no, principal_paid, interest_paid, status
      FROM public.schedule_items
      WHERE loan_id = v_loan.id
      ORDER BY installment_no
    LOOP
      v_interest_due := ROUND(v_loan.monthly_rate * v_balance, 2);

      IF v_loan.repayment_style = 'EQUAL_PRINCIPAL' THEN
        v_principal_due := v_loan.principal / v_loan.term_months;
      ELSE
        v_principal_due := v_payment - v_interest_due;
      END IF;

      UPDATE public.schedule_items
      SET principal_due = v_principal_due,
          interest_due = v_interest_due,
          status = CASE
            WHEN COALESCE(v_item.principal_paid, 0) >= v_principal_due
             AND COALESCE(v_item.interest_paid, 0) >= v_interest_due THEN 'paid'
            WHEN COALESCE(v_item.principal_paid, 0) > 0
              OR COALESCE(v_item.interest_paid, 0) > 0 THEN 'partial'
            WHEN v_item.status = 'overdue' THEN 'overdue'
            ELSE 'pending'
          END
      WHERE id = v_item.id;

      v_balance := v_balance - v_principal_due;
    END LOOP;
  END LOOP;
END;
$$;

-- Restore fixed schedule payment allocation. Future installments no longer
-- get re-amortized when a principal payment is posted.
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
  v_allocated NUMERIC;
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

  SELECT principal INTO v_balance
  FROM public.loans
  WHERE id = p_loan_id
  FOR UPDATE;
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Loan not found';
  END IF;
  v_balance := v_balance - COALESCE((
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

    UPDATE public.schedule_items
    SET principal_paid = LEAST(principal_due, principal_paid + v_allocated),
        status = CASE
          WHEN LEAST(principal_due, principal_paid + v_allocated) >= principal_due
           AND interest_paid >= interest_due THEN 'paid'
          ELSE 'partial'
        END
    WHERE id = (
      SELECT id FROM public.schedule_items
      WHERE loan_id = p_loan_id AND status <> 'paid'
      ORDER BY due_date ASC, installment_no ASC
      LIMIT 1
    );
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
      SELECT id FROM public.schedule_items
      WHERE loan_id = p_loan_id AND status <> 'paid'
      ORDER BY due_date ASC, installment_no ASC
      LIMIT 1
    );
  ELSE
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
DROP FUNCTION IF EXISTS public.recalculate_future_loan_schedule(UUID, INTEGER, NUMERIC, NUMERIC);
NOTIFY pgrst, 'reload schema';
