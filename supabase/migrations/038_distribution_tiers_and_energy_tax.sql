-- Residential distribution tiers and energy tax for high-usage homes.
--
-- Meralco charges one distribution rate on ALL of a home's kWh, picked by the
-- home's total monthly consumption (October 2026: 0.9803 up to 200 kWh,
-- 1.2908 for 201-300, 1.5837 for 301-400, 2.0941 above 400), plus energy tax
-- above 650 kWh (BP 36: 0.10/kWh for the next 350, 0.20 for the next 500,
-- 0.35 beyond 1,500; no VAT). Verified against Meralco's "Residential Bills
-- at Typical Consumption Levels" for October 2026 (300, 500, 1,000 kWh).
--
-- The household's monthly kWh comes from profiles.meralco_monthly_kwh (the
-- homeowner's Meralco bill) when set, otherwise from the monitored devices'
-- usage this billing cycle projected to the full cycle. The app reads the same
-- number through my_household_usage(); lib/meralco-bill.ts mirrors the rate.

ALTER TABLE public.meralco_rates
  ADD COLUMN IF NOT EXISTS distribution_201_300 NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS distribution_301_400 NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS distribution_over_400 NUMERIC(10, 4);

COMMENT ON COLUMN public.meralco_rates.distribution IS 'Residential distribution rate, PHP per kWh, for homes using up to 200 kWh a month.';
COMMENT ON COLUMN public.meralco_rates.distribution_201_300 IS 'Distribution rate on all kWh for homes using 201-300 kWh a month. NULL falls back to distribution.';
COMMENT ON COLUMN public.meralco_rates.distribution_301_400 IS 'Distribution rate on all kWh for homes using 301-400 kWh a month. NULL falls back to distribution.';
COMMENT ON COLUMN public.meralco_rates.distribution_over_400 IS 'Distribution rate on all kWh for homes using over 400 kWh a month. NULL falls back to distribution.';

UPDATE public.meralco_rates
SET distribution_201_300 = 1.2908, distribution_301_400 = 1.5837, distribution_over_400 = 2.0941
WHERE effective_month IN (DATE '2026-08-01', DATE '2026-09-01', DATE '2026-10-01');

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS meralco_monthly_kwh NUMERIC(8, 2)
    CHECK (meralco_monthly_kwh IS NULL OR (meralco_monthly_kwh > 0 AND meralco_monthly_kwh <= 100000));

COMMENT ON COLUMN public.profiles.meralco_monthly_kwh IS 'Optional typical monthly household kWh from the homeowner''s Meralco bill; picks the distribution tier and energy tax.';

-- Household monthly kWh for an owner at a point in time. Internal: used by the
-- budget trigger and service-role code, not exposed to clients.
CREATE OR REPLACE FUNCTION public.household_monthly_kwh_for(p_owner uuid, p_as_of timestamptz)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bill_kwh numeric;
  start_day integer := 1;
  as_of_date date := (p_as_of AT TIME ZONE 'Asia/Manila')::date;
  cycle_start date;
  cycle_days integer;
  elapsed_days integer;
  used_kwh numeric;
