ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_repayment_style_check;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_repayment_style_check
  CHECK (repayment_style IN ('EQUAL_PRINCIPAL', 'EQUAL_PAYMENT', 'LUMP_SUM'));

ALTER TABLE public.loans
  DROP CONSTRAINT IF EXISTS loans_repayment_style_check;
ALTER TABLE public.loans
  ADD CONSTRAINT loans_repayment_style_check
  CHECK (repayment_style IN ('EQUAL_PRINCIPAL', 'EQUAL_PAYMENT', 'LUMP_SUM'));

CREATE OR REPLACE FUNCTION public.set_application_schedule_due_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_borrowed_date DATE;
  v_style TEXT;
  v_term_months INTEGER;
  v_month_offset INTEGER;
BEGIN
  SELECT a.borrowed_date, l.repayment_style, l.term_months
  INTO v_borrowed_date, v_style, v_term_months
  FROM public.loans l
  JOIN public.applications a ON a.id = l.application_id
  WHERE l.id = NEW.loan_id;
  IF v_borrowed_date IS NULL THEN RETURN NEW; END IF;
  v_month_offset := CASE WHEN v_style = 'LUMP_SUM' THEN v_term_months ELSE NEW.installment_no END;
  NEW.due_date := (v_borrowed_date + MAKE_INTERVAL(months => v_month_offset))::DATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_application_schedule_due_date ON public.schedule_items;
CREATE TRIGGER set_application_schedule_due_date
BEFORE INSERT OR UPDATE OF due_date, installment_no ON public.schedule_items
FOR EACH ROW EXECUTE FUNCTION public.set_application_schedule_due_date();

-- Keep the public intake validator aligned with the repayment styles above.
DO $$
DECLARE
  v_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.submit_public_application(text,date,text,text,text,numeric,text,text,numeric,integer,text,text,text)'::regprocedure
  ) INTO v_definition;
  v_definition := replace(
    v_definition,
    'p_repayment_style NOT IN (''EQUAL_PRINCIPAL'', ''EQUAL_PAYMENT'')',
    'p_repayment_style NOT IN (''EQUAL_PRINCIPAL'', ''EQUAL_PAYMENT'', ''LUMP_SUM'')'
  );
  EXECUTE v_definition;
END;
$$;

-- Keep pending loan edits and their generated schedules compatible with Lump Sum.
DO $$
DECLARE
  v_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.update_pending_loan(uuid,numeric,numeric,integer,text)'::regprocedure
  ) INTO v_definition;
  v_definition := replace(
    v_definition,
    'p_repayment_style NOT IN (''EQUAL_PRINCIPAL'', ''EQUAL_PAYMENT'')',
    'p_repayment_style NOT IN (''EQUAL_PRINCIPAL'', ''EQUAL_PAYMENT'', ''LUMP_SUM'')'
  );
  v_definition := replace(
    v_definition,
    'SELECT COALESCE((MIN(due_date) - INTERVAL ''1 month'')::DATE, CURRENT_DATE)
  INTO v_start_date
  FROM public.schedule_items
  WHERE loan_id = p_loan_id;',
    'SELECT COALESCE(MAX(a.borrowed_date), CURRENT_DATE)
  INTO v_start_date
  FROM public.schedule_items si
  LEFT JOIN public.applications a ON a.id = v_loan.application_id
  WHERE si.loan_id = p_loan_id;'
  );
  v_definition := replace(
    v_definition,
    'IF p_repayment_style = ''EQUAL_PRINCIPAL'' THEN',
    'IF p_repayment_style = ''LUMP_SUM'' THEN
    v_interest_due := ROUND(p_monthly_rate * p_principal * p_term_months, 2);
    INSERT INTO public.schedule_items (
      loan_id, installment_no, due_date, principal_due, interest_due,
      principal_paid, interest_paid, status
    ) VALUES (
      p_loan_id, 1, v_start_date + (p_term_months || '' months'')::INTERVAL,
      p_principal, v_interest_due, 0, 0, ''pending''
    );
  ELSIF p_repayment_style = ''EQUAL_PRINCIPAL'' THEN'
  );
  EXECUTE v_definition;
END;
$$;

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

  IF v_start_date IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF p_term_months < 1 OR p_principal <= 0 OR p_monthly_rate < 0 OR p_monthly_rate > 1 THEN
    RAISE EXCEPTION 'Invalid loan terms';
  END IF;
  IF p_repayment_style NOT IN ('EQUAL_PRINCIPAL', 'EQUAL_PAYMENT', 'LUMP_SUM') THEN
    RAISE EXCEPTION 'Invalid repayment style';
  END IF;

  v_maturity_date := (v_start_date + (p_term_months || ' months')::INTERVAL)::DATE;
  INSERT INTO public.loans (
    application_id, borrower_id, principal, monthly_rate, term_months,
    repayment_style, maturity_date, status
  ) VALUES (
    p_application_id, p_borrower_id, p_principal, p_monthly_rate, p_term_months,
    p_repayment_style, v_maturity_date, 'pending_disbursement'
  ) RETURNING id INTO v_loan_id;

  IF p_repayment_style = 'LUMP_SUM' THEN
    v_interest_due := ROUND(p_principal * p_monthly_rate * p_term_months, 2);
    INSERT INTO public.schedule_items (
      loan_id, installment_no, due_date, principal_due, interest_due,
      principal_paid, interest_paid, status
    ) VALUES (
      v_loan_id, 1, v_maturity_date, p_principal, v_interest_due, 0, 0, 'pending'
    );
  ELSIF p_repayment_style = 'EQUAL_PRINCIPAL' THEN
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
  ELSE
    IF p_monthly_rate = 0 THEN
      v_payment := p_principal / p_term_months;
    ELSE
      v_payment := ROUND(p_principal * p_monthly_rate / (1 - POWER(1 + p_monthly_rate, -p_term_months)), 2);
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
  END IF;
  RETURN v_loan_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_application_and_create_loan(
  p_application_id UUID,
  p_monthly_rate NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application public.applications%ROWTYPE;
  v_loan_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Active staff profile required';
  END IF;
  SELECT * INTO v_application
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF v_application.status NOT IN ('draft', 'in_review') THEN
    RAISE EXCEPTION 'Only draft or in-review applications can be approved';
  END IF;
  IF EXISTS (SELECT 1 FROM public.loans WHERE application_id = p_application_id) THEN
    RAISE EXCEPTION 'A loan already exists for this application';
  END IF;

  v_loan_id := public.create_loan(
    v_application.id, v_application.borrower_id, v_application.amount,
    p_monthly_rate, v_application.term_months, v_application.repayment_style
  );
  UPDATE public.applications
  SET status = 'approved', decided_by = auth.uid(), decision_at = NOW(), updated_at = NOW()
  WHERE id = p_application_id;
  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, before_data, after_data)
  VALUES (
    auth.uid(), 'approve_application', 'application', p_application_id,
    jsonb_build_object('status', v_application.status),
    jsonb_build_object('status', 'approved', 'loan_id', v_loan_id)
  );
  RETURN v_loan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_application_and_create_loan(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_application_and_create_loan(UUID, NUMERIC) TO authenticated;
NOTIFY pgrst, 'reload schema';
