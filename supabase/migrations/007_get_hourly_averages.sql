-- ============================================================
-- 007_get_hourly_averages.sql
-- RPC: get_hourly_averages(p_user_id uuid, p_date date)
-- Returns average wattage per hour-of-day (0–23) across all
-- devices owned by p_user_id on a given calendar date.
-- Used by: Daily bar chart on Home Dashboard.
-- ============================================================

CREATE OR REPLACE FUNCTION get_hourly_averages(
  p_user_id uuid,
  p_date    date
)
RETURNS TABLE (
  hour_key  integer,
  avg_watts numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    EXTRACT(HOUR FROM el.recorded_at AT TIME ZONE 'Asia/Manila')::integer AS hour_key,
    AVG(el.average_watts)::numeric AS avg_watts
  FROM energy_logs el
  JOIN devices d
    ON (el.device_id = d.id::text OR el.device_id = d.mac_address)
  WHERE d.user_id = p_user_id
    AND (el.recorded_at AT TIME ZONE 'Asia/Manila')::date = p_date
    AND el.average_watts IS NOT NULL
  GROUP BY hour_key
  ORDER BY hour_key;
$$;
