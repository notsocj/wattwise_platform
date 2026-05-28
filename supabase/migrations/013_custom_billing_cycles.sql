-- ============================================================
-- 013_custom_billing_cycles.sql
-- Adds a user-level Meralco billing cycle start day and moves
-- Smart Control accumulation from calendar-month boundaries to
-- custom billing-cycle boundaries.
--
-- Notes:
--   - device_month_usage.month_start remains the same column
--     name for compatibility, but now stores the billing-cycle
--     start date instead of the calendar-month start date.
--   - Current active-cycle accumulators are rebuilt from
--     energy_logs without re-enabling relays or rewriting
--     existing budget events.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS billing_cycle_start_day INTEGER NOT NULL DEFAULT 1;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_billing_cycle_start_day_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_billing_cycle_start_day_check
  CHECK (
    billing_cycle_start_day >= 1
    AND billing_cycle_start_day <= 28
  );

CREATE OR REPLACE FUNCTION handle_energy_log_smart_budget()
RETURNS TRIGGER AS $$
DECLARE
  target_device devices%ROWTYPE;
  billing_start_day INTEGER := 1;
  recorded_date_ph DATE;
  cycle_start_date DATE;
  previous_kwh NUMERIC;
  delta_kwh NUMERIC;
  subtotal_per_kwh NUMERIC;
  vat_multiplier NUMERIC;
  variable_spend NUMERIC;
  updated_usage NUMERIC;
  updated_spend NUMERIC;
  event_message TEXT;
