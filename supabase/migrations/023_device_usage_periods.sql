-- Bounded per-device consumption summaries. PZEM energy_kwh is cumulative, so
-- usage is calculated from positive deltas rather than summing raw readings.
CREATE OR REPLACE FUNCTION public.get_device_usage_periods(
  p_user_id uuid,
  p_device_id uuid,
  p_now timestamptz DEFAULT now()
)
RETURNS TABLE (period_key text, started_at timestamptz, usage_kwh numeric)
LANGUAGE sql
STABLE
AS $$
  WITH accessible_device AS (
    SELECT id, mac_address FROM public.devices
    WHERE id = p_device_id
      AND (owner_id = p_user_id OR user_id = p_user_id OR tenant_id = p_user_id)
  ),
  periods AS (
    SELECT 'hour'::text AS period_key, date_trunc('hour', p_now AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila' AS started_at
    UNION ALL SELECT 'day', date_trunc('day', p_now AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila'
    UNION ALL SELECT 'week', date_trunc('week', p_now AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila'
    UNION ALL SELECT 'month', date_trunc('month', p_now AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila'
  ),
  period_logs AS (
    SELECT p.period_key, p.started_at, el.energy_kwh, el.recorded_at, date_trunc('minute', el.recorded_at) AS minute_bucket
    FROM periods p CROSS JOIN accessible_device d
    JOIN public.energy_logs el ON (el.device_id = d.id::text OR el.device_id = d.mac_address)
    WHERE el.recorded_at >= p.started_at AND el.recorded_at <= p_now
    UNION ALL
    SELECT p.period_key, p.started_at, anchor.energy_kwh, anchor.recorded_at, date_trunc('minute', anchor.recorded_at)
    FROM periods p CROSS JOIN accessible_device d
    CROSS JOIN LATERAL (
      SELECT el.energy_kwh, el.recorded_at FROM public.energy_logs el
      WHERE (el.device_id = d.id::text OR el.device_id = d.mac_address) AND el.recorded_at < p.started_at
      ORDER BY el.recorded_at DESC LIMIT 1
    ) anchor
  ),
  deduped AS (
    SELECT DISTINCT ON (period_key, minute_bucket) period_key, started_at, energy_kwh, recorded_at
    FROM period_logs ORDER BY period_key, minute_bucket, recorded_at DESC
  ),
  deltas AS (
    SELECT period_key, started_at, recorded_at,
      energy_kwh - lag(energy_kwh) OVER (PARTITION BY period_key ORDER BY recorded_at) AS delta_kwh
    FROM deduped
  )
  SELECT p.period_key, p.started_at,
    COALESCE(SUM(CASE WHEN d.recorded_at >= p.started_at AND d.delta_kwh > 0 THEN d.delta_kwh ELSE 0 END), 0)::numeric AS usage_kwh
  FROM periods p LEFT JOIN deltas d ON d.period_key = p.period_key
  GROUP BY p.period_key, p.started_at
  ORDER BY CASE p.period_key WHEN 'hour' THEN 1 WHEN 'day' THEN 2 WHEN 'week' THEN 3 ELSE 4 END;
$$;

GRANT EXECUTE ON FUNCTION public.get_device_usage_periods(uuid, uuid, timestamptz) TO authenticated;
