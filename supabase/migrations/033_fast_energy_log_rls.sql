-- Make energy_logs row-level security cheap to evaluate.
--
-- The SELECT policies called current_profile_role() and ran a devices lookup
-- (itself under RLS) for every energy_logs row, and a leftover dashboard-made
-- policy added a third check. Reading ~1,200 rows took ~0.5 s per query and the
-- cost grows with every reading. This replaces the three SELECT policies with
-- one whose inputs are computed once per query:
--   * (SELECT current_profile_role()) becomes an InitPlan, not a per-row call;
--   * the caller's device keys come from one SECURITY DEFINER lookup, so the
--     check is a hashed IN-list instead of a per-row EXISTS.
-- Visibility is unchanged: super admins see all rows; everyone else sees rows
-- whose device_id is the id or MAC of a device they own, use, or rent.
-- The hardware INSERT policy is untouched.

CREATE OR REPLACE FUNCTION public.accessible_energy_log_device_keys()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT key
  FROM public.devices d
  CROSS JOIN LATERAL (VALUES (d.id::text), (d.mac_address)) AS keys(key)
  WHERE (d.owner_id = auth.uid() OR d.user_id = auth.uid() OR d.tenant_id = auth.uid())
    AND key IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.accessible_energy_log_device_keys() FROM PUBLIC;
-- anon too: the policy applies to every role, and auth.uid() is null for anon,
-- so the function returns no keys rather than raising a permission error.
GRANT EXECUTE ON FUNCTION public.accessible_energy_log_device_keys() TO anon, authenticated;

-- Created outside the migrations in the dashboard; a subset of the policy below.
DROP POLICY IF EXISTS "Users can view own energy logs" ON public.energy_logs;
-- Equivalent to the super_admin branch of the policy below.
DROP POLICY IF EXISTS "super_admin_select_energy_logs" ON public.energy_logs;

DROP POLICY IF EXISTS "users_select_accessible_energy_logs" ON public.energy_logs;
CREATE POLICY "users_select_accessible_energy_logs" ON public.energy_logs
  FOR SELECT
  USING (
    (SELECT public.current_profile_role()) = 'super_admin'
    OR device_id IN (SELECT public.accessible_energy_log_device_keys())
  );
