-- Remote "Reset Wi-Fi" for a unit.
--
-- The owner's dashboard sets devices.wifi_reset_requested_at. The firmware
-- already polls GET /rest/v1/devices?select=relay_state&mac_address=eq.<MAC>
-- every few seconds; it now also selects wifi_reset_requested_at. When that is
-- set, the unit calls ack_wifi_reset(<MAC>) and clears only its saved Wi-Fi
-- (and reopens the WattWise-Setup portal) when the call returns true.
--
-- The acknowledgement clears the flag before the unit forgets its network, so
-- a reprovisioned unit can never loop back into another reset. A request older
-- than 10 minutes is dropped instead of acted on, so a unit that was offline
-- when the owner pressed the button doesn't surprise anyone later.

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS wifi_reset_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN public.devices.wifi_reset_requested_at IS
  'Set by the owner to make the unit forget its Wi-Fi; cleared by ack_wifi_reset() when the unit picks it up.';

-- 040 limits anon to the columns the firmware reads; add the new one.
GRANT SELECT (wifi_reset_requested_at) ON public.devices TO anon;

CREATE OR REPLACE FUNCTION public.ack_wifi_reset(p_mac text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_at timestamptz;
BEGIN
  UPDATE public.devices d
  SET wifi_reset_requested_at = NULL
  FROM (
    SELECT id, wifi_reset_requested_at AS old_requested_at
    FROM public.devices
    WHERE upper(mac_address) = upper(p_mac)
      AND wifi_reset_requested_at IS NOT NULL
    FOR UPDATE
  ) pending
  WHERE d.id = pending.id
  RETURNING pending.old_requested_at INTO requested_at;

  RETURN requested_at IS NOT NULL AND requested_at > now() - interval '10 minutes';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ack_wifi_reset(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ack_wifi_reset(text) TO anon, authenticated, service_role;
