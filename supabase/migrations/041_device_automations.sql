-- Device automations: scheduled turn-offs.
--
-- An owner (usually through the customer assistant, after confirming) asks
-- WattWise to turn a device off:
--   * time  - at a set time ("turn off the aircon at 1 AM");
--   * spend - after it spends PHP X more, counted from when the rule was made;
--   * usage - after it uses X kWh more, counted from when the rule was made.
-- Spend and usage rules stop at ends_at ("tonight" = until 6 AM). A time rule
-- may still fire up to an hour late (ends_at = run_at + 1 hour) and then expires.
--
-- Automations only ever turn devices OFF. run_device_automations() runs every
-- 15 seconds from pg_cron, outside the energy_logs insert path. Spend comes
-- from device_month_usage, which the budget trigger already prices with the
-- full Meralco formula, so there is no second rate calculation here.

CREATE TABLE IF NOT EXISTS public.device_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trigger_type text NOT NULL CHECK (trigger_type IN ('time', 'spend', 'usage')),
  run_at timestamptz,
  threshold numeric(14, 6),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'cancelled', 'expired')),
  -- Progress for spend/usage rules, accumulated from device_month_usage deltas.
  consumed_kwh numeric(14, 6) NOT NULL DEFAULT 0,
  consumed_php numeric(14, 6) NOT NULL DEFAULT 0,
  last_usage_kwh numeric(14, 6),
  last_spend_php numeric(14, 6),
  last_month_start date,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT device_automations_trigger_fields CHECK (
    (trigger_type = 'time' AND run_at IS NOT NULL AND threshold IS NULL)
    OR (trigger_type IN ('spend', 'usage') AND run_at IS NULL AND threshold > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_device_automations_active
  ON public.device_automations (created_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_device_automations_device
  ON public.device_automations (device_id, created_at DESC);

ALTER TABLE public.device_automations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.device_automations FROM anon;

-- Owners read the automations on their devices. Writes go through the
-- SECURITY DEFINER functions below only (no insert/update/delete policies).
DROP POLICY IF EXISTS "owners_select_device_automations" ON public.device_automations;
CREATE POLICY "owners_select_device_automations" ON public.device_automations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = device_automations.device_id
        AND (d.owner_id = (SELECT auth.uid()) OR d.user_id = (SELECT auth.uid()))
    )
  );

-- Create a rule for a device the caller owns. Validates the trigger, caps the
-- window at 7 days and 5 active rules per device, and snapshots the device's
-- current usage so spend/usage count from now.
CREATE OR REPLACE FUNCTION public.create_device_automation(
  p_device_id uuid,
  p_trigger text,
  p_run_at timestamptz,
  p_threshold numeric,
  p_ends_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller uuid := (SELECT auth.uid());
  caller_role text;
  usage_row record;
  has_usage boolean;
  run_time timestamptz;
  end_time timestamptz;
  limit_value numeric;
  new_id uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Sign in to schedule an automation.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = caller;
  IF caller_role IS DISTINCT FROM 'user' THEN
    RAISE EXCEPTION 'Only the device owner can schedule automations.' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.devices
  WHERE id = p_device_id AND (owner_id = caller OR user_id = caller);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That device is not on your account.' USING ERRCODE = '42501';
  END IF;

  IF p_trigger = 'time' THEN
    IF p_run_at IS NULL OR p_run_at <= now() OR p_run_at > now() + interval '7 days' THEN
      RAISE EXCEPTION 'Pick a time within the next 7 days.' USING ERRCODE = '22023';
    END IF;
    run_time := p_run_at;
    end_time := p_run_at + interval '1 hour';
    limit_value := NULL;
  ELSIF p_trigger IN ('spend', 'usage') THEN
    IF p_threshold IS NULL OR p_threshold <= 0
       OR (p_trigger = 'spend' AND p_threshold > 9999999.99)
       OR (p_trigger = 'usage' AND p_threshold > 100000) THEN
      RAISE EXCEPTION 'Enter an amount above zero.' USING ERRCODE = '22023';
    END IF;
    IF p_ends_at IS NULL OR p_ends_at <= now() OR p_ends_at > now() + interval '7 days' THEN
      RAISE EXCEPTION 'Pick an end time within the next 7 days.' USING ERRCODE = '22023';
    END IF;
    run_time := NULL;
    end_time := p_ends_at;
    limit_value := p_threshold;
  ELSE
    RAISE EXCEPTION 'Unknown automation type.' USING ERRCODE = '22023';
  END IF;

  IF (SELECT count(*) FROM public.device_automations
      WHERE device_id = p_device_id AND status = 'active') >= 5 THEN
    RAISE EXCEPTION 'This device already has 5 scheduled automations. Cancel one first.' USING ERRCODE = 'P0001';
  END IF;

  SELECT usage_kwh, variable_spend_php, month_start INTO usage_row
  FROM public.device_month_usage
  WHERE device_id = p_device_id
  ORDER BY month_start DESC
  LIMIT 1;
  has_usage := FOUND;

  INSERT INTO public.device_automations (
    device_id, created_by, trigger_type, run_at, threshold, ends_at,
    last_usage_kwh, last_spend_php, last_month_start
  ) VALUES (
    p_device_id, caller, p_trigger, run_time, limit_value, end_time,
    CASE WHEN has_usage THEN usage_row.usage_kwh END,
    CASE WHEN has_usage THEN usage_row.variable_spend_php END,
    CASE WHEN has_usage THEN usage_row.month_start END
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

-- Cancel an active rule on a device the caller owns. Returns false when there
-- was nothing active to cancel.
CREATE OR REPLACE FUNCTION public.cancel_device_automation(p_automation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller uuid := (SELECT auth.uid());
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Sign in to cancel an automation.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.device_automations a
  SET status = 'cancelled', ended_at = now()
  WHERE a.id = p_automation_id
    AND a.status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = a.device_id AND (d.owner_id = caller OR d.user_id = caller)
    );
  RETURN FOUND;
END;
$function$;

-- The scheduler. Fires due rules (relay OFF), tracks spend/usage progress,
-- and expires rules whose window closed.
CREATE OR REPLACE FUNCTION public.run_device_automations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rule public.device_automations%ROWTYPE;
  usage_row record;
  delta_kwh numeric;
  delta_php numeric;
  total_kwh numeric;
  total_php numeric;
  should_fire boolean;
BEGIN
  FOR rule IN
    SELECT * FROM public.device_automations
    WHERE status = 'active'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    should_fire := false;

    IF rule.trigger_type = 'time' THEN
      should_fire := rule.run_at <= now() AND now() < rule.ends_at;
    ELSE
      SELECT usage_kwh, variable_spend_php, month_start INTO usage_row
      FROM public.device_month_usage
      WHERE device_id = rule.device_id
      ORDER BY month_start DESC
      LIMIT 1;

      IF FOUND THEN
        IF rule.last_month_start IS NULL THEN
          -- No usage row existed when the rule was made: count from here.
          delta_kwh := 0;
          delta_php := 0;
        ELSIF usage_row.month_start = rule.last_month_start THEN
          delta_kwh := GREATEST(usage_row.usage_kwh - rule.last_usage_kwh, 0);
          delta_php := GREATEST(usage_row.variable_spend_php - rule.last_spend_php, 0);
        ELSE
          -- The billing cycle rolled over: the new cycle row started from zero.
          delta_kwh := GREATEST(usage_row.usage_kwh, 0);
          delta_php := GREATEST(usage_row.variable_spend_php, 0);
        END IF;

        UPDATE public.device_automations
        SET consumed_kwh = consumed_kwh + delta_kwh,
            consumed_php = consumed_php + delta_php,
            last_usage_kwh = usage_row.usage_kwh,
            last_spend_php = usage_row.variable_spend_php,
            last_month_start = usage_row.month_start
        WHERE id = rule.id
        RETURNING consumed_kwh, consumed_php INTO total_kwh, total_php;

        should_fire := now() < rule.ends_at AND (
          (rule.trigger_type = 'spend' AND total_php >= rule.threshold)
          OR (rule.trigger_type = 'usage' AND total_kwh >= rule.threshold)
        );
      END IF;
    END IF;

    IF should_fire THEN
      UPDATE public.devices SET relay_state = false WHERE id = rule.device_id;
      UPDATE public.device_automations
      SET status = 'done', executed_at = now(), ended_at = now()
      WHERE id = rule.id;
    ELSIF rule.ends_at <= now() THEN
      UPDATE public.device_automations
      SET status = 'expired', ended_at = now()
      WHERE id = rule.id;
    END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_device_automation(uuid, text, timestamptz, numeric, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_device_automation(uuid, text, timestamptz, numeric, timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_device_automation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_device_automation(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.run_device_automations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_device_automations() TO service_role;

-- cron.schedule with an existing job name updates that job, so this is safe to re-run.
SELECT cron.schedule('run-device-automations', '15 seconds', 'SELECT public.run_device_automations()');
