---
description: Canonical Supabase schema context for Wattwise. Use this when writing queries, migrations, API routes, RPC consumers, telemetry flows, or Smart Control logic so implementation stays aligned with the real migration history.
applyTo: "**"
---

# Wattwise Platform — Supabase Schema Context

This file reflects the current database shape defined by `supabase/migrations/001` through `024`. Treat the migration files as the source of truth; this document is the working reference for application and API development.

## Current Schema Summary

Wattwise currently relies on these core database objects:

- Tables: `profiles`, `meralco_rates`, `devices`, `energy_logs`, `ai_insights`
- Smart Control tables: `device_month_usage`, `device_budget_events`
- Admin/sync table: `meralco_rate_sync_runs`
- Admin demo table: `demo_device_simulations`
- RPCs: `get_latest_device_readings`, `get_usage_kwh_by_device`, `get_usage_kwh_by_device_day`, `get_hourly_averages`
- Triggers/functions: `handle_new_user`, `handle_energy_log_smart_budget`

### `demo_device_simulations`

Stores super-admin controlled virtual WattWise meters for demos and testing. Each row belongs to a normal `devices` row and the Edge Function writes the same cumulative payload contract to `energy_logs` as real ESP32 hardware.

- The virtual device uses a locally administered MAC address starting with `02:DE:`.
- Only the server-side super-admin APIs may create, assign, start, pause, reset, or run a simulation.
- `simulate-demo-units` runs only active units and advances `energy_kwh` from `simulated_watts` and elapsed time (capped at ten minutes per invocation).
- Resetting a simulation resets its future meter baseline; it intentionally does not delete historical `energy_logs`.

## Core Tables

### `profiles`

Extends Supabase Auth with Wattwise-specific user metadata.

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role VARCHAR(20) DEFAULT 'user',
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  must_update_password BOOLEAN NOT NULL DEFAULT false,
  monthly_budget_php NUMERIC(10, 2) DEFAULT 2000.00,
  billing_cycle_start_day INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Notes:

- `role` supports `user`, `manager`, `tenant`, and `super_admin`
- `manager_id` links manager-created tenants to the manager who can assign them to room sub-meters
- `must_update_password` forces manager-created tenants through `/update-password` after first login
- Public registration may request only `user` or `manager`; `handle_new_user()` sanitizes auth metadata and defaults all other requested roles to `user`
- `monthly_budget_php` is the home-level wallet budget edited from the Home dashboard flow only
- `billing_cycle_start_day` is the user-level Meralco reading day used for billing-cycle windows and Smart Control accumulation
- `billing_cycle_start_day` must stay between `1` and `28`
- `handle_new_user()` auto-creates a `profiles` row after `auth.users` insert

### `meralco_rates`

Stores the billing-grade Meralco rate components. This is the only valid source for cost math.

```sql
CREATE TABLE meralco_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  effective_month DATE NOT NULL UNIQUE,
  vat_rate NUMERIC(6, 4) NOT NULL,
  generation NUMERIC(10, 4) NOT NULL,
  transmission NUMERIC(10, 4) NOT NULL,
  system_loss NUMERIC(10, 4) NOT NULL,
  distribution NUMERIC(10, 4) NOT NULL,
  universal_charges NUMERIC(10, 4) NOT NULL,
  fit_all NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
  metering_charge NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
  supply_charge NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Notes:

- `fit_all` is a first-class column as of migration `008`
- application cost logic must use unbundled components plus fixed charges, then apply VAT last
- do not fall back to hardcoded runtime rates when a row is missing

### `devices`

Represents paired ESP32-S3 devices plus appliance-profile and Smart Control metadata.

```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  device_name TEXT NOT NULL,
  mac_address TEXT UNIQUE NOT NULL,
  is_online BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  relay_state BOOLEAN DEFAULT false,
  appliance_type TEXT,
  daily_usage_hours NUMERIC(4, 1),
  suggested_monthly_limit_php NUMERIC(10, 2),
  user_approved_limit_php NUMERIC(10, 2),
  require_approval_on_expiry BOOLEAN NOT NULL DEFAULT false,
  budget_status TEXT NOT NULL DEFAULT 'ok',
  budget_breached_at TIMESTAMP WITH TIME ZONE,
  relay_auto_disabled_at TIMESTAMP WITH TIME ZONE,
  profiled_baseline_watts NUMERIC(10, 2),
  profiled_voltage_v NUMERIC(10, 2),
  profiled_current_a NUMERIC(10, 2),
  profiled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Constraints from migrations:

