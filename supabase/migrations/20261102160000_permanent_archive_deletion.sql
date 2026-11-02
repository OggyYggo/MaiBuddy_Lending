-- Allow active super admins to purge archived records without deleting
-- financial history or retaining personal data in the delete audit snapshot.
CREATE OR REPLACE FUNCTION public.audit_sensitive_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.archive_permanent_delete', true) = 'on' THEN
    INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, before_data)
    VALUES (
      auth.uid(), 'permanent_delete', TG_TABLE_NAME, OLD.id,
      jsonb_build_object('permanently_deleted', true)
    );
  ELSE
    INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, before_data)
    VALUES (auth.uid(), 'delete', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.permanently_delete_archived_application(p_application_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application public.applications%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only an active super admin can permanently delete archived records';
  END IF;

  SELECT * INTO v_application
  FROM public.applications
  WHERE id = p_application_id
    AND archived_at IS NOT NULL
    AND archive_parent_borrower_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Individually archived application not found';
  END IF;

  IF EXISTS (SELECT 1 FROM public.loans WHERE application_id = p_application_id)
     OR EXISTS (SELECT 1 FROM public.documents WHERE application_id = p_application_id) THEN
    RAISE EXCEPTION 'This application has linked loan or document records and cannot be permanently deleted';
  END IF;

  UPDATE public.audit_logs
  SET before_data = jsonb_build_object('personal_data_redacted', true),
      after_data = CASE WHEN after_data IS NULL THEN NULL
        ELSE jsonb_build_object('personal_data_redacted', true) END
  WHERE entity = 'applications' AND entity_id = p_application_id;

  PERFORM set_config('app.archive_permanent_delete', 'on', true);
  DELETE FROM public.applications WHERE id = p_application_id;
END;
$$;
REVOKE ALL ON FUNCTION public.permanently_delete_archived_application(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.permanently_delete_archived_application(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.permanently_delete_archived_borrower(p_borrower_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_borrower public.borrowers%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only an active super admin can permanently delete archived records';
  END IF;

  SELECT * INTO v_borrower
  FROM public.borrowers
  WHERE id = p_borrower_id AND archived_at IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Archived borrower not found';
  END IF;

  PERFORM a.id
  FROM public.applications a
  WHERE a.borrower_id = p_borrower_id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.applications
    WHERE borrower_id = p_borrower_id AND archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'All applications must be archived before permanently deleting this borrower';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.loans l
    WHERE l.borrower_id = p_borrower_id
       OR l.application_id IN (SELECT a.id FROM public.applications a WHERE a.borrower_id = p_borrower_id)
  ) THEN
    RAISE EXCEPTION 'This borrower has loan or financial history and cannot be permanently deleted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.borrower_id = p_borrower_id
       OR d.application_id IN (SELECT a.id FROM public.applications a WHERE a.borrower_id = p_borrower_id)
  ) THEN
    RAISE EXCEPTION 'This borrower has uploaded document records and cannot be permanently deleted';
  END IF;

  UPDATE public.audit_logs
  SET before_data = jsonb_build_object('personal_data_redacted', true),
      after_data = CASE WHEN after_data IS NULL THEN NULL
        ELSE jsonb_build_object('personal_data_redacted', true) END
  WHERE (entity = 'borrowers' AND entity_id = p_borrower_id)
     OR (entity = 'applications' AND entity_id IN (
       SELECT a.id FROM public.applications a WHERE a.borrower_id = p_borrower_id
     ));

  PERFORM set_config('app.archive_permanent_delete', 'on', true);
  DELETE FROM public.applications WHERE borrower_id = p_borrower_id;
  DELETE FROM public.borrowers WHERE id = p_borrower_id;
END;
$$;
REVOKE ALL ON FUNCTION public.permanently_delete_archived_borrower(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.permanently_delete_archived_borrower(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
