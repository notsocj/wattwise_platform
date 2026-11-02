-- Demo readiness and budget accuracy.
--
-- 1. device_month_usage.variable_spend_php keeps full precision. The budget
--    trigger used to round every 5-second reading to whole centavos, which
--    undercounted low-power appliances by up to a third.
-- 2. The trigger ignores kWh jumps that no 10 kW appliance could make in the
--    elapsed time (glitches or forged readings).
-- 3. Demo units are simulated in SQL every 10 seconds by pg_cron (replacing
--    the simulate-demo-units Edge Function, which only ran on a button press):
--    a running unit streams live readings; after a pause it first fills the
--    gap (up to 14 days) in 15-minute steps that follow the appliance's
--    profiled daily hours. A unit sends 0 W while its relay is off, and live
--    streaming pauses itself after 4 hours.

ALTER TABLE public.device_month_usage
  ALTER COLUMN variable_spend_php TYPE NUMERIC(14, 6);

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
  previous_at timestamptz;
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

  SELECT last_energy_kwh, last_recorded_at INTO previous_kwh, previous_at
  FROM public.device_month_usage
  WHERE device_id = target_device.id AND month_start = cycle_start_date
  FOR UPDATE;

  IF previous_kwh IS NULL OR NEW.energy_kwh < previous_kwh THEN
    delta_kwh := 0;
  ELSE
    delta_kwh := NEW.energy_kwh - previous_kwh;
  END IF;

  -- A jump no 10 kW appliance could make in the elapsed time is a glitch or a
  -- forged reading: count it as zero, like a meter reset.
  IF delta_kwh > 10 * GREATEST(EXTRACT(epoch FROM NEW.recorded_at - previous_at) / 3600.0, 0) + 0.01 THEN
    delta_kwh := 0;
  END IF;

  -- Not rounded per reading: a 1 Wh step is worth about PHP 0.015, and
  -- rounding each one to centavos lost up to a third of the spend.
  variable_spend := delta_kwh * rate_per_kwh;

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

ALTER TABLE public.demo_device_simulations
  ADD COLUMN IF NOT EXISTS live_since TIMESTAMPTZ,
  -- Full precision so 10-second steps of small loads do not round away.
  ALTER COLUMN energy_kwh TYPE NUMERIC(16, 6);

COMMENT ON COLUMN public.demo_device_simulations.live_since IS 'When the unit last came back online; live streaming pauses 4 hours later.';

CREATE OR REPLACE FUNCTION public.simulate_demo_units(p_device_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sim record;
  now_at timestamptz := clock_timestamp();
  from_at timestamptz;
  last_at timestamptz;
  energy numeric;
  watts numeric;
  came_online boolean;
  inserted integer := 0;
BEGIN
  -- The cron job and the admin "Run now" button must not interleave readings.
  IF NOT pg_try_advisory_xact_lock(hashtext('simulate_demo_units')) THEN
    RETURN 0;
  END IF;

  UPDATE public.demo_device_simulations
  SET is_active = false, updated_at = now_at
  WHERE is_active AND live_since < now_at - interval '4 hours';

  FOR sim IN
    SELECT s.device_id, s.simulated_watts, s.simulated_voltage_v, s.energy_kwh,
           s.last_generated_at, s.live_since, d.mac_address, d.relay_state,
           LEAST(GREATEST(COALESCE(d.daily_usage_hours, 4), 0.5), 24) AS usage_hours
    FROM public.demo_device_simulations s
    JOIN public.devices d ON d.id = s.device_id
    WHERE s.is_active AND d.mac_address IS NOT NULL
      AND (p_device_id IS NULL OR s.device_id = p_device_id)
  LOOP
    energy := sim.energy_kwh;
    last_at := GREATEST(
      COALESCE(sim.last_generated_at, now_at - interval '10 seconds'),
      now_at - interval '14 days'
    );
    came_online := now_at - last_at > interval '1 minute';

    IF came_online THEN
      -- Fill the gap like a home that kept running: on during the daily
      -- window that ends at 22:00 Manila time, with some day-to-day variation.
      WITH steps AS (
        SELECT t,
          CASE
            WHEN NOT sim.relay_state THEN 0
            WHEN sim.usage_hours >= 24
              OR mod((EXTRACT(hour FROM t AT TIME ZONE 'Asia/Manila')
                      + EXTRACT(minute FROM t AT TIME ZONE 'Asia/Manila') / 60.0
                      - 22 + sim.usage_hours + 48)::numeric, 24) < sim.usage_hours
            THEN sim.simulated_watts * (0.8 + 0.4 * (abs(hashtext(sim.device_id::text
                   || (t AT TIME ZONE 'Asia/Manila')::date::text)) % 1000) / 1000.0)
            ELSE 0
          END AS step_watts
        FROM generate_series(last_at + interval '15 minutes', now_at - interval '1 minute', interval '15 minutes') AS t
      ), readings AS (
        SELECT t, step_watts,
          energy + SUM(step_watts * 0.25 / 1000.0) OVER (ORDER BY t) AS step_energy
        FROM steps
      ), inserted_rows AS (
        INSERT INTO public.energy_logs (device_id, energy_kwh, average_watts, voltage_v, current_a, recorded_at)
        SELECT sim.mac_address, ROUND(step_energy, 4), ROUND(step_watts, 2), sim.simulated_voltage_v,
               ROUND(step_watts / NULLIF(sim.simulated_voltage_v, 0), 2), t
        FROM readings
        ORDER BY t
        RETURNING recorded_at, energy_kwh
      )
      SELECT COALESCE(MAX(recorded_at), last_at), COALESCE(MAX(energy_kwh), energy)
      INTO last_at, energy
      FROM inserted_rows;
    END IF;

    -- Live reading, at the unit's set wattage (0 W while the relay is off).
    watts := CASE WHEN sim.relay_state THEN sim.simulated_watts * (0.97 + random()::numeric * 0.06) ELSE 0 END;
    energy := energy + watts * EXTRACT(epoch FROM now_at - last_at) / 3600.0 / 1000.0;

    INSERT INTO public.energy_logs (device_id, energy_kwh, average_watts, voltage_v, current_a, recorded_at)
    VALUES (
      sim.mac_address, ROUND(energy, 4), ROUND(watts, 2),
      ROUND(sim.simulated_voltage_v * (0.99 + random()::numeric * 0.02), 1),
      ROUND(watts / NULLIF(sim.simulated_voltage_v, 0), 2), now_at
    );

    UPDATE public.demo_device_simulations
    SET energy_kwh = energy,
        last_generated_at = now_at,
        live_since = CASE WHEN came_online OR live_since IS NULL THEN now_at ELSE live_since END,
        updated_at = now_at
    WHERE device_id = sim.device_id;

    inserted := inserted + 1;
  END LOOP;

  RETURN inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.simulate_demo_units(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.simulate_demo_units(uuid) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule('simulate-demo-units', '10 seconds', 'SELECT public.simulate_demo_units()');
-- Keep the cron run log small; the demo job runs 8,640 times a day.
SELECT cron.schedule(
  'purge-cron-run-details', '17 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '1 day'$$
);
