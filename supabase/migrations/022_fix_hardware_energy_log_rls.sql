-- Checking devices directly from an energy_logs policy can be affected by the
-- caller's devices RLS context. Resolve registration through a narrowly scoped
-- SECURITY DEFINER helper so the anonymous ESP32 insert is deterministic.
CREATE OR REPLACE FUNCTION public.is_registered_device_mac(candidate_mac text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.devices
    WHERE upper(mac_address) = upper(trim(candidate_mac))
  );
$$;

REVOKE ALL ON FUNCTION public.is_registered_device_mac(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_registered_device_mac(text) TO anon, authenticated;

DROP POLICY IF EXISTS "hardware_anon_insert_energy_logs" ON public.energy_logs;
CREATE POLICY "hardware_anon_insert_energy_logs" ON public.energy_logs
  FOR INSERT
  TO anon
  WITH CHECK (public.is_registered_device_mac(device_id));
