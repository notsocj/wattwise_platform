-- ============================================================
-- 006_accuracy_usage_rpcs.sql
-- Two billing-grade usage RPCs that compute kWh from sequential
-- cumulative-meter deltas (not raw sums), with minute-bucket
-- deduplication.  Tiny negative drift treated as 0 (jitter).
-- Large drops treated as 0 (meter reset guard).
--
-- Functions:
--   get_usage_kwh_by_device(p_user_id, p_start, p_end)
--   get_usage_kwh_by_device_day(p_user_id, p_start, p_end)
-- ============================================================

-- ── Per-device total usage in a date range ───────────────────
CREATE OR REPLACE FUNCTION get_usage_kwh_by_device(
  p_user_id uuid,
  p_start   timestamptz,
  p_end     timestamptz
)
RETURNS TABLE (
  device_id  text,
  usage_kwh  numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH ordered_logs AS (
    SELECT
      el.device_id,
      el.energy_kwh,
      el.recorded_at,
      -- Deduplicate to one reading per minute per device (take max in bucket)
      date_trunc('minute', el.recorded_at) AS minute_bucket
    FROM energy_logs el
    JOIN devices d
      ON (el.device_id = d.id::text OR el.device_id = d.mac_address)
    WHERE d.user_id = p_user_id
      AND el.recorded_at >= p_start
      AND el.recorded_at <= p_end
  ),
  minute_deduped AS (
    SELECT DISTINCT ON (device_id, minute_bucket)
      device_id,
      energy_kwh,
      recorded_at,
      minute_bucket
    FROM ordered_logs
    ORDER BY device_id, minute_bucket, recorded_at DESC
  ),
  with_prev AS (
    SELECT
      device_id,
      energy_kwh,
      LAG(energy_kwh) OVER (
        PARTITION BY device_id ORDER BY recorded_at
      ) AS prev_kwh
    FROM minute_deduped
  ),
  deltas AS (
    SELECT
      device_id,
      CASE
        WHEN prev_kwh IS NULL          THEN 0  -- first reading in range
        WHEN energy_kwh - prev_kwh < 0 THEN 0  -- meter reset or negative jitter
        ELSE energy_kwh - prev_kwh
      END AS delta_kwh
    FROM with_prev
  )
  SELECT device_id, SUM(delta_kwh)::numeric AS usage_kwh
  FROM deltas
  GROUP BY device_id;
$$;

-- ── Per-device usage broken down by calendar day ─────────────
-- day_key is in Philippine time (Asia/Manila, UTC+8).
CREATE OR REPLACE FUNCTION get_usage_kwh_by_device_day(
  p_user_id uuid,
  p_start   timestamptz,
  p_end     timestamptz
)
RETURNS TABLE (
  device_id  text,
  day_key    text,
  usage_kwh  numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH ordered_logs AS (
    SELECT
      el.device_id,
      el.energy_kwh,
      el.recorded_at,
      date_trunc('minute', el.recorded_at) AS minute_bucket,
      to_char(el.recorded_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS day_key
    FROM energy_logs el
    JOIN devices d
      ON (el.device_id = d.id::text OR el.device_id = d.mac_address)
    WHERE d.user_id = p_user_id
      AND el.recorded_at >= p_start
      AND el.recorded_at <= p_end
  ),
  minute_deduped AS (
    SELECT DISTINCT ON (device_id, minute_bucket)
      device_id,
      energy_kwh,
      recorded_at,
      day_key
    FROM ordered_logs
    ORDER BY device_id, minute_bucket, recorded_at DESC
  ),
  with_prev AS (
    SELECT
      device_id,
      energy_kwh,
      day_key,
      LAG(energy_kwh) OVER (
        PARTITION BY device_id ORDER BY recorded_at
      ) AS prev_kwh
    FROM minute_deduped
  ),
  deltas AS (
    SELECT
      device_id,
      day_key,
      CASE
        WHEN prev_kwh IS NULL          THEN 0
        WHEN energy_kwh - prev_kwh < 0 THEN 0
        ELSE energy_kwh - prev_kwh
      END AS delta_kwh
    FROM with_prev
  )
  SELECT device_id, day_key, SUM(delta_kwh)::numeric AS usage_kwh
  FROM deltas
  GROUP BY device_id, day_key;
$$;