BEGIN
  SELECT *
  INTO target_device
  FROM devices
  WHERE id::text = NEW.device_id OR mac_address = NEW.device_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(billing_cycle_start_day, 1)
  INTO billing_start_day
  FROM profiles
  WHERE id = target_device.user_id;

  recorded_date_ph := (NEW.recorded_at AT TIME ZONE 'Asia/Manila')::date;

  IF EXTRACT(DAY FROM recorded_date_ph)::integer >= billing_start_day THEN
    cycle_start_date := date_trunc('month', recorded_date_ph::timestamp)::date
      + (billing_start_day - 1);
  ELSE
    cycle_start_date := (
      date_trunc('month', recorded_date_ph::timestamp) - interval '1 month'
    )::date + (billing_start_day - 1);
  END IF;

  SELECT
    generation + transmission + system_loss + distribution + universal_charges + fit_all,
    1 + vat_rate
  INTO subtotal_per_kwh, vat_multiplier
  FROM meralco_rates
  WHERE effective_month <= recorded_date_ph
  ORDER BY effective_month DESC
  LIMIT 1;

  IF subtotal_per_kwh IS NULL OR vat_multiplier IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT last_energy_kwh
  INTO previous_kwh
  FROM device_month_usage
  WHERE device_id = target_device.id
    AND month_start = cycle_start_date
  FOR UPDATE;

  IF previous_kwh IS NULL THEN
    delta_kwh := 0;
  ELSIF NEW.energy_kwh >= previous_kwh THEN
    delta_kwh := NEW.energy_kwh - previous_kwh;
  ELSE
    delta_kwh := 0;
  END IF;

  variable_spend := ROUND((delta_kwh * subtotal_per_kwh * vat_multiplier)::numeric, 2);

  INSERT INTO device_month_usage (
    device_id,
    user_id,
    month_start,
    usage_kwh,
    variable_spend_php,
    last_energy_kwh,
    last_recorded_at,
    updated_at
  )
  VALUES (
    target_device.id,
    target_device.user_id,
    cycle_start_date,
    delta_kwh,
    variable_spend,
    NEW.energy_kwh,
    NEW.recorded_at,
    NOW()
  )
  ON CONFLICT (device_id, month_start)
  DO UPDATE SET
    usage_kwh = device_month_usage.usage_kwh + EXCLUDED.usage_kwh,
    variable_spend_php = device_month_usage.variable_spend_php + EXCLUDED.variable_spend_php,
    last_energy_kwh = EXCLUDED.last_energy_kwh,
    last_recorded_at = EXCLUDED.last_recorded_at,
    updated_at = NOW()
  RETURNING usage_kwh, variable_spend_php
  INTO updated_usage, updated_spend;

  IF target_device.user_approved_limit_php IS NULL
    OR target_device.user_approved_limit_php <= 0
    OR updated_spend < target_device.user_approved_limit_php
    OR target_device.budget_status IN ('approval_required', 'auto_cutoff')
  THEN
    RETURN NEW;
  END IF;

  IF target_device.require_approval_on_expiry THEN
    UPDATE devices
    SET
      budget_status = 'approval_required',
      budget_breached_at = COALESCE(budget_breached_at, NOW())
    WHERE id = target_device.id;

    event_message := 'Budget limit hit. Cut power manually?';

    INSERT INTO device_budget_events (
      device_id,
      user_id,
      month_start,
      event_type,
      threshold_php,
      spend_php,
      usage_kwh,
      message
    )
    SELECT
      target_device.id,
      target_device.user_id,
      cycle_start_date,
      'approval_required',
      target_device.user_approved_limit_php,
      updated_spend,
      updated_usage,
      event_message
    WHERE NOT EXISTS (
      SELECT 1
      FROM device_budget_events
      WHERE device_id = target_device.id
        AND month_start = cycle_start_date
        AND event_type = 'approval_required'
    );
  ELSE
    UPDATE devices
    SET
      relay_state = false,
      budget_status = 'auto_cutoff',
      budget_breached_at = COALESCE(budget_breached_at, NOW()),
      relay_auto_disabled_at = COALESCE(relay_auto_disabled_at, NOW())
    WHERE id = target_device.id;

    event_message := 'Budget limit hit. WattWise automatically cut power to prevent bill shock.';

    INSERT INTO device_budget_events (
      device_id,
      user_id,
      month_start,
      event_type,
      threshold_php,
      spend_php,
      usage_kwh,
      message
    )
    SELECT
      target_device.id,
      target_device.user_id,
      cycle_start_date,
      'auto_cutoff',
      target_device.user_approved_limit_php,
      updated_spend,
      updated_usage,
      event_message
    WHERE NOT EXISTS (
      SELECT 1
      FROM device_budget_events
      WHERE device_id = target_device.id
        AND month_start = cycle_start_date
        AND event_type = 'auto_cutoff'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

WITH device_cycles AS (
  SELECT
    d.id AS device_id,
    d.user_id,
    d.mac_address,
    COALESCE(p.billing_cycle_start_day, 1) AS billing_cycle_start_day,
    CASE
      WHEN EXTRACT(DAY FROM (NOW() AT TIME ZONE 'Asia/Manila')::date)::integer >= COALESCE(p.billing_cycle_start_day, 1)
        THEN date_trunc('month', (NOW() AT TIME ZONE 'Asia/Manila')::date::timestamp)::date
          + (COALESCE(p.billing_cycle_start_day, 1) - 1)
      ELSE (
        date_trunc('month', (NOW() AT TIME ZONE 'Asia/Manila')::date::timestamp) - interval '1 month'
      )::date + (COALESCE(p.billing_cycle_start_day, 1) - 1)
    END AS cycle_start_date
  FROM devices d
  JOIN profiles p
    ON p.id = d.user_id
),
cycle_logs AS (
  SELECT
    dc.device_id,
    dc.user_id,
    dc.cycle_start_date,
    el.energy_kwh::numeric AS energy_kwh,
    el.recorded_at,
    date_trunc('minute', el.recorded_at) AS minute_bucket,
    (el.recorded_at AT TIME ZONE 'Asia/Manila')::date AS recorded_date
  FROM device_cycles dc
  JOIN energy_logs el
    ON el.device_id = dc.device_id::text
    OR el.device_id = dc.mac_address
  WHERE (el.recorded_at AT TIME ZONE 'Asia/Manila')::date >= dc.cycle_start_date
    AND el.recorded_at <= NOW()
),
minute_deduped AS (
  SELECT DISTINCT ON (device_id, minute_bucket)
    device_id,
    user_id,
    cycle_start_date,
    energy_kwh,
    recorded_at,
    recorded_date
  FROM cycle_logs
  ORDER BY device_id, minute_bucket, recorded_at DESC
),
with_prev AS (
  SELECT
    device_id,
    user_id,
    cycle_start_date,
    energy_kwh,
    recorded_at,
    recorded_date,
    LAG(energy_kwh) OVER (
      PARTITION BY device_id
      ORDER BY recorded_at
    ) AS previous_kwh
  FROM minute_deduped
),
priced_deltas AS (
  SELECT
    wp.device_id,
    wp.user_id,
    wp.cycle_start_date,
    wp.energy_kwh,
    wp.recorded_at,
    CASE
      WHEN wp.previous_kwh IS NULL THEN 0
      WHEN wp.energy_kwh >= wp.previous_kwh THEN wp.energy_kwh - wp.previous_kwh
      ELSE 0
    END AS delta_kwh,
    ROUND((
      CASE
        WHEN wp.previous_kwh IS NULL THEN 0
        WHEN wp.energy_kwh >= wp.previous_kwh THEN wp.energy_kwh - wp.previous_kwh
        ELSE 0
      END
      * (
        mr.generation
        + mr.transmission
        + mr.system_loss
        + mr.distribution
        + mr.universal_charges
        + mr.fit_all
      )
      * (1 + mr.vat_rate)
    )::numeric, 2) AS delta_spend_php
  FROM with_prev wp
  JOIN LATERAL (
    SELECT
      generation,
      transmission,
      system_loss,
      distribution,
      universal_charges,
      fit_all,
      vat_rate
    FROM meralco_rates
    WHERE effective_month <= wp.recorded_date
    ORDER BY effective_month DESC
    LIMIT 1
  ) mr ON true
),
cycle_totals AS (
  SELECT
    device_id,
    user_id,
    cycle_start_date,
    SUM(delta_kwh)::numeric AS usage_kwh,
    SUM(delta_spend_php)::numeric AS variable_spend_php
  FROM priced_deltas
  GROUP BY device_id, user_id, cycle_start_date
),
latest_cycle_readings AS (
  SELECT DISTINCT ON (device_id)
    device_id,
    cycle_start_date,
    energy_kwh AS last_energy_kwh,
    recorded_at AS last_recorded_at
  FROM minute_deduped
  ORDER BY device_id, recorded_at DESC
)
INSERT INTO device_month_usage (
  device_id,
  user_id,
  month_start,
  usage_kwh,
  variable_spend_php,
  last_energy_kwh,
  last_recorded_at,
  updated_at
)
SELECT
  ct.device_id,
  ct.user_id,
  ct.cycle_start_date,
  COALESCE(ct.usage_kwh, 0),
  COALESCE(ct.variable_spend_php, 0),
  lcr.last_energy_kwh,
  lcr.last_recorded_at,
  NOW()
FROM cycle_totals ct
JOIN latest_cycle_readings lcr
  ON lcr.device_id = ct.device_id
  AND lcr.cycle_start_date = ct.cycle_start_date
ON CONFLICT (device_id, month_start)
DO UPDATE SET
  user_id = EXCLUDED.user_id,
  usage_kwh = EXCLUDED.usage_kwh,
  variable_spend_php = EXCLUDED.variable_spend_php,
  last_energy_kwh = EXCLUDED.last_energy_kwh,
  last_recorded_at = EXCLUDED.last_recorded_at,
  updated_at = NOW();
