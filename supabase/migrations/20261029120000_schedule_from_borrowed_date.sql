CREATE OR REPLACE FUNCTION public.create_loan(
  p_application_id UUID,
  p_borrower_id UUID,
  p_principal NUMERIC,
  p_monthly_rate NUMERIC,
  p_term_months INTEGER,
  p_repayment_style TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan_id UUID;
  v_start_date DATE;
  v_balance NUMERIC := p_principal;
  v_payment NUMERIC;
  v_principal_due NUMERIC;
  v_interest_due NUMERIC;
  v_maturity_date DATE;
BEGIN
  SELECT COALESCE(borrowed_date, CURRENT_DATE)
  INTO v_start_date
  FROM public.applications
  WHERE id = p_application_id;

  IF v_start_date IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;
  IF p_term_months < 1 OR p_principal <= 0 OR p_monthly_rate < 0 THEN
    RAISE EXCEPTION 'Invalid loan terms';
  END IF;

  v_maturity_date := (v_start_date + (p_term_months || ' months')::INTERVAL)::DATE;

  INSERT INTO public.loans (
    application_id, borrower_id, principal, monthly_rate, term_months,
    repayment_style, maturity_date, status
  ) VALUES (
    p_application_id, p_borrower_id, p_principal, p_monthly_rate, p_term_months,
    p_repayment_style, v_maturity_date, 'pending_disbursement'
  ) RETURNING id INTO v_loan_id;

  IF p_repayment_style = 'EQUAL_PRINCIPAL' THEN
    v_principal_due := p_principal / p_term_months;
    FOR i IN 1..p_term_months LOOP
      v_interest_due := ROUND(p_monthly_rate * v_balance, 2);
      INSERT INTO public.schedule_items (
        loan_id, installment_no, due_date, principal_due, interest_due,
        principal_paid, interest_paid, status
      ) VALUES (
        v_loan_id, i,
        (v_start_date + (i || ' months')::INTERVAL)::DATE,
        v_principal_due, v_interest_due, 0, 0, 'pending'
      );
      v_balance := v_balance - v_principal_due;
    END LOOP;
  ELSIF p_repayment_style = 'EQUAL_PAYMENT' THEN
    IF p_monthly_rate = 0 THEN
      v_payment := p_principal / p_term_months;
    ELSE
      v_payment := ROUND(
        p_principal * p_monthly_rate /
        (1 - POWER(1 + p_monthly_rate, -p_term_months)), 2
      );
    END IF;
    FOR i IN 1..p_term_months LOOP
      v_interest_due := ROUND(p_monthly_rate * v_balance, 2);
      v_principal_due := v_payment - v_interest_due;
      INSERT INTO public.schedule_items (
        loan_id, installment_no, due_date, principal_due, interest_due,
        principal_paid, interest_paid, status
      ) VALUES (
        v_loan_id, i,
        (v_start_date + (i || ' months')::INTERVAL)::DATE,
        v_principal_due, v_interest_due, 0, 0, 'pending'
      );
      v_balance := v_balance - v_principal_due;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'Invalid repayment style';
  END IF;

  RETURN v_loan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_loan(UUID, UUID, NUMERIC, NUMERIC, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_loan(UUID, UUID, NUMERIC, NUMERIC, INTEGER, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
