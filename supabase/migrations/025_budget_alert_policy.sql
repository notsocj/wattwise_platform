-- Unified 50/80/100 budget alerts and opt-in automatic cutoff.
-- Existing device preferences are preserved; only newly inserted devices
-- default to alert-only mode through require_approval_on_expiry = true.

ALTER TABLE public.devices
  ALTER COLUMN require_approval_on_expiry SET DEFAULT true;

ALTER TABLE public.device_budget_events
  ADD COLUMN IF NOT EXISTS threshold_percent smallint;

UPDATE public.device_budget_events e
SET threshold_percent = CASE
  WHEN e.event_type IN ('approval_required', 'auto_cutoff') THEN 100
  WHEN e.message ILIKE '%90%%' THEN 90
  WHEN e.message ILIKE '%80%%' THEN 80
  WHEN e.message ILIKE '%50%%' THEN 50
  ELSE LEAST(100, GREATEST(1, ROUND((e.threshold_php / NULLIF(d.user_approved_limit_php, 0)) * 100)::integer))
END
FROM public.devices d
WHERE d.id = e.device_id
  AND e.threshold_percent IS NULL;

ALTER TABLE public.device_budget_events
  DROP CONSTRAINT IF EXISTS device_budget_events_threshold_percent_check;

ALTER TABLE public.device_budget_events
  ADD CONSTRAINT device_budget_events_threshold_percent_check
  CHECK (threshold_percent IS NULL OR threshold_percent BETWEEN 1 AND 100);

DROP INDEX IF EXISTS public.idx_device_budget_warning_dedup;

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_budget_warning_percent_dedup
  ON public.device_budget_events(device_id, month_start, event_type, threshold_percent)
  WHERE event_type = 'budget_warning';

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_budget_terminal_dedup
  ON public.device_budget_events(device_id, month_start, event_type)
  WHERE event_type IN ('approval_required', 'auto_cutoff');

CREATE OR REPLACE FUNCTION public.record_device_budget_warnings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_device public.devices%ROWTYPE;
  cycle_start date;
  billing_start_day integer := 1;
  warning_percent integer;
  warning_message text;
BEGIN
  SELECT * INTO target_device
  FROM public.devices
  WHERE id::text = NEW.device_id OR mac_address = NEW.device_id
  LIMIT 1;

  IF NOT FOUND OR target_device.user_approved_limit_php IS NULL
     OR target_device.user_approved_limit_php <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(billing_cycle_start_day, 1) INTO billing_start_day
  FROM public.profiles
  WHERE id = COALESCE(target_device.owner_id, target_device.user_id);

  cycle_start := (NEW.recorded_at AT TIME ZONE 'Asia/Manila')::date;
  IF EXTRACT(day FROM cycle_start)::integer >= billing_start_day THEN
    cycle_start := date_trunc('month', cycle_start::timestamp)::date + (billing_start_day - 1);
  ELSE
    cycle_start := (date_trunc('month', cycle_start::timestamp) - interval '1 month')::date + (billing_start_day - 1);
  END IF;

  FOREACH warning_percent IN ARRAY ARRAY[50, 80] LOOP
    warning_message := CASE warning_percent
      WHEN 50 THEN 'You have reached 50% of this appliance limit.'
      ELSE 'You have reached 80% of this appliance limit.'
    END;

    INSERT INTO public.device_budget_events (
      device_id, user_id, month_start, event_type, threshold_php,
      threshold_percent, spend_php, usage_kwh, message
    )
    SELECT
      target_device.id,
      COALESCE(target_device.owner_id, target_device.user_id),
      cycle_start,
      'budget_warning',
      ROUND(target_device.user_approved_limit_php * warning_percent / 100.0, 2),
      warning_percent,
      dmu.variable_spend_php,
      dmu.usage_kwh,
      warning_message
    FROM public.device_month_usage dmu
    WHERE dmu.device_id = target_device.id
      AND dmu.month_start = cycle_start
      AND dmu.variable_spend_php >= target_device.user_approved_limit_php * warning_percent / 100.0
      AND COALESCE(target_device.owner_id, target_device.user_id) IS NOT NULL
    ON CONFLICT (device_id, month_start, event_type, threshold_percent)
      WHERE event_type = 'budget_warning'
    DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

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

  SELECT generation + transmission + system_loss + distribution + universal_charges + fit_all,
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

  -- Approval-only state expires with its billing cycle. An automatic cutoff
  -- deliberately remains latched until the owner performs a manual restore.
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

