-- ============================================================
-- 012_smart_budget_controls.sql
-- Adds per-device smart budget controls, monthly usage
-- accumulators, and a telemetry INSERT trigger that can
-- automatically turn relays off when a user-approved monthly
-- appliance limit is reached.
--
-- Budget basis:
--   - Calendar month in Asia/Manila
--   - Per-device variable Meralco spend only
--   - Fixed monthly charges remain home-level UI context
-- ============================================================

-- ── Device budget/profile metadata ──────────────────────────
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS suggested_monthly_limit_php NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS user_approved_limit_php NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS require_approval_on_expiry BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS budget_status TEXT NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS budget_breached_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS relay_auto_disabled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS profiled_baseline_watts NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS profiled_voltage_v NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS profiled_current_a NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS profiled_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE devices
  DROP CONSTRAINT IF EXISTS devices_budget_status_check;

ALTER TABLE devices
  ADD CONSTRAINT devices_budget_status_check
  CHECK (budget_status IN ('ok', 'approval_required', 'auto_cutoff'));

ALTER TABLE devices
  DROP CONSTRAINT IF EXISTS devices_user_approved_limit_positive_check;

ALTER TABLE devices
  ADD CONSTRAINT devices_user_approved_limit_positive_check
  CHECK (user_approved_limit_php IS NULL OR user_approved_limit_php > 0);

ALTER TABLE devices
  DROP CONSTRAINT IF EXISTS devices_suggested_limit_positive_check;

ALTER TABLE devices
  ADD CONSTRAINT devices_suggested_limit_positive_check
  CHECK (suggested_monthly_limit_php IS NULL OR suggested_monthly_limit_php > 0);

-- ── Monthly per-device accumulator ───────────────────────────
CREATE TABLE IF NOT EXISTS device_month_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  month_start DATE NOT NULL,
  usage_kwh NUMERIC(12, 4) NOT NULL DEFAULT 0,
  variable_spend_php NUMERIC(12, 2) NOT NULL DEFAULT 0,
  last_energy_kwh NUMERIC(12, 4),
  last_recorded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (device_id, month_start)
);

CREATE INDEX IF NOT EXISTS idx_device_month_usage_user_month
  ON device_month_usage(user_id, month_start);

ALTER TABLE device_month_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_device_month_usage" ON device_month_usage;
CREATE POLICY "users_select_own_device_month_usage" ON device_month_usage
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "super_admin_select_device_month_usage" ON device_month_usage;
CREATE POLICY "super_admin_select_device_month_usage" ON device_month_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ── Budget event feed / audit trail ─────────────────────────
CREATE TABLE IF NOT EXISTS device_budget_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  month_start DATE NOT NULL,
  event_type TEXT NOT NULL,
  threshold_php NUMERIC(10, 2),
  spend_php NUMERIC(12, 2) NOT NULL,
  usage_kwh NUMERIC(12, 4) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE device_budget_events
  DROP CONSTRAINT IF EXISTS device_budget_events_event_type_check;

ALTER TABLE device_budget_events
  ADD CONSTRAINT device_budget_events_event_type_check
  CHECK (event_type IN ('approval_required', 'auto_cutoff'));

CREATE INDEX IF NOT EXISTS idx_device_budget_events_user_created
  ON device_budget_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_budget_events_device_month
  ON device_budget_events(device_id, month_start, event_type);

ALTER TABLE device_budget_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_device_budget_events" ON device_budget_events;
CREATE POLICY "users_select_own_device_budget_events" ON device_budget_events
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "super_admin_select_device_budget_events" ON device_budget_events;
CREATE POLICY "super_admin_select_device_budget_events" ON device_budget_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ── Trigger implementation ──────────────────────────────────
CREATE OR REPLACE FUNCTION handle_energy_log_smart_budget()
RETURNS TRIGGER AS $$
DECLARE
  target_device devices%ROWTYPE;
  month_start_ph DATE;
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

  month_start_ph := date_trunc('month', NEW.recorded_at AT TIME ZONE 'Asia/Manila')::date;

  SELECT
    generation + transmission + system_loss + distribution + universal_charges + fit_all,
    1 + vat_rate
  INTO subtotal_per_kwh, vat_multiplier
  FROM meralco_rates
  WHERE effective_month <= (NEW.recorded_at AT TIME ZONE 'Asia/Manila')::date
  ORDER BY effective_month DESC
  LIMIT 1;

  -- If rates are not ready, preserve telemetry ingestion and skip budget automation.
  IF subtotal_per_kwh IS NULL OR vat_multiplier IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT last_energy_kwh
  INTO previous_kwh
  FROM device_month_usage
  WHERE device_id = target_device.id
    AND month_start = month_start_ph
  FOR UPDATE;

  IF previous_kwh IS NULL THEN
    delta_kwh := 0;
  ELSIF NEW.energy_kwh >= previous_kwh THEN
    delta_kwh := NEW.energy_kwh - previous_kwh;
  ELSE
    -- Reset/jitter guard: do not add negative deltas.
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
    month_start_ph,
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
      month_start_ph,
      'approval_required',
      target_device.user_approved_limit_php,
      updated_spend,
      updated_usage,
      event_message
    WHERE NOT EXISTS (
      SELECT 1
      FROM device_budget_events
      WHERE device_id = target_device.id
        AND month_start = month_start_ph
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
      month_start_ph,
      'auto_cutoff',
      target_device.user_approved_limit_php,
      updated_spend,
      updated_usage,
      event_message
    WHERE NOT EXISTS (
      SELECT 1
      FROM device_budget_events
      WHERE device_id = target_device.id
        AND month_start = month_start_ph
        AND event_type = 'auto_cutoff'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_energy_log_smart_budget ON energy_logs;

CREATE TRIGGER on_energy_log_smart_budget
  AFTER INSERT ON energy_logs
  FOR EACH ROW
  EXECUTE FUNCTION handle_energy_log_smart_budget();
