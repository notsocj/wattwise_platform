-- ============================================================
-- 005_get_latest_device_readings.sql
-- RPC: get_latest_device_readings(p_user_id uuid)
-- Returns the single most-recent energy_logs row for each
-- device owned by p_user_id.  Supports both UUID-text and
-- MAC-address formats in energy_logs.device_id.
-- Used by: Home Dashboard live card telemetry (W/V/A).
-- ============================================================

CREATE OR REPLACE FUNCTION get_latest_device_readings(p_user_id uuid)
RETURNS TABLE (
  device_id     text,
  average_watts numeric,
  voltage_v     numeric,
  current_a     numeric,
  energy_kwh    numeric,
  recorded_at   timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (el.device_id)
    el.device_id,
    el.average_watts,
    el.voltage_v,
    el.current_a,
    el.energy_kwh,
    el.recorded_at
  FROM energy_logs el
  JOIN devices d
    ON (el.device_id = d.id::text OR el.device_id = d.mac_address)
  WHERE d.user_id = p_user_id
  ORDER BY el.device_id, el.recorded_at DESC;
$$;
