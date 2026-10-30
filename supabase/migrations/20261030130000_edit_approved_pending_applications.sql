CREATE OR REPLACE FUNCTION public.update_pending_application_and_loan(
  p_application_id UUID,
  p_borrower_id UUID,
  p_amount NUMERIC,
  p_borrowed_date DATE,
  p_term_months INTEGER,
  p_purpose TEXT,
  p_repayment_style TEXT,
  p_monthly_rate NUMERIC,
  p_custom_rate NUMERIC,
  p_rate_override_reason TEXT
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
  IF v_application.status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved applications can be edited with this action';
  END IF;
  IF p_borrowed_date IS NULL OR p_amount <= 0 OR p_monthly_rate < 0 OR p_monthly_rate > 1
    OR p_term_months < 1 OR p_term_months > 120
    OR p_repayment_style NOT IN ('EQUAL_PRINCIPAL', 'EQUAL_PAYMENT', 'LUMP_SUM') THEN
    RAISE EXCEPTION 'Invalid application or loan terms';
  END IF;

  SELECT id INTO v_loan_id
  FROM public.loans
  WHERE application_id = p_application_id
    AND status = 'pending_disbursement'
    AND disbursed_at IS NULL
  FOR UPDATE;
  IF v_loan_id IS NULL THEN
    RAISE EXCEPTION 'This application can only be edited while its loan is pending disbursement';
  END IF;

  UPDATE public.applications
  SET borrower_id = p_borrower_id,
      amount = p_amount,
      borrowed_date = p_borrowed_date,
      term_months = p_term_months,
      purpose = p_purpose,
      repayment_style = p_repayment_style,
      custom_rate = p_custom_rate,
      rate_override_reason = p_rate_override_reason,
      updated_at = NOW()
  WHERE id = p_application_id;

  UPDATE public.loans SET borrower_id = p_borrower_id WHERE id = v_loan_id;
  UPDATE public.documents
  SET borrower_id = p_borrower_id
  WHERE application_id = p_application_id;
  PERFORM public.update_pending_loan(
    v_loan_id, p_amount, p_monthly_rate, p_term_months, p_repayment_style
  );

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, before_data, after_data)
  VALUES (
    auth.uid(), 'edit_approved_application', 'application', p_application_id,
    jsonb_build_object(
      'borrower_id', v_application.borrower_id,
      'amount', v_application.amount,
      'borrowed_date', v_application.borrowed_date,
      'term_months', v_application.term_months,
      'purpose', v_application.purpose,
      'repayment_style', v_application.repayment_style
    ),
    jsonb_build_object(
      'borrower_id', p_borrower_id,
      'amount', p_amount,
      'borrowed_date', p_borrowed_date,
      'term_months', p_term_months,
      'purpose', p_purpose,
      'repayment_style', p_repayment_style,
      'loan_id', v_loan_id
    )
  );
  RETURN v_loan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_pending_application_and_loan(
  UUID, UUID, NUMERIC, DATE, INTEGER, TEXT, TEXT, NUMERIC, NUMERIC, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_pending_application_and_loan(
  UUID, UUID, NUMERIC, DATE, INTEGER, TEXT, TEXT, NUMERIC, NUMERIC, TEXT
) TO authenticated;

NOTIFY pgrst, 'reload schema';
