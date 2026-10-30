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

  -- Derive principal from all posted principal entries. Several payments can
  -- share the same received_at timestamp, so the last balance_after row is
  -- not a reliable source of the current balance.
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
      WHERE loan_id = p_loan_id AND status != 'paid'
      ORDER BY due_date ASC LIMIT 1
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
      WHERE loan_id = p_loan_id AND status != 'paid'
      ORDER BY due_date ASC LIMIT 1
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
NOTIFY pgrst, 'reload schema';
