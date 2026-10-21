-- Align WattWise's rate model with Meralco's current residential schedule.
-- Meralco publishes Ancillary Service, Supply, and Metering as distinct
-- per-kWh columns; Supply Cust and Metering Cust are separate fixed charges.

ALTER TABLE public.meralco_rates
  ADD COLUMN IF NOT EXISTS ancillary_service NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN IF NOT EXISTS supply_rate NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN IF NOT EXISTS metering_rate NUMERIC(10, 4) NOT NULL DEFAULT 0.0000;

COMMENT ON COLUMN public.meralco_rates.ancillary_service IS
  'Ancillary Service Charge in PHP per kWh.';
COMMENT ON COLUMN public.meralco_rates.supply_rate IS
  'Variable Supply Charge in PHP per kWh; distinct from supply_charge fixed per-customer amount.';
COMMENT ON COLUMN public.meralco_rates.metering_rate IS
  'Variable Metering Charge in PHP per kWh; distinct from metering_charge fixed per-customer amount.';

-- Correct the auto-synced August 2026 row using Meralco's non-lifeline
-- residential 100-kWh schedule. The previous parser was shifted by the
-- Ancillary Service column and stored variable charges as fixed charges.
UPDATE public.meralco_rates
SET
  generation = 9.2800,
  transmission = 0.5125,
  ancillary_service = 1.0685,
  system_loss = 0.9218,
  distribution = 0.9803,
  supply_rate = 0.4979,
  supply_charge = 16.38,
  metering_rate = 0.3350,
  metering_charge = 5.00,
  universal_charges = 0.3216,
  fit_all = 0.3359
WHERE effective_month = DATE '2026-08-01';

-- Keep Smart Control pricing aligned with the application billing helper.
CREATE OR REPLACE FUNCTION public.handle_energy_log_smart_budget()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_device public.devices%ROWTYPE;
  owner_profile_id uuid;
  billing_start_day integer := 1;
  recorded_date_ph date;
  cycle_start_date date;
  previous_kwh numeric;
  delta_kwh numeric;
  subtotal_per_kwh numeric;
  vat_multiplier numeric;
  variable_spend numeric;
  updated_usage numeric;
  updated_spend numeric;
  event_message text;
BEGIN
  SELECT * INTO target_device
  FROM public.devices
  WHERE id::text = NEW.device_id OR mac_address = NEW.device_id
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  owner_profile_id := COALESCE(target_device.owner_id, target_device.user_id);
  IF owner_profile_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(billing_cycle_start_day, 1) INTO billing_start_day
  FROM public.profiles WHERE id = owner_profile_id;

  recorded_date_ph := (NEW.recorded_at AT TIME ZONE 'Asia/Manila')::date;
  IF EXTRACT(day FROM recorded_date_ph)::integer >= billing_start_day THEN
    cycle_start_date := date_trunc('month', recorded_date_ph::timestamp)::date + (billing_start_day - 1);
  ELSE
    cycle_start_date := (date_trunc('month', recorded_date_ph::timestamp) - interval '1 month')::date + (billing_start_day - 1);
  END IF;

  SELECT
    generation + transmission + ancillary_service + system_loss + distribution
      + supply_rate + metering_rate + universal_charges + fit_all,
    1 + vat_rate
  INTO subtotal_per_kwh, vat_multiplier
  FROM public.meralco_rates
  WHERE effective_month <= recorded_date_ph
  ORDER BY effective_month DESC LIMIT 1;

  IF subtotal_per_kwh IS NULL OR vat_multiplier IS NULL THEN RETURN NEW; END IF;

  SELECT last_energy_kwh INTO previous_kwh
  FROM public.device_month_usage
  WHERE device_id = target_device.id AND month_start = cycle_start_date
  FOR UPDATE;

  IF previous_kwh IS NULL OR NEW.energy_kwh < previous_kwh THEN
    delta_kwh := 0;
  ELSE
    delta_kwh := NEW.energy_kwh - previous_kwh;
  END IF;

  variable_spend := ROUND((delta_kwh * subtotal_per_kwh * vat_multiplier)::numeric, 2);

  INSERT INTO public.device_month_usage (
    device_id, user_id, month_start, usage_kwh, variable_spend_php,
    last_energy_kwh, last_recorded_at, updated_at
  ) VALUES (
    target_device.id, owner_profile_id, cycle_start_date, delta_kwh,
    variable_spend, NEW.energy_kwh, NEW.recorded_at, now()
  )
  ON CONFLICT (device_id, month_start) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    usage_kwh = device_month_usage.usage_kwh + EXCLUDED.usage_kwh,
    variable_spend_php = device_month_usage.variable_spend_php + EXCLUDED.variable_spend_php,
    last_energy_kwh = EXCLUDED.last_energy_kwh,
    last_recorded_at = EXCLUDED.last_recorded_at,
    updated_at = now()
  RETURNING usage_kwh, variable_spend_php INTO updated_usage, updated_spend;

  IF target_device.budget_status = 'approval_required'
     AND target_device.budget_breached_at IS NOT NULL
     AND (target_device.budget_breached_at AT TIME ZONE 'Asia/Manila')::date < cycle_start_date THEN
    UPDATE public.devices
    SET budget_status = 'ok', budget_breached_at = NULL
    WHERE id = target_device.id;
    target_device.budget_status := 'ok';
  END IF;

  IF target_device.user_approved_limit_php IS NULL
     OR target_device.user_approved_limit_php <= 0
     OR updated_spend < target_device.user_approved_limit_php
     OR target_device.budget_status IN ('approval_required', 'auto_cutoff') THEN
    RETURN NEW;
  END IF;

  IF target_device.require_approval_on_expiry THEN
    UPDATE public.devices SET
      budget_status = 'approval_required',
      budget_breached_at = COALESCE(budget_breached_at, now())
    WHERE id = target_device.id;
    event_message := '100% reached. Automatic shutoff is disabled; power remains on.';
  ELSE
    UPDATE public.devices SET
      relay_state = false,
      budget_status = 'auto_cutoff',
      budget_breached_at = COALESCE(budget_breached_at, now()),
      relay_auto_disabled_at = COALESCE(relay_auto_disabled_at, now())
    WHERE id = target_device.id;
    event_message := '100% reached. WattWise automatically turned this appliance off.';
  END IF;

  INSERT INTO public.device_budget_events (
    device_id, user_id, month_start, event_type, threshold_php,
    threshold_percent, spend_php, usage_kwh, message
  ) VALUES (
    target_device.id, owner_profile_id, cycle_start_date,
    CASE WHEN target_device.require_approval_on_expiry THEN 'approval_required' ELSE 'auto_cutoff' END,
    target_device.user_approved_limit_php, 100, updated_spend, updated_usage, event_message
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
