CREATE OR REPLACE FUNCTION public.is_active_staff_session()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'active'
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_staff_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_staff_session() TO authenticated;

ALTER VIEW public.v_active_loans SET (security_invoker = true);
ALTER VIEW public.v_outstanding_principal SET (security_invoker = true);
ALTER VIEW public.v_overdue_loans SET (security_invoker = true);
ALTER VIEW public.v_aging_buckets SET (security_invoker = true);
ALTER VIEW public.v_portfolio_at_risk SET (security_invoker = true);
ALTER VIEW public.v_pending_applications SET (security_invoker = true);
ALTER VIEW public.v_disbursed_month SET (security_invoker = true);
ALTER VIEW public.v_collected_month SET (security_invoker = true);
ALTER VIEW public.v_interest_earned_month SET (security_invoker = true);
ALTER VIEW public.v_expected_interest_30days SET (security_invoker = true);
ALTER VIEW public.v_approval_rate SET (security_invoker = true);
ALTER VIEW public.v_write_offs SET (security_invoker = true);
ALTER VIEW public.v_repeat_borrowers SET (security_invoker = true);
ALTER VIEW public.v_due_this_week SET (security_invoker = true);
ALTER VIEW public.v_penalty_collected_month SET (security_invoker = true);

-- Restrictive policies combine with each table's existing permissions, so an
-- authenticated user with an inactive profile cannot continue using a valid JWT.
DROP POLICY IF EXISTS "Active staff sessions only" ON public.profiles;
CREATE POLICY "Active staff sessions only" ON public.profiles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff_session())
  WITH CHECK (public.is_active_staff_session());
DROP POLICY IF EXISTS "Active staff sessions only" ON public.settings;
CREATE POLICY "Active staff sessions only" ON public.settings
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff_session())
  WITH CHECK (public.is_active_staff_session());
DROP POLICY IF EXISTS "Active staff sessions only" ON public.audit_logs;
CREATE POLICY "Active staff sessions only" ON public.audit_logs
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff_session())
  WITH CHECK (public.is_active_staff_session());
DROP POLICY IF EXISTS "Active staff sessions only" ON public.borrowers;
CREATE POLICY "Active staff sessions only" ON public.borrowers
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff_session())
  WITH CHECK (public.is_active_staff_session());
DROP POLICY IF EXISTS "Active staff sessions only" ON public.documents;
CREATE POLICY "Active staff sessions only" ON public.documents
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff_session())
  WITH CHECK (public.is_active_staff_session());
DROP POLICY IF EXISTS "Active staff sessions only" ON public.applications;
CREATE POLICY "Active staff sessions only" ON public.applications
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff_session())
  WITH CHECK (public.is_active_staff_session());
DROP POLICY IF EXISTS "Active staff sessions only" ON public.loans;
CREATE POLICY "Active staff sessions only" ON public.loans
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff_session())
  WITH CHECK (public.is_active_staff_session());
DROP POLICY IF EXISTS "Active staff sessions only" ON public.schedule_items;
CREATE POLICY "Active staff sessions only" ON public.schedule_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff_session())
  WITH CHECK (public.is_active_staff_session());
DROP POLICY IF EXISTS "Active staff sessions only" ON public.ledger_entries;
CREATE POLICY "Active staff sessions only" ON public.ledger_entries
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff_session())
  WITH CHECK (public.is_active_staff_session());
DROP POLICY IF EXISTS "Active staff sessions only" ON public.payments;
CREATE POLICY "Active staff sessions only" ON public.payments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff_session())
  WITH CHECK (public.is_active_staff_session());
DROP POLICY IF EXISTS "Active staff sessions only" ON public.penalties_fees;
CREATE POLICY "Active staff sessions only" ON public.penalties_fees
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff_session())
  WITH CHECK (public.is_active_staff_session());
DROP POLICY IF EXISTS "Active staff sessions only" ON public.collection_notes;
CREATE POLICY "Active staff sessions only" ON public.collection_notes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff_session())
  WITH CHECK (public.is_active_staff_session());
