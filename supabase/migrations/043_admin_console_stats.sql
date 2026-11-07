-- Read-only statistics for the admin console. Both functions are callable
-- only by the service role (the admin pages use the admin client after the
-- super_admin check); nothing here changes data.

-- Platform-wide kWh per Manila day. energy_kwh is a cumulative meter reading,
-- so usage is the sum of positive deltas per device (meter resets count as 0),
-- the same rules as get_usage_kwh_by_device_day but across every device.
-- The window is capped at 92 days to keep the scan bounded.
CREATE OR REPLACE FUNCTION public.admin_platform_daily_kwh(p_start timestamptz, p_end timestamptz)
RETURNS TABLE (day_key text, usage_kwh numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT GREATEST(p_start, p_end - interval '92 days') AS start_at, p_end AS end_at
  ),
  ordered_logs AS (
    SELECT
      d.id::text AS device_id,
      el.energy_kwh,
      el.recorded_at,
      date_trunc('minute', el.recorded_at) AS minute_bucket,
      to_char(el.recorded_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS day_key
    FROM energy_logs el
    JOIN devices d ON (el.device_id = d.id::text OR el.device_id = d.mac_address)
    CROSS JOIN bounds b
    WHERE el.recorded_at >= b.start_at AND el.recorded_at <= b.end_at
  ),
  minute_deduped AS (
    SELECT DISTINCT ON (device_id, minute_bucket) device_id, energy_kwh, recorded_at, day_key
    FROM ordered_logs
    ORDER BY device_id, minute_bucket, recorded_at DESC
  ),
  with_prev AS (
    SELECT day_key, energy_kwh,
      LAG(energy_kwh) OVER (PARTITION BY device_id ORDER BY recorded_at) AS prev_kwh
    FROM minute_deduped
  )
  SELECT day_key,
    SUM(CASE WHEN prev_kwh IS NULL OR energy_kwh < prev_kwh THEN 0 ELSE energy_kwh - prev_kwh END)::numeric
  FROM with_prev
  GROUP BY day_key
  ORDER BY day_key;
$$;

-- Database size against the plan limit, and the telemetry table's share.
-- Row count is the planner estimate (instant, refreshed by autovacuum).
CREATE OR REPLACE FUNCTION public.admin_storage_stats()
RETURNS TABLE (database_bytes bigint, energy_logs_bytes bigint, energy_logs_rows bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pg_database_size(current_database()),
    pg_total_relation_size('public.energy_logs'),
    GREATEST(c.reltuples, 0)::bigint
  FROM pg_class c
  WHERE c.oid = 'public.energy_logs'::regclass;
$$;

REVOKE ALL ON FUNCTION public.admin_platform_daily_kwh(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_storage_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_platform_daily_kwh(timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_storage_stats() TO service_role;