BEGIN
  SELECT meralco_monthly_kwh, COALESCE(billing_cycle_start_day, 1)
  INTO bill_kwh, start_day
  FROM public.profiles WHERE id = p_owner;

  IF bill_kwh IS NOT NULL AND bill_kwh > 0 THEN
    RETURN bill_kwh;
  END IF;

  -- Same billing-cycle boundaries as handle_energy_log_smart_budget().
  IF EXTRACT(day FROM as_of_date)::integer >= start_day THEN
    cycle_start := date_trunc('month', as_of_date::timestamp)::date + (start_day - 1);
  ELSE
    cycle_start := (date_trunc('month', as_of_date::timestamp) - interval '1 month')::date + (start_day - 1);
  END IF;
  cycle_days := (cycle_start + interval '1 month')::date - cycle_start;
  elapsed_days := GREATEST(as_of_date - cycle_start + 1, 1);

  SELECT COALESCE(SUM(usage_kwh), 0) INTO used_kwh
  FROM public.device_month_usage
  WHERE user_id = p_owner AND month_start = cycle_start;

  -- NULL (not 0) when there is no meaningful usage yet: base tier applies.
  RETURN NULLIF(GREATEST(ROUND(used_kwh / elapsed_days * cycle_days, 2), 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.household_monthly_kwh_for(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- The signed-in user's household usage (a tenant's household is their
-- landlord's account). Returns only the caller's own figure.
CREATE OR REPLACE FUNCTION public.my_household_usage()
RETURNS TABLE (monthly_kwh numeric, source text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
  bill_kwh numeric;
  kwh numeric;
BEGIN
  SELECT CASE WHEN p.role = 'tenant' AND p.manager_id IS NOT NULL THEN p.manager_id ELSE p.id END
  INTO owner_id
  FROM public.profiles p WHERE p.id = auth.uid();

  IF owner_id IS NULL THEN
    RETURN;
  END IF;

  SELECT meralco_monthly_kwh INTO bill_kwh FROM public.profiles WHERE id = owner_id;
  kwh := public.household_monthly_kwh_for(owner_id, now());
  IF kwh IS NULL THEN
    RETURN;
  END IF;

  monthly_kwh := kwh;
  source := CASE WHEN bill_kwh IS NOT NULL AND bill_kwh > 0 THEN 'bill' ELSE 'projected' END;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.my_household_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_household_usage() TO authenticated;

-- VAT-inclusive variable cost of one kWh for a rate row and a household's
-- monthly kWh (NULL: base distribution tier, no energy tax).
DROP FUNCTION IF EXISTS public.meralco_variable_rate_per_kwh(public.meralco_rates);
CREATE OR REPLACE FUNCTION public.meralco_variable_rate_per_kwh(
  r public.meralco_rates,
  p_household_kwh numeric DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  WITH h AS (
    SELECT CASE WHEN p_household_kwh IS NULL OR p_household_kwh <= 0 THEN NULL ELSE p_household_kwh END AS kwh
  ),
  d AS (
    SELECT
      CASE
        WHEN h.kwh IS NULL OR h.kwh <= 200 THEN r.distribution
        WHEN h.kwh <= 300 THEN COALESCE(r.distribution_201_300, r.distribution)
        WHEN h.kwh <= 400 THEN COALESCE(r.distribution_301_400, r.distribution)
        ELSE COALESCE(r.distribution_over_400, r.distribution)
      END AS distribution,
      CASE
        WHEN h.kwh IS NULL THEN 0
        ELSE (
            0.10 * LEAST(GREATEST(h.kwh - 650, 0), 350)
          + 0.20 * LEAST(GREATEST(h.kwh - 1000, 0), 500)
          + 0.35 * GREATEST(h.kwh - 1500, 0)
        ) / h.kwh
      END AS energy_tax
    FROM h
  )
  SELECT
      r.generation * (1 + COALESCE(r.vat_generation, r.vat_rate))
    + r.transmission * (1 + COALESCE(r.vat_transmission, r.vat_rate))
    + r.ancillary_service * (1 + COALESCE(r.vat_ancillary, r.vat_rate))
    + (d.distribution + r.supply_rate + r.metering_rate
        + r.awat_adjustment + r.regulatory_reset_adjustment
        + r.lifeline_rate_adjustment + r.senior_citizen_subsidy) * (1 + r.vat_rate)
    + r.system_loss + r.universal_charges + r.fit_all
    + r.gea_all + r.rpt_charge + r.lifeline_subsidy
    + d.energy_tax
  FROM d;
$$;

-- Budget cutoffs price each reading at the owner's household tier. The rest
-- of the trigger is unchanged from migration 037.
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

  SELECT public.meralco_variable_rate_per_kwh(
    m, public.household_monthly_kwh_for(owner_profile_id, NEW.recorded_at)
  )
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
