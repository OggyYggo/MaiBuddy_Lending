-- Loan creation must happen only inside the validated approval workflow.
-- approve_application_and_create_loan is SECURITY DEFINER and can still call
-- create_loan as its owner after this grant is removed from API roles.
REVOKE ALL ON FUNCTION public.create_loan(UUID, UUID, NUMERIC, NUMERIC, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