CREATE OR REPLACE FUNCTION public.apply_device_budget_settings(
  p_device_id uuid,
  p_limit_php numeric,
  p_auto_cutoff_enabled boolean
)
RETURNS TABLE (
  device_id uuid,
  auto_cutoff_enabled boolean,
  relay_state boolean,
  budget_status text,
  current_spend_php numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.devices%ROWTYPE;
  billing_start_day integer := 1;
  cycle_start date;
  spend numeric := 0;
  usage numeric := 0;
BEGIN
  IF p_limit_php IS NULL OR p_limit_php <= 0 OR p_limit_php > 9999999.99 THEN
    RAISE EXCEPTION 'Approved limit must be a positive peso amount.';
  END IF;

  SELECT * INTO target FROM public.devices WHERE id = p_device_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL
     OR (
       public.current_profile_role() <> 'super_admin'
       AND NOT (target.owner_id = auth.uid() OR target.user_id = auth.uid())
     )
     OR public.current_profile_role() = 'tenant' THEN
    RAISE EXCEPTION 'Device not found or not manageable by this account.';
  END IF;

  SELECT COALESCE(billing_cycle_start_day, 1) INTO billing_start_day
  FROM public.profiles WHERE id = COALESCE(target.owner_id, target.user_id);
  cycle_start := (now() AT TIME ZONE 'Asia/Manila')::date;
  IF EXTRACT(day FROM cycle_start)::integer >= billing_start_day THEN
    cycle_start := date_trunc('month', cycle_start::timestamp)::date + (billing_start_day - 1);
  ELSE
    cycle_start := (date_trunc('month', cycle_start::timestamp) - interval '1 month')::date + (billing_start_day - 1);
  END IF;

  SELECT COALESCE(variable_spend_php, 0), COALESCE(usage_kwh, 0)
  INTO spend, usage FROM public.device_month_usage dmu
  WHERE dmu.device_id = p_device_id AND dmu.month_start = cycle_start;

  UPDATE public.devices SET
    user_approved_limit_php = ROUND(p_limit_php, 2),
    require_approval_on_expiry = NOT p_auto_cutoff_enabled
  WHERE id = p_device_id;

  IF spend >= p_limit_php AND p_auto_cutoff_enabled THEN
    UPDATE public.devices SET relay_state = false, budget_status = 'auto_cutoff',
      budget_breached_at = COALESCE(budget_breached_at, now()),
      relay_auto_disabled_at = COALESCE(relay_auto_disabled_at, now())
    WHERE id = p_device_id;
    DELETE FROM public.device_budget_events
    WHERE device_id = p_device_id AND month_start = cycle_start
      AND event_type IN ('approval_required', 'auto_cutoff');
    INSERT INTO public.device_budget_events (
      device_id, user_id, month_start, event_type, threshold_php,
      threshold_percent, spend_php, usage_kwh, message
    ) VALUES (
      p_device_id, COALESCE(target.owner_id, target.user_id), cycle_start,
      'auto_cutoff', ROUND(p_limit_php, 2), 100, spend, usage,
      '100% reached. WattWise automatically turned this appliance off.'
    ) ON CONFLICT DO NOTHING;
  ELSIF spend >= p_limit_php AND NOT p_auto_cutoff_enabled
        AND target.budget_status <> 'auto_cutoff' THEN
    UPDATE public.devices SET budget_status = 'approval_required',
      budget_breached_at = COALESCE(budget_breached_at, now())
    WHERE id = p_device_id;
    DELETE FROM public.device_budget_events
    WHERE device_id = p_device_id AND month_start = cycle_start
      AND event_type IN ('approval_required', 'auto_cutoff');
    INSERT INTO public.device_budget_events (
      device_id, user_id, month_start, event_type, threshold_php,
      threshold_percent, spend_php, usage_kwh, message
    ) VALUES (
      p_device_id, COALESCE(target.owner_id, target.user_id), cycle_start,
      'approval_required', ROUND(p_limit_php, 2), 100, spend, usage,
      '100% reached. Automatic shutoff is disabled; power remains on.'
    ) ON CONFLICT DO NOTHING;
  ELSIF spend < p_limit_php AND target.budget_status <> 'auto_cutoff' THEN
    UPDATE public.devices SET budget_status = 'ok', budget_breached_at = NULL
    WHERE id = p_device_id;
  END IF;

  RETURN QUERY SELECT d.id, NOT d.require_approval_on_expiry, d.relay_state,
    d.budget_status, spend
  FROM public.devices d WHERE d.id = p_device_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_device_power(
  p_device_id uuid,
  p_confirmed boolean
)
RETURNS TABLE (
  device_id uuid,
  relay_state boolean,
  budget_status text,
  current_spend_php numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.devices%ROWTYPE;
  billing_start_day integer := 1;
  cycle_start date;
  spend numeric := 0;
BEGIN
  IF p_confirmed IS NOT TRUE THEN RAISE EXCEPTION 'Power restoration must be confirmed.'; END IF;
  SELECT * INTO target FROM public.devices WHERE id = p_device_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL
     OR (
       public.current_profile_role() <> 'super_admin'
       AND NOT (target.owner_id = auth.uid() OR target.user_id = auth.uid())
     )
     OR public.current_profile_role() = 'tenant' THEN
    RAISE EXCEPTION 'Device not found or not manageable by this account.';
  END IF;

  SELECT COALESCE(billing_cycle_start_day, 1) INTO billing_start_day
  FROM public.profiles WHERE id = COALESCE(target.owner_id, target.user_id);
  cycle_start := (now() AT TIME ZONE 'Asia/Manila')::date;
  IF EXTRACT(day FROM cycle_start)::integer >= billing_start_day THEN
    cycle_start := date_trunc('month', cycle_start::timestamp)::date + (billing_start_day - 1);
  ELSE
    cycle_start := (date_trunc('month', cycle_start::timestamp) - interval '1 month')::date + (billing_start_day - 1);
  END IF;
  SELECT COALESCE(variable_spend_php, 0) INTO spend
  FROM public.device_month_usage dmu
  WHERE dmu.device_id = p_device_id AND dmu.month_start = cycle_start;

  IF NOT target.require_approval_on_expiry
     AND target.user_approved_limit_php IS NOT NULL
     AND spend >= target.user_approved_limit_php THEN
    RAISE EXCEPTION 'Disable automatic shutoff or raise the approved limit before restoring power.';
  END IF;

  UPDATE public.devices SET
    relay_state = true,
    budget_status = CASE
      WHEN user_approved_limit_php IS NOT NULL AND spend >= user_approved_limit_php
        THEN 'approval_required'
      ELSE 'ok'
    END,
    budget_breached_at = CASE
      WHEN user_approved_limit_php IS NOT NULL AND spend >= user_approved_limit_php
        THEN COALESCE(budget_breached_at, now())
      ELSE NULL
    END,
    relay_auto_disabled_at = NULL
  WHERE id = p_device_id;

  RETURN QUERY SELECT d.id, d.relay_state, d.budget_status, spend
  FROM public.devices d WHERE d.id = p_device_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_device_budget_settings(uuid, numeric, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_device_power(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_device_budget_settings(uuid, numeric, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_device_power(uuid, boolean) TO authenticated;
