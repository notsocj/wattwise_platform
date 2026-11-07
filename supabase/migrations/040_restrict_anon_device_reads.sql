-- Stop the public anon key from reading every row and column of devices.
--
-- Two policies let anon read the whole table:
--   * hardware_anon_select_devices (011) is USING (true) for anon;
--   * users_select_accessible_devices (014) applies to every role, and
--     can_access_device() (018) returned true whenever auth.uid() was null.
-- The anon key ships in every browser bundle, so GET /rest/v1/devices?select=*
-- returned owner ids, names, MACs, budgets and relay state for every unit.
--
-- The ESP32-S3 firmware only sends
--   GET /rest/v1/devices?select=relay_state&mac_address=eq.<MAC>
-- so anon keeps the row policy but may read only mac_address (for the filter)
-- and relay_state. Anon telemetry inserts are unaffected: the energy_logs
-- policy and its triggers resolve devices through SECURITY DEFINER functions.
-- Signed-in users always have auth.uid() and keep their table privileges, so
-- owners, tenants, managers, admins and Realtime see exactly what they did.
--
-- Still open: anon can list every MAC and its relay state, and a MAC is all an
-- anon telemetry insert needs. A MAC is not a secret (an ESP32 broadcasts it
-- over Wi-Fi), so closing that needs a per-device secret and a firmware update.

CREATE OR REPLACE FUNCTION public.can_access_device(target_device public.devices)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN current_profile_role() = 'super_admin'
    OR target_device.owner_id = auth.uid()
    OR target_device.user_id = auth.uid()
    OR target_device.tenant_id = auth.uid();
END;
$$;

-- Revoking the table privilege also drops anon's per-column privileges, so
-- columns added later stay hidden from anon by default.
REVOKE ALL ON public.devices FROM anon;
GRANT SELECT (mac_address, relay_state) ON public.devices TO anon;
