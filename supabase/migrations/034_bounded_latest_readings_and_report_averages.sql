-- 1. get_latest_device_readings: same signature and results, bounded cost.
--    The old version joined every energy_logs row a device ever sent and used
--    DISTINCT ON to keep the newest, so its cost grew with history (~17k rows
--    per device per day). Each device now does two index probes on
--    idx_energy_logs_device_time (device_id, recorded_at DESC): one for its
--    UUID and one for its legacy MAC, keeping the newer reading. Devices with
--    no readings are still omitted, as before.
CREATE OR REPLACE FUNCTION public.get_latest_device_readings(p_user_id uuid)
RETURNS TABLE (
  device_id text,
  average_watts numeric,
  voltage_v numeric,
  current_a numeric,
  energy_kwh numeric,
  recorded_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    d.id::text AS device_id,
    latest.average_watts,
    latest.voltage_v,
    latest.current_a,
    latest.energy_kwh,
    latest.recorded_at
  FROM devices d
  CROSS JOIN LATERAL (
    SELECT candidates.*
    FROM (
      (SELECT el.average_watts, el.voltage_v, el.current_a, el.energy_kwh, el.recorded_at
       FROM energy_logs el
       WHERE el.device_id = d.id::text
       ORDER BY el.recorded_at DESC
       LIMIT 1)
      UNION ALL
      (SELECT el.average_watts, el.voltage_v, el.current_a, el.energy_kwh, el.recorded_at
       FROM energy_logs el
       WHERE el.device_id = d.mac_address
       ORDER BY el.recorded_at DESC
       LIMIT 1)
    ) AS candidates
    ORDER BY candidates.recorded_at DESC
    LIMIT 1
  ) AS latest
  WHERE d.owner_id = p_user_id
    OR d.user_id = p_user_id
    OR d.tenant_id = p_user_id;
$$;

-- 2. Average reported watts per device over a bounded window, for reports.
--    Replaces downloading raw rows (capped at 50,000, about a tenth of one
--    device-month) and averaging them in the app. Runs with the caller's
--    permissions, so energy_logs RLS still applies.
CREATE OR REPLACE FUNCTION public.get_average_watts_by_device(
  p_user_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE (
  device_id text,
  average_watts numeric,
  readings bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    d.id::text AS device_id,
    avg(COALESCE(el.average_watts, 0))::numeric AS average_watts,
    count(*) AS readings
  FROM devices d
  JOIN energy_logs el
    ON el.device_id IN (d.id::text, d.mac_address)
  WHERE (d.owner_id = p_user_id OR d.user_id = p_user_id OR d.tenant_id = p_user_id)
    AND el.recorded_at >= p_start
    AND el.recorded_at <= p_end
  GROUP BY d.id;
$$;
