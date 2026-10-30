ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS submission_source TEXT NOT NULL DEFAULT 'admin';

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS possible_duplicate BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_submission_source_check;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_submission_source_check
  CHECK (submission_source IN ('admin', 'online'));

CREATE TABLE IF NOT EXISTS public.public_application_rate_limits (
  ip_hash TEXT PRIMARY KEY CHECK (ip_hash ~ '^[a-f0-9]{64}$'),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submission_count INTEGER NOT NULL DEFAULT 1 CHECK (submission_count > 0)
);

ALTER TABLE public.public_application_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_application_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.public_application_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.submit_public_application(
  p_full_name TEXT,
  p_birth_date DATE,
  p_phone TEXT,
  p_address TEXT,
  p_employer TEXT,
  p_monthly_income NUMERIC,
  p_id_type TEXT,
  p_id_number TEXT,
  p_amount NUMERIC,
  p_term_months INTEGER,
  p_purpose TEXT,
  p_repayment_style TEXT,
  p_submission_fingerprint TEXT
)
RETURNS TABLE(application_reference TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_started_at TIMESTAMPTZ;
  v_submission_count INTEGER;
  v_borrower_id UUID;
  v_application_id UUID;
  v_possible_duplicate BOOLEAN;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized public application submission';
  END IF;

  IF p_submission_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid submission fingerprint';
  END IF;
  IF NULLIF(BTRIM(p_full_name), '') IS NULL
    OR LENGTH(BTRIM(p_full_name)) < 2
    OR LENGTH(BTRIM(p_full_name)) > 150
    OR NULLIF(BTRIM(p_phone), '') IS NULL
    OR LENGTH(BTRIM(p_phone)) > 24
    OR LENGTH(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 7
    OR NULLIF(BTRIM(p_address), '') IS NULL
    OR LENGTH(BTRIM(p_address)) > 300
    OR p_birth_date IS NULL
    OR p_birth_date >= CURRENT_DATE
    OR p_amount IS NULL OR p_amount <= 0 OR p_amount > 999999999999.99
    OR p_term_months IS NULL OR p_term_months < 1 OR p_term_months > 120
    OR NULLIF(BTRIM(p_purpose), '') IS NULL
    OR LENGTH(BTRIM(p_purpose)) > 500
    OR p_repayment_style IS NULL
    OR p_repayment_style NOT IN ('EQUAL_PRINCIPAL', 'EQUAL_PAYMENT', 'LUMP_SUM')
    OR (p_monthly_income IS NOT NULL AND (p_monthly_income < 0 OR p_monthly_income > 999999999999.99)) THEN
    RAISE EXCEPTION 'Invalid application details';
  END IF;

  INSERT INTO public.public_application_rate_limits (ip_hash)
  VALUES (p_submission_fingerprint)
  ON CONFLICT (ip_hash) DO NOTHING;

  SELECT window_started_at, submission_count
  INTO v_window_started_at, v_submission_count
  FROM public.public_application_rate_limits
  WHERE ip_hash = p_submission_fingerprint
  FOR UPDATE;

  IF v_window_started_at < NOW() - INTERVAL '1 hour' THEN
    UPDATE public.public_application_rate_limits
    SET window_started_at = NOW(), submission_count = 1
    WHERE ip_hash = p_submission_fingerprint;
  ELSIF v_submission_count >= 5 THEN
    RAISE EXCEPTION 'Application submission rate limit exceeded';
  ELSE
    UPDATE public.public_application_rate_limits
    SET submission_count = submission_count + 1
    WHERE ip_hash = p_submission_fingerprint;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.borrowers AS existing
    WHERE regexp_replace(existing.phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
       OR (
         NULLIF(BTRIM(p_id_number), '') IS NOT NULL
         AND UPPER(BTRIM(existing.id_number)) = UPPER(BTRIM(p_id_number))
       )
       OR (
         LOWER(BTRIM(existing.full_name)) = LOWER(BTRIM(p_full_name))
         AND existing.birth_date = p_birth_date
       )
  ) INTO v_possible_duplicate;

  INSERT INTO public.borrowers (
    full_name, birth_date, phone, address, employer, monthly_income,
    id_type, id_number, created_by
  ) VALUES (
    BTRIM(p_full_name), p_birth_date, BTRIM(p_phone), BTRIM(p_address),
    NULLIF(BTRIM(p_employer), ''), p_monthly_income,
    NULLIF(BTRIM(p_id_type), ''), NULLIF(BTRIM(p_id_number), ''), NULL
  ) RETURNING id INTO v_borrower_id;

  INSERT INTO public.applications (
    borrower_id, amount, borrowed_date, term_months, purpose,
    repayment_style, status, created_by, submission_source, possible_duplicate
  ) VALUES (
    v_borrower_id, p_amount, CURRENT_DATE, p_term_months, BTRIM(p_purpose),
    p_repayment_style, 'in_review', NULL, 'online', v_possible_duplicate
  ) RETURNING id INTO v_application_id;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, after_data)
  VALUES (
    NULL,
    'public_application_submitted',
    'application',
    v_application_id,
    jsonb_build_object(
      'submission_source', 'online',
      'possible_duplicate', v_possible_duplicate,
      'amount', p_amount,
      'term_months', p_term_months,
      'status', 'in_review'
    )
  );

  RETURN QUERY SELECT 'MB-' || UPPER(SUBSTRING(REPLACE(v_application_id::TEXT, '-', '') FROM 1 FOR 8));
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_application(
  TEXT, DATE, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, INTEGER, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_application(
  TEXT, DATE, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, INTEGER, TEXT, TEXT, TEXT
) TO service_role;

NOTIFY pgrst, 'reload schema';
