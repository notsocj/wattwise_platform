-- ============================================================
-- WattWise Platform — Super Admin RLS Policies
-- Grants super_admin users read access to all tables
-- and write access to meralco_rates for rate management
-- ============================================================

-- profiles: super_admin can view all user profiles
CREATE POLICY "Super admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
    )
  );

-- devices: super_admin can view all devices
CREATE POLICY "Super admins can view all devices"
  ON devices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- energy_logs: super_admin can view all energy logs
CREATE POLICY "Super admins can view all energy logs"
  ON energy_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- relay_commands: super_admin can view all relay commands
CREATE POLICY "Super admins can view all relay commands"
  ON relay_commands FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- ai_insights: super_admin can view all AI insights
CREATE POLICY "Super admins can view all insights"
  ON ai_insights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- meralco_rates: super_admin can insert new rate entries
CREATE POLICY "Super admins can insert rates"
  ON meralco_rates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- meralco_rates: super_admin can update existing rate entries
CREATE POLICY "Super admins can update rates"
  ON meralco_rates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );
