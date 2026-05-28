-- ============================================================
-- 014_multi_tenant_manager_tenant.sql
-- Additive multi-tenant rollout:
--   - owner_id mirrors legacy devices.user_id for v1 compatibility.
--   - tenant_id grants read-only assigned-room access.
--   - manager-created tenant accounts use profiles.manager_id and
--     profiles.must_update_password.
-- ============================================================

-- ── Profiles role expansion / tenant metadata ───────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS must_update_password BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'manager', 'tenant', 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_profiles_manager_id
  ON profiles(manager_id);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role TEXT := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
  safe_role TEXT := CASE
    WHEN requested_role IN ('user', 'manager') THEN requested_role
    ELSE 'user'
  END;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    safe_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    role = CASE
      WHEN profiles.role = 'user' AND EXCLUDED.role = 'manager' THEN 'manager'
      ELSE profiles.role
    END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Device ownership split ──────────────────────────────────
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

UPDATE devices
SET owner_id = user_id
WHERE owner_id IS NULL
  AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_devices_owner_id
  ON devices(owner_id);

CREATE INDEX IF NOT EXISTS idx_devices_tenant_id
  ON devices(tenant_id);

CREATE OR REPLACE FUNCTION sync_device_owner_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.owner_id := NEW.user_id;
  END IF;

  IF NEW.user_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    NEW.user_id := NEW.owner_id;
  END IF;

  IF NEW.owner_id IS NOT NULL THEN
    NEW.user_id := NEW.owner_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_device_owner_columns_before_write ON devices;

CREATE TRIGGER sync_device_owner_columns_before_write
  BEFORE INSERT OR UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION sync_device_owner_columns();

CREATE OR REPLACE FUNCTION current_profile_role()
RETURNS text AS $$
  SELECT role
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_access_device(target_device devices)
RETURNS boolean AS $$
  SELECT
    current_profile_role() = 'super_admin'
    OR target_device.owner_id = auth.uid()
    OR target_device.user_id = auth.uid()
    OR target_device.tenant_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── RLS policy refresh ──────────────────────────────────────
DROP POLICY IF EXISTS "users_select_own_profile" ON profiles;
CREATE POLICY "users_select_own_profile" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR manager_id = auth.uid()
    OR current_profile_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;
CREATE POLICY "users_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users_select_own_devices" ON devices;
DROP POLICY IF EXISTS "users_insert_own_devices" ON devices;
DROP POLICY IF EXISTS "users_update_own_devices" ON devices;
DROP POLICY IF EXISTS "users_delete_own_devices" ON devices;
DROP POLICY IF EXISTS "users_select_accessible_devices" ON devices;
DROP POLICY IF EXISTS "owners_insert_devices" ON devices;
DROP POLICY IF EXISTS "owners_update_devices" ON devices;
DROP POLICY IF EXISTS "owners_delete_devices" ON devices;

CREATE POLICY "users_select_accessible_devices" ON devices
  FOR SELECT USING (can_access_device(devices));

CREATE POLICY "owners_insert_devices" ON devices
  FOR INSERT WITH CHECK (
    current_profile_role() IN ('user', 'manager', 'super_admin')
    AND COALESCE(owner_id, user_id) = auth.uid()
  );

CREATE POLICY "owners_update_devices" ON devices
  FOR UPDATE USING (
    current_profile_role() = 'super_admin'
    OR (
      current_profile_role() IN ('user', 'manager')
      AND COALESCE(owner_id, user_id) = auth.uid()
    )
  )
  WITH CHECK (
    current_profile_role() = 'super_admin'
    OR (
      current_profile_role() IN ('user', 'manager')
      AND COALESCE(owner_id, user_id) = auth.uid()
    )
  );

