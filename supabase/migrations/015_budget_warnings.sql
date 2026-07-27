-- Budget warning events at 80%, 90%, and 100% of each device limit.
-- Runs after the smart-budget accumulator so it observes current spend.

ALTER TABLE device_budget_events
  DROP CONSTRAINT IF EXISTS device_budget_events_event_type_check;

ALTER TABLE device_budget_events
  ADD CONSTRAINT device_budget_events_event_type_check
  CHECK (event_type IN ('budget_warning', 'approval_required', 'auto_cutoff'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_budget_warning_dedup
  ON device_budget_events(device_id, month_start, event_type, threshold_php)
  WHERE event_type = 'budget_warning';

CREATE OR REPLACE FUNCTION record_device_budget_warnings()
RETURNS TRIGGER AS $$
DECLARE
  target_device devices%ROWTYPE;
  cycle_start DATE;
  billing_start_day INTEGER := 1;
  warning_threshold NUMERIC;
  warning_message TEXT;
BEGIN
  SELECT * INTO target_device
  FROM devices
  WHERE id::text = NEW.device_id OR mac_address = NEW.device_id
  LIMIT 1;

  IF NOT FOUND OR target_device.user_approved_limit_php IS NULL
     OR target_device.user_approved_limit_php <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(billing_cycle_start_day, 1) INTO billing_start_day
  FROM profiles
  WHERE id = COALESCE(target_device.owner_id, target_device.user_id);

  cycle_start := (NEW.recorded_at AT TIME ZONE 'Asia/Manila')::date;
  IF EXTRACT(DAY FROM cycle_start)::integer >= billing_start_day THEN
    cycle_start := date_trunc('month', cycle_start::timestamp)::date + (billing_start_day - 1);
  ELSE
    cycle_start := (date_trunc('month', cycle_start::timestamp) - interval '1 month')::date + (billing_start_day - 1);
  END IF;

  FOR warning_threshold IN SELECT unnest(ARRAY[0.80::numeric, 0.90::numeric, 1.00::numeric]) LOOP
    IF NEW.energy_kwh IS NULL THEN
      CONTINUE;
    END IF;

    SELECT CASE
      WHEN warning_threshold = 0.80 THEN 'You have reached 80% of this appliance limit.'
      WHEN warning_threshold = 0.90 THEN 'You have reached 90% of this appliance limit.'
      ELSE 'You have reached 100% of this appliance limit.'
    END INTO warning_message;

    INSERT INTO device_budget_events (
      device_id, user_id, month_start, event_type, threshold_php,
      spend_php, usage_kwh, message
    )
    SELECT
      target_device.id,
      COALESCE(target_device.owner_id, target_device.user_id),
      cycle_start,
      'budget_warning',
      target_device.user_approved_limit_php * warning_threshold,
      dmu.variable_spend_php,
      dmu.usage_kwh,
      warning_message
    FROM device_month_usage dmu
    WHERE dmu.device_id = target_device.id
      AND dmu.month_start = cycle_start
      AND dmu.variable_spend_php >= target_device.user_approved_limit_php * warning_threshold
      AND COALESCE(target_device.owner_id, target_device.user_id) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM device_budget_events existing
        WHERE existing.device_id = target_device.id
          AND existing.month_start = cycle_start
          AND existing.event_type = 'budget_warning'
          AND existing.threshold_php = target_device.user_approved_limit_php * warning_threshold
      );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS zz_energy_log_budget_warning ON energy_logs;
CREATE TRIGGER zz_energy_log_budget_warning
  AFTER INSERT ON energy_logs
  FOR EACH ROW
  EXECUTE FUNCTION record_device_budget_warnings();
