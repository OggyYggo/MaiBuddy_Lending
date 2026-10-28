-- Allow edits only for loans that have not been disbursed or posted to the ledger.
CREATE OR REPLACE FUNCTION public.update_pending_loan(
  p_loan_id UUID,
  p_principal NUMERIC,
  p_monthly_rate NUMERIC,
  p_term_months INTEGER,
  p_repayment_style TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan public.loans%ROWTYPE;
  v_start_date DATE;
  v_balance NUMERIC;
  v_payment NUMERIC;
  v_principal_due NUMERIC;
  v_interest_due NUMERIC;
  v_old_terms JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_loan
  FROM public.loans
  WHERE id = p_loan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan not found';
  END IF;
  IF v_loan.status <> 'pending_disbursement' OR v_loan.disbursed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Only loans pending disbursement can be edited';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ledger_entries WHERE loan_id = p_loan_id)
    OR EXISTS (SELECT 1 FROM public.payments WHERE loan_id = p_loan_id) THEN
    RAISE EXCEPTION 'Loan has financial activity and can no longer be edited';
  END IF;
  IF p_principal <= 0 OR p_monthly_rate < 0 OR p_monthly_rate > 1
    OR p_term_months < 1 OR p_term_months > 120
    OR p_repayment_style NOT IN ('EQUAL_PRINCIPAL', 'EQUAL_PAYMENT') THEN
    RAISE EXCEPTION 'Invalid loan terms';
  END IF;

  SELECT COALESCE((MIN(due_date) - INTERVAL '1 month')::DATE, CURRENT_DATE)
  INTO v_start_date
  FROM public.schedule_items
  WHERE loan_id = p_loan_id;

  v_old_terms := jsonb_build_object(
    'principal', v_loan.principal,
    'monthly_rate', v_loan.monthly_rate,
    'term_months', v_loan.term_months,
    'repayment_style', v_loan.repayment_style,
    'maturity_date', v_loan.maturity_date
  );

  DELETE FROM public.schedule_items WHERE loan_id = p_loan_id;

  UPDATE public.loans
  SET principal = p_principal,
      monthly_rate = p_monthly_rate,
      term_months = p_term_months,
      repayment_style = p_repayment_style,
      maturity_date = (v_start_date + (p_term_months || ' months')::INTERVAL)::DATE,
      updated_at = NOW()
  WHERE id = p_loan_id;

  v_balance := p_principal;
  IF p_repayment_style = 'EQUAL_PRINCIPAL' THEN
    v_principal_due := p_principal / p_term_months;
    FOR i IN 1..p_term_months LOOP
      v_interest_due := ROUND(p_monthly_rate * v_balance, 2);
      INSERT INTO public.schedule_items (
        loan_id, installment_no, due_date, principal_due, interest_due,
        principal_paid, interest_paid, status
      ) VALUES (
        p_loan_id, i, v_start_date + (i || ' months')::INTERVAL,
        v_principal_due, v_interest_due, 0, 0, 'pending'
      );
      v_balance := v_balance - v_principal_due;
    END LOOP;
  ELSE
    IF p_monthly_rate = 0 THEN
      v_payment := p_principal / p_term_months;
    ELSE
      v_payment := ROUND(
        p_principal * p_monthly_rate /
        (1 - POWER(1 + p_monthly_rate, -p_term_months)),
        2
      );
    END IF;

    FOR i IN 1..p_term_months LOOP
      v_interest_due := ROUND(p_monthly_rate * v_balance, 2);
      v_principal_due := v_payment - v_interest_due;
      INSERT INTO public.schedule_items (
        loan_id, installment_no, due_date, principal_due, interest_due,
        principal_paid, interest_paid, status
      ) VALUES (
        p_loan_id, i, v_start_date + (i || ' months')::INTERVAL,
        v_principal_due, v_interest_due, 0, 0, 'pending'
      );
      v_balance := v_balance - v_principal_due;
    END LOOP;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, before_data, after_data)
  VALUES (
    auth.uid(), 'update_pending_loan', 'loan', p_loan_id, v_old_terms,
    jsonb_build_object(
      'principal', p_principal,
      'monthly_rate', p_monthly_rate,
      'term_months', p_term_months,
      'repayment_style', p_repayment_style,
      'maturity_date', (v_start_date + (p_term_months || ' months')::INTERVAL)::DATE
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_pending_loan(UUID, NUMERIC, NUMERIC, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_pending_loan(UUID, NUMERIC, NUMERIC, INTEGER, TEXT) TO authenticated;

-- Pending payments may be voided with a required reason. Posted payments and
-- their ledger entries remain immutable and require a separate reversal process.
CREATE OR REPLACE FUNCTION public.void_pending_payment(
  p_payment_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NULLIF(BTRIM(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required to void a payment';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending payments can be voided';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ledger_entries WHERE payment_id = p_payment_id) THEN
    RAISE EXCEPTION 'Payment has ledger entries and cannot be voided';
  END IF;

  UPDATE public.payments SET status = 'rejected' WHERE id = p_payment_id;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, before_data, after_data)
  VALUES (
    auth.uid(), 'void_pending_payment', 'payment', p_payment_id,
    jsonb_build_object('status', v_payment.status),
    jsonb_build_object('status', 'rejected', 'reason', BTRIM(p_reason))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.void_pending_payment(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_pending_payment(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
