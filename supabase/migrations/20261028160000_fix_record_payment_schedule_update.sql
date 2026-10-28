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
  v_remaining NUMERIC := p_amount;
  v_balance NUMERIC;
  v_penalties NUMERIC := 0;
  v_accrued_interest NUMERIC := 0;
  v_allocated NUMERIC;
  v_payment public.payments%ROWTYPE;
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

  SELECT COALESCE(SUM(amount), 0) INTO v_penalties
  FROM public.penalties_fees
  WHERE loan_id = p_loan_id AND waived_at IS NULL;

  SELECT COALESCE(SUM(interest_due - interest_paid), 0) INTO v_accrued_interest
  FROM public.schedule_items
  WHERE loan_id = p_loan_id AND due_date <= p_received_at AND status != 'paid';

  SELECT balance_after INTO v_balance
  FROM public.ledger_entries
  WHERE loan_id = p_loan_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_balance IS NULL THEN
    SELECT principal INTO v_balance
    FROM public.loans
    WHERE id = p_loan_id;
  END IF;
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Loan not found';
  END IF;

  IF v_penalties > 0 AND v_remaining > 0 THEN
    v_allocated := LEAST(v_remaining, v_penalties);
    INSERT INTO public.ledger_entries (loan_id, type, amount, balance_after, payment_id, created_at)
    VALUES (p_loan_id, 'penalty', v_allocated, v_balance, p_payment_id, p_received_at);
    v_remaining := v_remaining - v_allocated;
  END IF;

  IF v_accrued_interest > 0 AND v_remaining > 0 THEN
    v_allocated := LEAST(v_remaining, v_accrued_interest);
    INSERT INTO public.ledger_entries (loan_id, type, amount, balance_after, payment_id, created_at)
    VALUES (p_loan_id, 'interest', v_allocated, v_balance, p_payment_id, p_received_at);
    v_remaining := v_remaining - v_allocated;
  END IF;

  IF v_remaining > 0 THEN
    v_allocated := LEAST(v_remaining, v_balance);
    v_balance := v_balance - v_allocated;
    INSERT INTO public.ledger_entries (loan_id, type, amount, balance_after, payment_id, created_at)
    VALUES (p_loan_id, 'principal', v_allocated, v_balance, p_payment_id, p_received_at);

    UPDATE public.schedule_items
    SET principal_paid = principal_paid + (
          v_allocated * principal_due / NULLIF(principal_due + interest_due, 0)
        ),
        interest_paid = interest_paid + (
          v_allocated * interest_due / NULLIF(principal_due + interest_due, 0)
        ),
        status = CASE
          WHEN principal_paid + (
            v_allocated * principal_due / NULLIF(principal_due + interest_due, 0)
          ) >= principal_due
          AND interest_paid + (
            v_allocated * interest_due / NULLIF(principal_due + interest_due, 0)
          ) >= interest_due THEN 'paid'
          ELSE 'partial'
        END
    WHERE id = (
      SELECT id
      FROM public.schedule_items
      WHERE loan_id = p_loan_id AND status != 'paid'
      ORDER BY due_date ASC
      LIMIT 1
    );
  END IF;

  IF v_balance = 0 THEN
    UPDATE public.loans SET status = 'paid', updated_at = NOW() WHERE id = p_loan_id;
  END IF;

  UPDATE public.payments SET status = 'confirmed' WHERE id = p_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_payment(UUID, UUID, NUMERIC, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment(UUID, UUID, NUMERIC, TIMESTAMPTZ) TO authenticated;

NOTIFY pgrst, 'reload schema';
