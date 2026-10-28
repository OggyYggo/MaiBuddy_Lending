CREATE OR REPLACE FUNCTION public.record_loan_disbursement(
  p_loan_id UUID,
  p_disbursed_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan public.loans%ROWTYPE;
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

  IF v_loan.status NOT IN ('pending_disbursement', 'active') THEN
    RAISE EXCEPTION 'Only pending or active loans can be disbursed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ledger_entries
    WHERE loan_id = p_loan_id AND type = 'disbursement'
  ) THEN
    INSERT INTO public.ledger_entries (
      loan_id, type, amount, balance_after, created_at
    ) VALUES (
      p_loan_id, 'disbursement', v_loan.principal, v_loan.principal,
      COALESCE(p_disbursed_at, NOW())
    );
  END IF;

  UPDATE public.loans
  SET status = 'active',
      disbursed_at = COALESCE(disbursed_at, p_disbursed_at, NOW()),
      updated_at = NOW()
  WHERE id = p_loan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_loan_disbursement(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_loan_disbursement(UUID, TIMESTAMPTZ) TO authenticated;

NOTIFY pgrst, 'reload schema';
