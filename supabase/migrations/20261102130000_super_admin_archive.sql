ALTER TABLE public.borrowers
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS archive_parent_borrower_id UUID REFERENCES public.borrowers(id);

CREATE INDEX IF NOT EXISTS idx_borrowers_archived_at ON public.borrowers(archived_at);
CREATE INDEX IF NOT EXISTS idx_applications_archived_at ON public.applications(archived_at);

CREATE OR REPLACE VIEW public.v_pending_applications AS
SELECT COUNT(*) AS count
FROM public.applications
WHERE status IN ('draft', 'in_review') AND archived_at IS NULL;

DROP POLICY IF EXISTS "Only super admins can delete borrowers" ON public.borrowers;
DROP POLICY IF EXISTS "Borrowers are deletable by authenticated users" ON public.borrowers;
DROP POLICY IF EXISTS "Only super admins can delete in-progress applications" ON public.applications;
DROP POLICY IF EXISTS "In-progress applications are deletable by authenticated users" ON public.applications;

DROP POLICY IF EXISTS "Borrowers are viewable by authenticated users" ON public.borrowers;
CREATE POLICY "Active borrowers are viewable by authenticated users"
  ON public.borrowers FOR SELECT TO authenticated
  USING (archived_at IS NULL OR public.is_super_admin());

DROP POLICY IF EXISTS "Applications are viewable by authenticated users" ON public.applications;
CREATE POLICY "Active applications are viewable by authenticated users"
  ON public.applications FOR SELECT TO authenticated
  USING (archived_at IS NULL OR public.is_super_admin());

CREATE OR REPLACE FUNCTION public.protect_archive_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF ((to_jsonb(NEW)->>'archived_at') IS NOT NULL OR (to_jsonb(NEW)->>'archived_by') IS NOT NULL
        OR (to_jsonb(NEW)->>'archive_parent_borrower_id') IS NOT NULL)
       AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Only an active super admin can create archived records';
    END IF;
    RETURN NEW;
  END IF;

  IF ((to_jsonb(NEW)->'archived_at') IS DISTINCT FROM (to_jsonb(OLD)->'archived_at')
      OR (to_jsonb(NEW)->'archived_by') IS DISTINCT FROM (to_jsonb(OLD)->'archived_by')
      OR (to_jsonb(NEW)->'archive_parent_borrower_id') IS DISTINCT FROM (to_jsonb(OLD)->'archive_parent_borrower_id'))
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only an active super admin can archive or restore records';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_borrower_archive_fields ON public.borrowers;
CREATE TRIGGER protect_borrower_archive_fields
  BEFORE INSERT OR UPDATE ON public.borrowers
  FOR EACH ROW EXECUTE FUNCTION public.protect_archive_fields();
DROP TRIGGER IF EXISTS protect_application_archive_fields ON public.applications;
CREATE TRIGGER protect_application_archive_fields
  BEFORE INSERT OR UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.protect_archive_fields();

CREATE OR REPLACE FUNCTION public.archive_borrower_records(p_borrower_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archived_at TIMESTAMPTZ := now();
  v_borrower public.borrowers%ROWTYPE;
  v_application_count INTEGER;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only an active super admin can archive borrower records';
  END IF;

  SELECT * INTO v_borrower
  FROM public.borrowers
  WHERE id = p_borrower_id AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active borrower not found';
  END IF;

  UPDATE public.applications
  SET archived_at = v_archived_at, archived_by = auth.uid(),
      archive_parent_borrower_id = p_borrower_id, updated_at = v_archived_at
  WHERE borrower_id = p_borrower_id AND archived_at IS NULL;
  GET DIAGNOSTICS v_application_count = ROW_COUNT;

  UPDATE public.borrowers
  SET archived_at = v_archived_at, archived_by = auth.uid(), updated_at = v_archived_at
  WHERE id = p_borrower_id;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, before_data, after_data)
  VALUES (
    auth.uid(), 'archive', 'borrowers', p_borrower_id,
    jsonb_build_object('borrower', to_jsonb(v_borrower), 'application_count', v_application_count),
    jsonb_build_object('archived_at', v_archived_at, 'application_count', v_application_count)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.archive_borrower_records(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_borrower_records(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_borrower_records(p_borrower_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_borrower public.borrowers%ROWTYPE;
  v_application_count INTEGER;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only an active super admin can restore borrower records';
  END IF;

  SELECT * INTO v_borrower
  FROM public.borrowers
  WHERE id = p_borrower_id AND archived_at IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Archived borrower not found';
  END IF;

  UPDATE public.applications
  SET archived_at = NULL, archived_by = NULL, archive_parent_borrower_id = NULL, updated_at = now()
  WHERE archive_parent_borrower_id = p_borrower_id;
  GET DIAGNOSTICS v_application_count = ROW_COUNT;

  UPDATE public.borrowers
  SET archived_at = NULL, archived_by = NULL, updated_at = now()
  WHERE id = p_borrower_id;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, before_data, after_data)
  VALUES (
    auth.uid(), 'restore', 'borrowers', p_borrower_id,
    jsonb_build_object('archived_at', v_borrower.archived_at, 'application_count', v_application_count),
    jsonb_build_object('restored_at', now(), 'application_count', v_application_count)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.restore_borrower_records(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_borrower_records(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.archive_application_record(p_application_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application public.applications%ROWTYPE;
  v_archived_at TIMESTAMPTZ := now();
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only an active super admin can archive applications';
  END IF;

  SELECT * INTO v_application
  FROM public.applications
  WHERE id = p_application_id AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active application not found';
  END IF;

  UPDATE public.applications
  SET archived_at = v_archived_at, archived_by = auth.uid(), archive_parent_borrower_id = NULL,
      updated_at = v_archived_at
  WHERE id = p_application_id;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, before_data, after_data)
  VALUES (auth.uid(), 'archive', 'applications', p_application_id, to_jsonb(v_application),
    jsonb_build_object('archived_at', v_archived_at));
END;
$$;
REVOKE ALL ON FUNCTION public.archive_application_record(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_application_record(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_application_record(p_application_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application public.applications%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only an active super admin can restore applications';
  END IF;

  SELECT * INTO v_application
  FROM public.applications
  WHERE id = p_application_id AND archived_at IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Archived application not found';
  END IF;
  IF EXISTS (SELECT 1 FROM public.borrowers WHERE id = v_application.borrower_id AND archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Restore the borrower record before restoring this application';
  END IF;

  UPDATE public.applications
  SET archived_at = NULL, archived_by = NULL, archive_parent_borrower_id = NULL, updated_at = now()
  WHERE id = p_application_id;
  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, before_data, after_data)
  VALUES (auth.uid(), 'restore', 'applications', p_application_id,
    jsonb_build_object('archived_at', v_application.archived_at), jsonb_build_object('restored_at', now()));
END;
$$;
REVOKE ALL ON FUNCTION public.restore_application_record(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_application_record(UUID) TO authenticated;
