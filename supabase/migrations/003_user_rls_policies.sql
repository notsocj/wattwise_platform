-- ============================================================
-- 003_user_rls_policies.sql
-- Standard authenticated-user RLS policies.
-- Each user can only access rows they own.
-- ============================================================

-- ── profiles ────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_own_profile" ON profiles;
CREATE POLICY "users_select_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;
CREATE POLICY "users_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- ── meralco_rates ────────────────────────────────────────────
-- All authenticated users may read rates (needed for billing calculations)
DROP POLICY IF EXISTS "users_select_meralco_rates" ON meralco_rates;
CREATE POLICY "users_select_meralco_rates" ON meralco_rates
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── devices ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_own_devices" ON devices;
CREATE POLICY "users_select_own_devices" ON devices
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_devices" ON devices;
CREATE POLICY "users_insert_own_devices" ON devices
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_devices" ON devices;
CREATE POLICY "users_update_own_devices" ON devices
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_delete_own_devices" ON devices;
CREATE POLICY "users_delete_own_devices" ON devices
  FOR DELETE USING (user_id = auth.uid());

-- ── energy_logs ──────────────────────────────────────────────
-- Users may read logs for devices they own (supports both UUID and MAC key formats)
DROP POLICY IF EXISTS "users_select_own_energy_logs" ON energy_logs;
CREATE POLICY "users_select_own_energy_logs" ON energy_logs
  FOR SELECT USING (
    device_id IN (
      SELECT id::text FROM devices WHERE user_id = auth.uid()
    )
    OR
    device_id IN (
      SELECT mac_address FROM devices WHERE user_id = auth.uid()
    )
  );

-- ── ai_insights ──────────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_own_ai_insights" ON ai_insights;
CREATE POLICY "users_select_own_ai_insights" ON ai_insights
  FOR SELECT USING (user_id = auth.uid());

-- Inserts to ai_insights are performed server-side (Next.js API route)
-- using the service_role client, so no INSERT policy is needed for authenticated users.
