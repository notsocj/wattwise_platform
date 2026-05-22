-- ============================================================
-- 010_add_device_metadata.sql
-- Adds three columns to the devices table required by the
-- AI onboarding wizard and hardware relay control:
--
--   relay_state       BOOLEAN  — ESP32 polls this every 5 s
--   appliance_type    TEXT     — set during AddApplianceModal AI flow
--   daily_usage_hours NUMERIC  — user-estimated hours/day for AI estimation
--
-- Uses ADD COLUMN IF NOT EXISTS for idempotency.
-- ============================================================

-- Required by ESP32 relay polling: GET /rest/v1/devices?select=relay_state&mac_address=eq.<MAC>
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS relay_state BOOLEAN DEFAULT false;

-- Set by AddApplianceModal AI wizard (values: 'refrigerator' | 'aircon' | 'tv' | 'other')
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS appliance_type TEXT;

-- User-estimated daily usage; used by setup-recommendation API
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS daily_usage_hours NUMERIC(4, 1);

-- Optional check constraint to enforce valid appliance_type values
-- Drop before re-creating so the migration is idempotent
ALTER TABLE devices
  DROP CONSTRAINT IF EXISTS devices_appliance_type_check;

ALTER TABLE devices
  ADD CONSTRAINT devices_appliance_type_check
  CHECK (
    appliance_type IS NULL
    OR appliance_type IN ('refrigerator', 'aircon', 'tv', 'other')
  );