- `appliance_type` check:
  - `refrigerator`
  - `aircon`
  - `tv`
  - `other`
- `budget_status` check:
  - `ok`
  - `approval_required`
  - `auto_cutoff`
- positive-value checks:
  - `user_approved_limit_php IS NULL OR user_approved_limit_php > 0`
  - `suggested_monthly_limit_php IS NULL OR suggested_monthly_limit_php > 0`

Important behavior:

- `relay_state` is polled by hardware every 5 seconds
- `daily_usage_hours` is the current appliance-profiler hours field; do not add a duplicate `estimated_daily_hours` column
- `owner_id` is the manager/user who physically owns and pairs the ESP32 hardware
- `tenant_id` is the optional renter currently assigned to the room/sub-meter
- `user_id` remains as a v1 compatibility mirror of `owner_id`; new application code should read/write `owner_id`
- `user_approved_limit_php` is the owner/manager hard limit; tenants must never edit it
- Add Appliance registers the device first so the ESP32 can post MAC-based telemetry before AI profiling completes
- New devices default to `require_approval_on_expiry = true`, exposed to application clients as `auto_cutoff_enabled = false`; existing rows retain their stored preference.

### `energy_logs`

High-volume telemetry table for cumulative kWh and live metrology.

```sql
CREATE TABLE energy_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT NOT NULL,
  energy_kwh NUMERIC(10, 4) NOT NULL,
  average_watts NUMERIC(10, 2),
  voltage_v NUMERIC(10, 2),
  current_a NUMERIC(10, 2),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_energy_logs_device_time
  ON energy_logs(device_id, recorded_at DESC);
```

Notes:

- `device_id` is intentionally `TEXT` during the transition period
- it may contain either `devices.id::text` or legacy `devices.mac_address`
- all ownership joins and lookup logic must support both formats
- never query this table unbounded; always use a hard limit or bounded time range

### `ai_insights`

Cache table for OpenAI-generated insight payloads and token accounting.

```sql
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_insights_user_type_date
  ON ai_insights(user_id, insight_type, created_at DESC);
```

Notes:

- the table shape is text-based, but the app may store normalized JSON as a serialized string inside `message`
- the insights route uses trigger-and-cache behavior; check for recent cached rows before generating a new response
- token fields support AI cost/admin observability

## Smart Control Tables

### `device_month_usage`

Custom billing-cycle per-device accumulator used by the Smart Control trigger.

```sql
CREATE TABLE device_month_usage (
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

CREATE INDEX idx_device_month_usage_user_month
  ON device_month_usage(user_id, month_start);
```

Purpose:

- avoids rescanning raw `energy_logs` on every insert
- stores per-device billing-cycle usage and variable Meralco spend
- budget enforcement excludes fixed monthly charges by design
- `month_start` remains the column name for compatibility, but since migration `013` it stores the billing-cycle start date, not necessarily the first day of a calendar month

### `device_budget_events`

Audit and alert feed for Smart Control budget actions.

```sql
CREATE TABLE device_budget_events (
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

CREATE INDEX idx_device_budget_events_user_created
  ON device_budget_events(user_id, created_at DESC);

CREATE INDEX idx_device_budget_events_device_month
  ON device_budget_events(device_id, month_start, event_type);
```

Constraint:

- `event_type IN ('budget_warning', 'approval_required', 'auto_cutoff')`
- migration `025_budget_alert_policy.sql` adds `threshold_percent` (1–100)
- `budget_warning` is deduplicated at 50% and 80%; `approval_required` or `auto_cutoff` is the single terminal 100% event

