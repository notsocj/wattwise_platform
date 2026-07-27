-- The original super-admin profiles policy queried profiles from inside its own
-- USING clause, which makes PostgREST fail with 42P17 infinite recursion.
DROP POLICY IF EXISTS "super_admin_select_profiles" ON public.profiles;
CREATE POLICY "super_admin_select_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (current_profile_role() = 'super_admin');

DROP POLICY IF EXISTS super_admin_select_admin_audit_logs ON public.admin_audit_logs;
CREATE POLICY super_admin_select_admin_audit_logs ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING (current_profile_role() = 'super_admin');
