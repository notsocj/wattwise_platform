-- Qualify device_month_usage columns that conflict with RETURNS TABLE output names.

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

  SELECT COALESCE(dmu.variable_spend_php, 0), COALESCE(dmu.usage_kwh, 0)
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
    DELETE FROM public.device_budget_events e
    WHERE e.device_id = p_device_id AND e.month_start = cycle_start
      AND e.event_type IN ('approval_required', 'auto_cutoff');
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
    DELETE FROM public.device_budget_events e
    WHERE e.device_id = p_device_id AND e.month_start = cycle_start
      AND e.event_type IN ('approval_required', 'auto_cutoff');
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
  SELECT COALESCE(dmu.variable_spend_php, 0) INTO spend
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