Purpose:

- records whether Wattwise asked for approval or automatically cut power
- supports alert UIs and audit visibility
- `apply_device_budget_settings(uuid, numeric, boolean)` atomically reconciles limit/cutoff preference with current-cycle spend
- `restore_device_power(uuid, boolean)` is the only owner/manager recovery path for an automatic cutoff; it never bypasses an enabled cutoff whose limit remains reached
- migration `026_fix_budget_rpc_ambiguity.sql` qualifies accumulator columns in both budget RPCs for PostgreSQL `RETURNS TABLE` compatibility

## Admin / Automation Table

### `meralco_rate_sync_runs`

Observability log for the Supabase Edge Function that syncs Meralco rates.

```sql
CREATE TABLE meralco_rate_sync_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  source_url TEXT NOT NULL,
  pdf_url TEXT,
  effective_month DATE,
  raw_rates JSONB,
  warnings TEXT[] DEFAULT '{}',
  ran_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_meralco_sync_runs_ran_at
  ON meralco_rate_sync_runs(ran_at DESC);
```

Notes:

- `status` currently records values such as `success`, `skipped`, and `failed`
- rows are written by the Edge Function with service-role privileges
- only `super_admin` can read these rows under RLS

## Functions and Triggers

### `handle_new_user()`

Trigger function attached to `auth.users` that inserts a matching row into `public.profiles`.

Important behavior:

- copies `NEW.email`
- reads `NEW.raw_user_meta_data->>'full_name'`
- uses `ON CONFLICT (id) DO NOTHING`

### `get_latest_device_readings(p_user_id uuid)`

Returns the latest telemetry row for each owned device.

Returned columns:

- `device_id`
- `average_watts`
- `voltage_v`
- `current_a`
- `energy_kwh`
- `recorded_at`

Use cases:

- dashboard live cards
- device-detail live metrology

### `get_usage_kwh_by_device(p_user_id, p_start, p_end)`

Billing-grade usage RPC for a bounded range.

Behavior:

- joins owned devices by UUID text or MAC address
- deduplicates to one row per device per minute
- computes usage from cumulative kWh deltas
- clamps negative/reset drift to `0`

### `get_usage_kwh_by_device_day(p_user_id, p_start, p_end)`

Daily grouped version of the billing-grade usage RPC.

Behavior:

- same cumulative-delta logic as `get_usage_kwh_by_device`
- groups by Manila-local `day_key` (`YYYY-MM-DD`)

### `get_hourly_averages(p_user_id, p_date)`

Returns average wattage by hour-of-day for a Manila-local date.

Returned columns:

- `hour_key`
- `avg_watts`

Use cases:

- Home dashboard hourly chart

### `handle_energy_log_smart_budget()`

Trigger function executed `AFTER INSERT` on `energy_logs`.

Behavior:

- resolves the target device using either `devices.id::text` or `devices.mac_address`
- fetches `profiles.billing_cycle_start_day` for the owning user
- derives the Manila-local billing-cycle start date
- loads the latest applicable `meralco_rates` row for the reading date
- computes variable spend from the cumulative kWh delta only
- upserts into `device_month_usage`
- compares `variable_spend_php` against `devices.user_approved_limit_php`
- if `require_approval_on_expiry = true`, records `approval_required`
- otherwise sets `devices.relay_state = false` and records `auto_cutoff`

Important guardrails:

- if no device matches the incoming `device_id`, telemetry is still accepted
- if no Meralco rate row is available, telemetry is still accepted and automation is skipped
- duplicate budget events for the same device/month/type are prevented

## RLS Summary

### Enabled tables

RLS is enabled on:

- `profiles`
- `meralco_rates`
- `devices`
- `energy_logs`
- `ai_insights`
- `meralco_rate_sync_runs`
- `device_month_usage`
- `device_budget_events`

### Standard authenticated-user access

Users can:

- select, insert, update their own `profiles` row
- select `meralco_rates`
- select, insert, update, delete their own `devices`
- select `energy_logs` that belong to their owned devices, matching by UUID text or MAC
- select their own `ai_insights`
- select their own `device_month_usage`
- select their own `device_budget_events`

