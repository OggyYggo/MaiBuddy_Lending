-- Introduce a narrowly assigned super-admin role for destructive record
-- management. Regular admins and loan officers retain their existing access.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'loan_officer', 'super_admin'));

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin' AND status = 'active'
  );
$$;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
CREATE OR REPLACE FUNCTION public.can_manage_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin') AND status = 'active');
$$;
REVOKE ALL ON FUNCTION public.can_manage_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_staff() TO authenticated;

-- Auth metadata is user controlled during signup, so never accept a role from it.
-- Staff role assignment happens through the protected super-admin flow.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Staff User'), 'loan_officer', 'active');
  RETURN NEW;
END;
$$;

-- Prevent self promotion through the original "update own profile" policy.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Only super admins can update staff profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update staff profiles" ON public.profiles;
CREATE POLICY "Admins can update staff profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.can_manage_staff())
  WITH CHECK (public.can_manage_staff());

CREATE OR REPLACE FUNCTION public.restrict_profile_role_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only an active super admin can change staff roles';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS restrict_profile_role_changes ON public.profiles;
CREATE TRIGGER restrict_profile_role_changes BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.restrict_profile_role_changes();

-- Deletes are limited to super admins and remain restricted to draft/in-review
-- applications. Loans and money history have no direct delete grant here.
DROP POLICY IF EXISTS "Borrowers are deletable by authenticated users" ON public.borrowers;
CREATE POLICY "Only super admins can delete borrowers"
  ON public.borrowers FOR DELETE TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "In-progress applications are deletable by authenticated users" ON public.applications;
CREATE POLICY "Only super admins can delete in-progress applications"
  ON public.applications FOR DELETE TO authenticated
  USING (public.is_super_admin() AND status IN ('draft', 'in_review'));

DROP POLICY IF EXISTS "Collection notes are deletable by authenticated users" ON public.collection_notes;
CREATE POLICY "Only super admins can delete collection notes"
  ON public.collection_notes FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- Delete snapshots are written in the same transaction as the deletion.
CREATE OR REPLACE FUNCTION public.audit_sensitive_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, before_data)
  VALUES (auth.uid(), 'delete', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS audit_borrower_delete ON public.borrowers;
CREATE TRIGGER audit_borrower_delete BEFORE DELETE ON public.borrowers
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_delete();
DROP TRIGGER IF EXISTS audit_application_delete ON public.applications;
CREATE TRIGGER audit_application_delete BEFORE DELETE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_delete();
DROP TRIGGER IF EXISTS audit_collection_note_delete ON public.collection_notes;
CREATE TRIGGER audit_collection_note_delete BEFORE DELETE ON public.collection_notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_delete();

-- Prevent removal of the last active super-admin account.
CREATE OR REPLACE FUNCTION public.protect_last_active_super_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'super_admin' AND OLD.status = 'active'
     AND (TG_OP = 'DELETE' OR NEW.role <> 'super_admin' OR NEW.status <> 'active')
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id <> OLD.id AND p.role = 'super_admin' AND p.status = 'active'
     ) THEN
    RAISE EXCEPTION 'Cannot deactivate or remove the last active super admin';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS protect_last_active_super_admin ON public.profiles;
CREATE TRIGGER protect_last_active_super_admin
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_active_super_admin();
