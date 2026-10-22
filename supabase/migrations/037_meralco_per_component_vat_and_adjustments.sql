-- Bill like Meralco: per-component VAT and the schedule's per-kWh adjustments.
--
-- WattWise multiplied every per-kWh component by one VAT rate and ignored the
-- schedule's adjustment columns. Meralco's Summary Schedule of Rates instead:
--   * applies monthly effective VAT rates to Generation, Transmission, and
--     Ancillary Service, the general rate ("Other Charges", vat_rate) to
--     distribution, supply, metering, and the AWAT / regulatory reset /
--     lifeline rate / senior citizen adjustments, and no VAT to System Loss,
--     Universal Charge, FIT-All, GEA-All, RPT, and the lifeline subsidy;
--   * adds AWAT refunds, a regulatory reset fees adjustment, RPT charges, the
--     non-lifeline lifeline subsidy, and other per-kWh adjustments.
-- For October 2026 (101-200 kWh) this is PHP 14.8761/kWh instead of the
-- PHP 16.5860/kWh WattWise computed.
--
-- The app mirrors this formula in lib/meralco-bill.ts; change both together.
-- Rows recorded before this migration keep 0 adjustments and NULL component
-- VAT (falling back to vat_rate), except August-October 2026, which are
-- backfilled from Meralco's published schedules.

ALTER TABLE public.meralco_rates
  ADD COLUMN IF NOT EXISTS awat_adjustment NUMERIC(10, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS regulatory_reset_adjustment NUMERIC(10, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifeline_rate_adjustment NUMERIC(10, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS senior_citizen_subsidy NUMERIC(10, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rpt_charge NUMERIC(10, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gea_all NUMERIC(10, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifeline_subsidy NUMERIC(10, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_generation NUMERIC(6, 4),
  ADD COLUMN IF NOT EXISTS vat_transmission NUMERIC(6, 4),
  ADD COLUMN IF NOT EXISTS vat_ancillary NUMERIC(6, 4);

COMMENT ON COLUMN public.meralco_rates.awat_adjustment IS 'AWAT (Refund)/Collect 1 + 2, PHP per kWh; negative is a refund. Subject to the general VAT rate.';
COMMENT ON COLUMN public.meralco_rates.regulatory_reset_adjustment IS 'Regulatory Reset Fees Adjustment, PHP per kWh. Subject to the general VAT rate.';
COMMENT ON COLUMN public.meralco_rates.lifeline_rate_adjustment IS 'Lifeline Rate Adjustment for non-lifeline customers, PHP per kWh. Subject to the general VAT rate.';
COMMENT ON COLUMN public.meralco_rates.senior_citizen_subsidy IS 'Senior Citizen Subsidy, PHP per kWh. Subject to the general VAT rate.';
COMMENT ON COLUMN public.meralco_rates.rpt_charge IS 'RPT Charge + RPT Adj, PHP per kWh. Not subject to VAT.';
COMMENT ON COLUMN public.meralco_rates.gea_all IS 'GEA-All (Renewable), PHP per kWh. Not subject to VAT.';
COMMENT ON COLUMN public.meralco_rates.lifeline_subsidy IS 'Lifeline Subsidy paid by non-lifeline customers, PHP per kWh. Not subject to VAT.';
COMMENT ON COLUMN public.meralco_rates.vat_generation IS 'Effective VAT rate on Generation (e.g. 0.0833). NULL falls back to vat_rate.';
COMMENT ON COLUMN public.meralco_rates.vat_transmission IS 'Effective VAT rate on Transmission. NULL falls back to vat_rate.';
COMMENT ON COLUMN public.meralco_rates.vat_ancillary IS 'Effective VAT rate on Ancillary Service. NULL falls back to vat_rate.';

-- Values from the residential 101-200 kWh row and VAT table of each month's
-- Summary Schedule of Rates (meralcomain.s3.ap-southeast-1.amazonaws.com).
UPDATE public.meralco_rates SET
  awat_adjustment = -1.0139, regulatory_reset_adjustment = -0.0023,
  lifeline_rate_adjustment = -0.0001, senior_citizen_subsidy = -0.0004,
  rpt_charge = 0.0082, gea_all = 0, lifeline_subsidy = 0.0100,
  vat_generation = 0.1059, vat_transmission = 0.1199, vat_ancillary = 0.1009
WHERE effective_month = DATE '2026-08-01';

UPDATE public.meralco_rates SET
  awat_adjustment = -1.0139, regulatory_reset_adjustment = -0.0023,
  lifeline_rate_adjustment = -0.0001, senior_citizen_subsidy = 0.0001,
  rpt_charge = 0.0082, gea_all = 0, lifeline_subsidy = 0.0100,
  vat_generation = 0.0921, vat_transmission = 0.1199, vat_ancillary = 0.0983
WHERE effective_month = DATE '2026-09-01';

UPDATE public.meralco_rates SET
  awat_adjustment = -1.0139, regulatory_reset_adjustment = -0.0023,
  lifeline_rate_adjustment = 0, senior_citizen_subsidy = 0.0001,
  rpt_charge = 0.0082, gea_all = 0, lifeline_subsidy = 0.0100,
  vat_generation = 0.0833, vat_transmission = 0.1199, vat_ancillary = 0.0909
WHERE effective_month = DATE '2026-10-01';

-- VAT-inclusive variable cost of one kWh for a rate row.
CREATE OR REPLACE FUNCTION public.meralco_variable_rate_per_kwh(r public.meralco_rates)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
      r.generation * (1 + COALESCE(r.vat_generation, r.vat_rate))
    + r.transmission * (1 + COALESCE(r.vat_transmission, r.vat_rate))
    + r.ancillary_service * (1 + COALESCE(r.vat_ancillary, r.vat_rate))
    + (r.distribution + r.supply_rate + r.metering_rate
        + r.awat_adjustment + r.regulatory_reset_adjustment
        + r.lifeline_rate_adjustment + r.senior_citizen_subsidy) * (1 + r.vat_rate)
    + r.system_loss + r.universal_charges + r.fit_all
    + r.gea_all + r.rpt_charge + r.lifeline_subsidy;
$$;

-- Budget cutoffs price each reading with the same formula. The rest of the
-- trigger is unchanged from the production definition.
CREATE OR REPLACE FUNCTION public.handle_energy_log_smart_budget()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_device public.devices%ROWTYPE;
  owner_profile_id uuid;
  billing_start_day integer := 1;
  recorded_date_ph date;
  cycle_start_date date;
  previous_kwh numeric;
  delta_kwh numeric;
  rate_per_kwh numeric;
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

  SELECT public.meralco_variable_rate_per_kwh(m)
  INTO rate_per_kwh
  FROM public.meralco_rates m
  WHERE m.effective_month <= recorded_date_ph
  ORDER BY m.effective_month DESC LIMIT 1;

  IF rate_per_kwh IS NULL THEN RETURN NEW; END IF;

  SELECT last_energy_kwh INTO previous_kwh
  FROM public.device_month_usage
  WHERE device_id = target_device.id AND month_start = cycle_start_date
  FOR UPDATE;

  IF previous_kwh IS NULL OR NEW.energy_kwh < previous_kwh THEN
    delta_kwh := 0;
  ELSE
    delta_kwh := NEW.energy_kwh - previous_kwh;
  END IF;

  variable_spend := ROUND((delta_kwh * rate_per_kwh)::numeric, 2);

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
$function$;
