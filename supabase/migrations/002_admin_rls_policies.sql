-- ============================================================
-- 002_admin_rls_policies.sql
-- Super Admin RLS policies — grants super_admin role broad
-- read access across all tables and write access to meralco_rates.
-- Pattern: EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
-- ============================================================

-- ── profiles ────────────────────────────────────────────────
DROP POLICY IF EXISTS "super_admin_select_profiles" ON profiles;
CREATE POLICY "super_admin_select_profiles" ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- ── meralco_rates ────────────────────────────────────────────
DROP POLICY IF EXISTS "super_admin_select_meralco_rates" ON meralco_rates;
CREATE POLICY "super_admin_select_meralco_rates" ON meralco_rates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "super_admin_insert_meralco_rates" ON meralco_rates;
CREATE POLICY "super_admin_insert_meralco_rates" ON meralco_rates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "super_admin_update_meralco_rates" ON meralco_rates;
CREATE POLICY "super_admin_update_meralco_rates" ON meralco_rates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ── devices ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "super_admin_select_devices" ON devices;
CREATE POLICY "super_admin_select_devices" ON devices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ── energy_logs ──────────────────────────────────────────────
DROP POLICY IF EXISTS "super_admin_select_energy_logs" ON energy_logs;
CREATE POLICY "super_admin_select_energy_logs" ON energy_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ── ai_insights ──────────────────────────────────────────────
DROP POLICY IF EXISTS "super_admin_select_ai_insights" ON ai_insights;
CREATE POLICY "super_admin_select_ai_insights" ON ai_insights
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );
