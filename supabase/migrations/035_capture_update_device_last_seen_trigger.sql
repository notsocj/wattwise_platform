-- Capture the energy_logs -> devices "last seen" trigger, which was created in
-- the Supabase dashboard and never recorded in a migration. This reproduces
-- the production definition exactly (verified against pg_get_functiondef and
-- pg_get_triggerdef); it changes no behavior.
--
-- Known issue, kept as-is here: the function runs with the inserting role's
-- privileges (SECURITY INVOKER). Hardware inserts as anon, and anon has no
-- UPDATE policy on devices, so for real hardware this UPDATE matches no rows
-- and last_seen_at / is_online are only set for service-role inserts (demo
-- units). Fixing that is a separate, deliberate behavior change.

CREATE OR REPLACE FUNCTION public.update_device_last_seen()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Update the device's last_seen_at to now and mark as online
  UPDATE public.devices
  SET
    last_seen_at = NOW(),
    is_online = true
  WHERE (id::text = NEW.device_id OR mac_address = NEW.device_id)
    AND user_id IS NOT NULL; -- safety check: only update paired devices

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS energy_logs_update_device_last_seen ON public.energy_logs;
CREATE TRIGGER energy_logs_update_device_last_seen
  AFTER INSERT ON public.energy_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_device_last_seen();
