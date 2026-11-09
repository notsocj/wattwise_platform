-- What an "Other" appliance actually is ("Electric fan", "Rice cooker").
--
-- appliance_type stays one of the four categories (devices_appliance_type_check);
-- the app fills appliance_detail only when appliance_type = 'other' and clears it
-- otherwise. The check limits length only, so admin type edits never fail on it.
-- anon keeps its column grant on mac_address and relay_state only (040), so the
-- new column is not readable with the public key.

ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS appliance_detail text;

ALTER TABLE public.devices DROP CONSTRAINT IF EXISTS devices_appliance_detail_check;
ALTER TABLE public.devices ADD CONSTRAINT devices_appliance_detail_check
  CHECK (appliance_detail IS NULL OR char_length(btrim(appliance_detail)) BETWEEN 1 AND 40);
