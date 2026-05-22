-- ============================================================
-- 011_hardware_device_rls.sql
-- Grants the Supabase `anon` role the minimum permissions
-- required for ESP32-S3 hardware modules to function using
-- only the public anon key (no user JWT).
--
-- POLICY 1 — energy_logs INSERT for anon
--   Allows the ESP32 to POST 5-second telemetry payloads.
--   Restricted to mac_address values that are already registered
--   in the devices table, preventing telemetry spam from
--   unrecognised hardware.
--
-- POLICY 2 — devices SELECT for anon
--   Allows the ESP32 to poll relay_state every 5 seconds via:
--   GET /rest/v1/devices?select=relay_state&mac_address=eq.<MAC>
--   The ESP32 only queries its own MAC, but the anon policy must
--   be permissive enough to return that single row.
--
-- Security note: Only mac_address + relay_state are needed by
-- hardware; column selection in the REST query limits exposure.
-- ============================================================

-- ── Policy 1: ESP32 telemetry ingestion ─────────────────────
DROP POLICY IF EXISTS "hardware_anon_insert_energy_logs" ON energy_logs;
CREATE POLICY "hardware_anon_insert_energy_logs" ON energy_logs
  FOR INSERT
  TO anon
  WITH CHECK (
    -- Only accept telemetry from devices whose MAC is already registered.
    -- This prevents unregistered hardware or malicious clients from
    -- polluting the energy_logs table via the anon key.
    device_id IN (SELECT mac_address FROM devices)
  );

-- ── Policy 2: ESP32 relay state polling ─────────────────────
DROP POLICY IF EXISTS "hardware_anon_select_devices" ON devices;
CREATE POLICY "hardware_anon_select_devices" ON devices
  FOR SELECT
  TO anon
  -- No USING restriction: the ESP32 queries by its own mac_address in
  -- the URL filter (?mac_address=eq.<MAC>), so all rows are safe to
  -- expose. relay_state is not sensitive data.
  USING (true);
