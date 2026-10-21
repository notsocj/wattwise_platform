-- Make the "last seen" trigger work for real hardware.
--
-- update_device_last_seen() ran with the inserting role's privileges. The
-- ESP32 inserts telemetry as anon, and anon has no UPDATE policy on devices,
-- so for real hardware the UPDATE matched no rows and last_seen_at stayed null
-- (it only worked for service-role inserts such as demo units).
--
-- Run it as the function owner instead. It stays narrow: it can only touch the
-- device whose UUID or MAC the inserted row names, and that row already passed
-- the energy_logs INSERT policy (a registered device MAC for anon). Trigger
-- functions cannot be called directly, and EXECUTE is revoked for clarity.
--
-- devices.is_online is still set to true here but nothing ever resets it, so
-- the app treats a device as online from last_seen_at freshness instead.

CREATE OR REPLACE FUNCTION public.update_device_last_seen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.devices
  SET
    last_seen_at = NOW(),
    is_online = true
  WHERE (id::text = NEW.device_id OR mac_address = NEW.device_id)
    AND user_id IS NOT NULL; -- only paired devices

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_device_last_seen() FROM PUBLIC, anon, authenticated;