### Super admin access

`super_admin` users can select:

- `profiles`
- `meralco_rates`
- `devices`
- `energy_logs`
- `ai_insights`
- `meralco_rate_sync_runs`
- `device_month_usage`
- `device_budget_events`

`super_admin` users can also:

- insert and update `meralco_rates`

### Hardware anon access

The `anon` role is intentionally allowed to support ESP32 hardware:

- `INSERT` into `energy_logs` only when `device_id` matches a registered `devices.mac_address`
- `SELECT` from `devices` so hardware can poll `relay_state` by MAC address

Important caution:

- the anon device policy is permissive at the row-policy level (`USING (true)`) and relies on the REST query filtering to only expose the requested row and selected columns

## Query and Implementation Rules

### Billing

- never compute billable cost with a flat multiplier like `kWh * 10`
- always fetch the active `meralco_rates` row
- include the correct unbundled components
- apply VAT last
- fixed monthly charges belong to home-level bill context, not per-device Smart Control cutoff logic

### Telemetry

- keep compatibility with both `devices.id::text` and `devices.mac_address`
- bound all `energy_logs` reads by time or `LIMIT`
- prefer RPCs for billing-grade usage totals and charts

### AI and caching

- all OpenAI calls stay server-side
- insight routes should check `ai_insights` for a recent cached row before generating
- if storing structured insight payloads, serialize them into `ai_insights.message`
- manager AI insight cards use `manager_fleet_alert`, `manager_room_anomaly`, `manager_cutoff_forecast`, and `manager_cost_optimizer` as `ai_insights.insight_type` values
- manager AI and chatbot routes must scope data to manager-owned devices only; chatbot replies are advisory and must not mutate relays, limits, tenants, or assignments

### Service-role routes

- manager tenant creation requires `SUPABASE_SERVICE_ROLE_KEY` server-side; `SUPABASE_SECRET_KEY` remains a backward-compatible fallback name
- service-role clients must never be imported into client components

### Smart Control

- billing-cycle boundaries are based on `profiles.billing_cycle_start_day` in `Asia/Manila`
- compare `device_month_usage.variable_spend_php` against `devices.user_approved_limit_php`
- `require_approval_on_expiry = true` must not auto-disable relay power
- keep Supabase Realtime enabled for `energy_logs` when working on live telemetry UX

## Common Query Patterns

### Latest live telemetry for owned devices

```sql
SELECT * FROM get_latest_device_readings($1);
```

### Accurate device usage for a bounded range

```sql
SELECT * FROM get_usage_kwh_by_device(
  p_user_id := $1,
  p_start := $2,
  p_end := $3
);
```

### Accurate per-day usage for a bounded range

```sql
SELECT * FROM get_usage_kwh_by_device_day(
  p_user_id := $1,
  p_start := $2,
  p_end := $3
);
```

### Hourly average watts for one Manila-local date

```sql
SELECT * FROM get_hourly_averages($1, $2);
```

### Current device-cycle accumulator rows

```sql
SELECT *
FROM device_month_usage
WHERE user_id = $1
  AND month_start = $2;
```

Usage note:

- `$2` should be the current billing-cycle start date computed from `profiles.billing_cycle_start_day`, not `date_trunc('month', ...)`

### Recent device budget events

```sql
SELECT *
FROM device_budget_events
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 50;
```

### Current active Meralco rates

```sql
SELECT *
FROM meralco_rates
WHERE effective_month <= CURRENT_DATE
ORDER BY effective_month DESC
LIMIT 1;
```

### Cached insight lookup

```sql
SELECT message
FROM ai_insights
WHERE user_id = $1
  AND insight_type = $2
ORDER BY created_at DESC
LIMIT 1;
```

### Update Home wallet budget

```sql
UPDATE profiles
SET monthly_budget_php = $2
WHERE id = $1;
```

Usage note:

- `$1` must be the authenticated profile id
- this update should only be exposed from the Home dashboard wallet flow