CREATE POLICY "owners_delete_devices" ON devices
  FOR DELETE USING (
    current_profile_role() = 'super_admin'
    OR (
      current_profile_role() IN ('user', 'manager')
      AND COALESCE(owner_id, user_id) = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users_select_own_energy_logs" ON energy_logs;
DROP POLICY IF EXISTS "users_select_accessible_energy_logs" ON energy_logs;
CREATE POLICY "users_select_accessible_energy_logs" ON energy_logs
  FOR SELECT USING (
    current_profile_role() = 'super_admin'
    OR EXISTS (
      SELECT 1
      FROM devices d
      WHERE (energy_logs.device_id = d.id::text OR energy_logs.device_id = d.mac_address)
        AND (
          d.owner_id = auth.uid()
          OR d.user_id = auth.uid()
          OR d.tenant_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "users_select_own_ai_insights" ON ai_insights;
CREATE POLICY "users_select_own_ai_insights" ON ai_insights
  FOR SELECT USING (user_id = auth.uid() OR current_profile_role() = 'super_admin');

DROP POLICY IF EXISTS "users_select_own_device_month_usage" ON device_month_usage;
DROP POLICY IF EXISTS "users_select_accessible_device_month_usage" ON device_month_usage;
CREATE POLICY "users_select_accessible_device_month_usage" ON device_month_usage
  FOR SELECT USING (
    current_profile_role() = 'super_admin'
    OR EXISTS (
      SELECT 1
      FROM devices d
      WHERE d.id = device_month_usage.device_id
        AND (
          d.owner_id = auth.uid()
          OR d.user_id = auth.uid()
          OR d.tenant_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "users_select_own_device_budget_events" ON device_budget_events;
DROP POLICY IF EXISTS "users_select_accessible_device_budget_events" ON device_budget_events;
CREATE POLICY "users_select_accessible_device_budget_events" ON device_budget_events
  FOR SELECT USING (
    current_profile_role() = 'super_admin'
    OR EXISTS (
      SELECT 1
      FROM devices d
      WHERE d.id = device_budget_events.device_id
        AND (
          d.owner_id = auth.uid()
          OR d.user_id = auth.uid()
          OR d.tenant_id = auth.uid()
        )
    )
  );

-- ── Role-aware telemetry RPCs ───────────────────────────────
DROP FUNCTION IF EXISTS get_latest_device_readings(uuid);
DROP FUNCTION IF EXISTS get_hourly_averages(uuid, date);
DROP FUNCTION IF EXISTS get_usage_kwh_by_device(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS get_usage_kwh_by_device_day(uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION get_latest_device_readings(p_user_id uuid)
RETURNS TABLE (
  device_id     text,
  average_watts numeric,
  voltage_v     numeric,
  current_a     numeric,
  energy_kwh    numeric,
  recorded_at   timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (d.id)
    d.id::text AS device_id,
    el.average_watts,
    el.voltage_v,
    el.current_a,
    el.energy_kwh,
    el.recorded_at
  FROM energy_logs el
  JOIN devices d
    ON (el.device_id = d.id::text OR el.device_id = d.mac_address)
  WHERE d.owner_id = p_user_id
    OR d.user_id = p_user_id
    OR d.tenant_id = p_user_id
  ORDER BY d.id, el.recorded_at DESC;
$$;

CREATE OR REPLACE FUNCTION get_hourly_averages(
  p_user_id uuid,
  p_date    date
)
RETURNS TABLE (
  hour_key  integer,
  avg_watts numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    EXTRACT(HOUR FROM el.recorded_at AT TIME ZONE 'Asia/Manila')::integer AS hour_key,
    AVG(el.average_watts)::numeric AS avg_watts
  FROM energy_logs el
  JOIN devices d
    ON (el.device_id = d.id::text OR el.device_id = d.mac_address)
  WHERE (
      d.owner_id = p_user_id
      OR d.user_id = p_user_id
      OR d.tenant_id = p_user_id
    )
    AND (el.recorded_at AT TIME ZONE 'Asia/Manila')::date = p_date
    AND el.average_watts IS NOT NULL
  GROUP BY hour_key
  ORDER BY hour_key;
$$;

CREATE OR REPLACE FUNCTION get_usage_kwh_by_device(
  p_user_id uuid,
  p_start   timestamptz,
  p_end     timestamptz
)
RETURNS TABLE (
  device_id  text,
  usage_kwh  numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH ordered_logs AS (
    SELECT
      d.id::text AS device_id,
      el.energy_kwh,
      el.recorded_at,
      date_trunc('minute', el.recorded_at) AS minute_bucket
    FROM energy_logs el
    JOIN devices d
      ON (el.device_id = d.id::text OR el.device_id = d.mac_address)
    WHERE (
        d.owner_id = p_user_id
        OR d.user_id = p_user_id
        OR d.tenant_id = p_user_id
      )
      AND el.recorded_at >= p_start
      AND el.recorded_at <= p_end
  ),
  minute_deduped AS (
    SELECT DISTINCT ON (device_id, minute_bucket)
      device_id,
      energy_kwh,
      recorded_at,
      minute_bucket
    FROM ordered_logs
    ORDER BY device_id, minute_bucket, recorded_at DESC
  ),
  with_prev AS (
    SELECT
      device_id,
      energy_kwh,
      LAG(energy_kwh) OVER (
        PARTITION BY device_id ORDER BY recorded_at
      ) AS prev_kwh
    FROM minute_deduped
  ),
  deltas AS (
    SELECT
      device_id,
      CASE
        WHEN prev_kwh IS NULL          THEN 0
        WHEN energy_kwh - prev_kwh < 0 THEN 0
        ELSE energy_kwh - prev_kwh
      END AS delta_kwh
    FROM with_prev
  )
  SELECT device_id, SUM(delta_kwh)::numeric AS usage_kwh
  FROM deltas
  GROUP BY device_id;
$$;

CREATE OR REPLACE FUNCTION get_usage_kwh_by_device_day(
  p_user_id uuid,
  p_start   timestamptz,
  p_end     timestamptz
)
RETURNS TABLE (
  device_id  text,
  day_key    text,
  usage_kwh  numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH ordered_logs AS (
    SELECT
      d.id::text AS device_id,
      el.energy_kwh,
      el.recorded_at,
      date_trunc('minute', el.recorded_at) AS minute_bucket,
      to_char(el.recorded_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS day_key
    FROM energy_logs el
    JOIN devices d
      ON (el.device_id = d.id::text OR el.device_id = d.mac_address)
    WHERE (
        d.owner_id = p_user_id
        OR d.user_id = p_user_id
        OR d.tenant_id = p_user_id
      )
      AND el.recorded_at >= p_start
      AND el.recorded_at <= p_end
  ),
  minute_deduped AS (
    SELECT DISTINCT ON (device_id, minute_bucket)
      device_id,
      energy_kwh,
      recorded_at,
      day_key
    FROM ordered_logs
    ORDER BY device_id, minute_bucket, recorded_at DESC
  ),
  with_prev AS (
    SELECT
      device_id,
      energy_kwh,
      day_key,
      LAG(energy_kwh) OVER (
        PARTITION BY device_id ORDER BY recorded_at
      ) AS prev_kwh
    FROM minute_deduped
  ),
  deltas AS (
    SELECT
      device_id,
      day_key,
      CASE
        WHEN prev_kwh IS NULL          THEN 0
        WHEN energy_kwh - prev_kwh < 0 THEN 0
        ELSE energy_kwh - prev_kwh
      END AS delta_kwh
    FROM with_prev
  )
  SELECT device_id, day_key, SUM(delta_kwh)::numeric AS usage_kwh
  FROM deltas
  GROUP BY device_id, day_key;
$$;

-- ── Smart budget trigger now keys owner billing cycle ───────
CREATE OR REPLACE FUNCTION handle_energy_log_smart_budget()
RETURNS TRIGGER AS $$
DECLARE
  target_device devices%ROWTYPE;
  billing_start_day INTEGER := 1;
  owner_profile_id UUID;
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

  owner_profile_id := COALESCE(target_device.owner_id, target_device.user_id);

  IF owner_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(billing_cycle_start_day, 1)
  INTO billing_start_day
  FROM profiles
  WHERE id = owner_profile_id;

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
    owner_profile_id,
    cycle_start_date,
    delta_kwh,
    variable_spend,
    NEW.energy_kwh,
    NEW.recorded_at,
    NOW()
  )
  ON CONFLICT (device_id, month_start)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
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
      owner_profile_id,
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
      owner_profile_id,
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
