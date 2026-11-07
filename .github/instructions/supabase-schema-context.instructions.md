---
description: Canonical Supabase schema context for Wattwise. Use this when writing queries, migrations, API routes, RPC consumers, telemetry flows, or Smart Control logic so implementation stays aligned with the real migration history.
applyTo: "**"
---

# Wattwise Platform — Supabase Schema Context

This file reflects the current database shape defined by `supabase/migrations/001` through `039`. Treat the migration files as the source of truth; this document is the working reference for application and API development. Migration files do not establish which versions are applied in a deployed environment (check `supabase migration list --linked`; deploys do not apply migrations).

## Current Schema Summary

All objects live in `public` unless noted. Extensions: `uuid-ossp` (`001`), `pg_cron` (`039`).

- Core tables: `profiles`, `meralco_rates`, `devices`, `energy_logs`, `ai_insights`
- Smart Control tables: `device_month_usage`, `device_budget_events`, `device_automations` (`041`)
- Notification / assistant tables: `notification_preferences`, `notification_deliveries`, `customer_ai_messages`, `public_chat_hits` (`042`)
- Admin / automation tables: `meralco_rate_sync_runs`, `admin_audit_logs`, `demo_device_simulations`
- Telemetry RPCs: `get_latest_device_readings`, `get_usage_kwh_by_device`, `get_usage_kwh_by_device_day`, `get_average_watts_by_device`, `get_device_usage_periods`, `get_hourly_averages`
- Billing / Smart Control functions: `meralco_variable_rate_per_kwh`, `household_monthly_kwh_for`, `my_household_usage`, `apply_device_budget_settings`, `restore_device_power`, `create_device_automation`, `cancel_device_automation`, `run_device_automations` (`041`)
- Other functions: `reserve_notification_test_delivery`, `simulate_demo_units`, `take_public_chat_slot` (`042`)
- RLS helpers: `current_profile_role`, `can_access_device`, `is_registered_device_mac`, `accessible_energy_log_device_keys`
- Trigger functions: `handle_new_user`, `guard_profile_privileged_columns`, `create_notification_preferences_for_profile`, `sync_device_owner_columns`, `update_device_last_seen`, `handle_energy_log_smart_budget`, `record_device_budget_warnings`, `touch_notification_preferences_updated_at`, `touch_notification_delivery_updated_at`
- pg_cron jobs: `simulate-demo-units`, `purge-cron-run-details`, `run-device-automations` (`041`)

Configured outside migrations (not reproducible from `supabase/migrations/`):

- the `supabase_realtime` publication membership for `energy_logs` and `devices`
- the Database Webhook that calls the `dispatch-budget-notifications` Edge Function after a `device_budget_events` INSERT
- the schedule of the `sync-meralco-rates` Edge Function

Maintenance note: a production data cleanup on 2026-11-07 deleted users and devices and kept `meralco_rates`; its backup schema `cleanup_backup_20261107` exists in the database but is not part of the migrations.

## Core Tables

### `profiles`

Extends Supabase Auth with Wattwise-specific user metadata.

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role VARCHAR(20) DEFAULT 'user'
    CHECK (role IN ('user', 'manager', 'tenant', 'super_admin')),          -- profiles_role_check (014)
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,              -- 014
  must_update_password BOOLEAN NOT NULL DEFAULT false,                     -- 014
  monthly_budget_php NUMERIC(10, 2) DEFAULT 2000.00,
  billing_cycle_start_day INTEGER NOT NULL DEFAULT 1
    CHECK (billing_cycle_start_day >= 1 AND billing_cycle_start_day <= 28), -- 013
  disabled_at TIMESTAMPTZ,                                                 -- 020
  disabled_reason TEXT,                                                    -- 020
  meralco_monthly_kwh NUMERIC(8, 2)
    CHECK (meralco_monthly_kwh IS NULL OR (meralco_monthly_kwh > 0 AND meralco_monthly_kwh <= 100000)), -- 038
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_profiles_manager_id ON profiles(manager_id);
```

Notes:

- `manager_id` links manager-created tenants to the manager who can assign them to room sub-meters; managers can read those tenants' profiles
- `must_update_password` forces manager-created tenants through `/update-password` after first login
- `handle_new_user()` (trigger `on_auth_user_created` on `auth.users`) creates the row; it accepts only `user` or `manager` from signup metadata and defaults anything else to `user`
- `monthly_budget_php` is the home-level wallet budget, edited from the Home dashboard wallet (`components/ui/HomeBudgetEditor.tsx`); the customer assistant confirm route can also apply a confirmed `update_home_budget` proposal
- `billing_cycle_start_day` is the Meralco reading day (1–28, Asia/Manila) used for billing-cycle windows and Smart Control accumulation
- `meralco_monthly_kwh` is the optional monthly kWh from the homeowner's Meralco bill, saved through `PATCH /api/profile/billing-cycle`. It picks the distribution tier and energy tax; NULL means "project from monitored usage"
- `disabled_at` / `disabled_reason` record admin-console account suspension
- `guard_profile_privileged_columns` (BEFORE INSERT OR UPDATE, `032`) blocks `authenticated`/`anon` writes to privileged columns; see RLS Summary
- `on_profile_created_create_notification_preferences` (AFTER INSERT, `027`) creates the `notification_preferences` row

### `meralco_rates`

Stores the billing-grade Meralco rate components. This is the only valid source for cost math.

```sql
CREATE TABLE meralco_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  effective_month DATE NOT NULL UNIQUE,
  vat_rate NUMERIC(6, 4) NOT NULL,
  generation NUMERIC(10, 4) NOT NULL,
  transmission NUMERIC(10, 4) NOT NULL,
  ancillary_service NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,   -- 031
  system_loss NUMERIC(10, 4) NOT NULL,
  distribution NUMERIC(10, 4) NOT NULL,
  supply_rate NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,         -- 031
  metering_rate NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,       -- 031
  universal_charges NUMERIC(10, 4) NOT NULL,
  fit_all NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
  awat_adjustment NUMERIC(10, 4) NOT NULL DEFAULT 0,          -- 037 adjustments
  regulatory_reset_adjustment NUMERIC(10, 4) NOT NULL DEFAULT 0,
  lifeline_rate_adjustment NUMERIC(10, 4) NOT NULL DEFAULT 0,
  senior_citizen_subsidy NUMERIC(10, 4) NOT NULL DEFAULT 0,
  rpt_charge NUMERIC(10, 4) NOT NULL DEFAULT 0,
  gea_all NUMERIC(10, 4) NOT NULL DEFAULT 0,
  lifeline_subsidy NUMERIC(10, 4) NOT NULL DEFAULT 0,
  vat_generation NUMERIC(6, 4),                               -- 037 component VAT
  vat_transmission NUMERIC(6, 4),
  vat_ancillary NUMERIC(6, 4),
  distribution_201_300 NUMERIC(10, 4),                        -- 038 tiers
  distribution_301_400 NUMERIC(10, 4),
  distribution_over_400 NUMERIC(10, 4),
  metering_charge NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
  supply_charge NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source_url TEXT,                                            -- 030 provenance
  source_pdf_url TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE,
  auto_updated BOOLEAN NOT NULL DEFAULT false
);
```

Notes:

- `004` seeds the 2026-03-01 row; `031` corrects the August 2026 row (the old parser shifted fields at the Ancillary Service column); `037` and `038` backfill adjustments, component VAT, and distribution tiers for August–October 2026
- `ancillary_service`, `supply_rate`, `metering_rate` are per-kWh; `supply_charge` and `metering_charge` are fixed monthly per-customer charges
- adjustment columns are per-kWh and signed (negative AWAT is a refund). `vat_generation` / `vat_transmission` / `vat_ancillary` hold each month's effective VAT rates; NULL (rows before August 2026) falls back to `vat_rate`
- `distribution` is the residential rate for homes up to 200 kWh a month; `distribution_201_300` / `_301_400` / `_over_400` apply to all kWh of homes above that. NULL falls back to `distribution`
- `universal_charges` is the sum of the four Universal Charge columns (UC-ME NPC-SPUG, UC-ME RED-CI, UC-EC, UC-SD), summed by the sync parser
- `effective_month` is when the rate applies; `fetched_at` is when WattWise last obtained it. Do not label legacy `created_at` values as an official Meralco update
- `source_url` / `source_pdf_url` are set when `sync-meralco-rates` wrote the row (`auto_updated = true`). Manual legacy rows must disclose that the official source link was not recorded

### `devices`

Represents paired ESP32-S3 devices plus appliance-profile and Smart Control metadata.

```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,     -- 014
  tenant_id UUID REFERENCES profiles(id) ON DELETE SET NULL,   -- 014
  device_name TEXT NOT NULL,
  mac_address TEXT UNIQUE NOT NULL,          -- stored uppercase with colons
  is_online BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  relay_state BOOLEAN DEFAULT false,         -- 010
  appliance_type TEXT,                       -- 010
  daily_usage_hours NUMERIC(4, 1),           -- 010
  suggested_monthly_limit_php NUMERIC(10, 2),           -- 012
  user_approved_limit_php NUMERIC(10, 2),
  require_approval_on_expiry BOOLEAN NOT NULL DEFAULT true,  -- default true since 025
  budget_status TEXT NOT NULL DEFAULT 'ok',
  budget_breached_at TIMESTAMP WITH TIME ZONE,
  relay_auto_disabled_at TIMESTAMP WITH TIME ZONE,
  profiled_baseline_watts NUMERIC(10, 2),
  profiled_voltage_v NUMERIC(10, 2),
  profiled_current_a NUMERIC(10, 2),
  profiled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_devices_owner_id ON devices(owner_id);
CREATE INDEX idx_devices_tenant_id ON devices(tenant_id);
```

Constraints:

| Constraint | Rule |
| --- | --- |
| `devices_appliance_type_check` | `appliance_type IS NULL OR IN ('refrigerator', 'aircon', 'tv', 'other')` (matches `ApplianceType` in `lib/constants.ts`) |
| `devices_budget_status_check` | `budget_status IN ('ok', 'approval_required', 'auto_cutoff')` |
| `devices_user_approved_limit_positive_check` | `user_approved_limit_php IS NULL OR > 0` |
| `devices_suggested_limit_positive_check` | `suggested_monthly_limit_php IS NULL OR > 0` |

Important behavior:

- hardware polls `relay_state` every 5 seconds (`GET /rest/v1/devices?select=relay_state&mac_address=eq.<MAC>`); app relay changes are commands applied on the next poll
- `owner_id` is the manager/user who owns and pairs the hardware; `tenant_id` is the optional renter assigned to the room/sub-meter (read-only access)
- `user_id` is a v1 compatibility mirror. Trigger `sync_device_owner_columns_before_write` (BEFORE INSERT OR UPDATE, `014`) fills whichever of `owner_id`/`user_id` is missing and forces `user_id = owner_id` when `owner_id` is set. New code reads/writes `owner_id`
- `user_approved_limit_php` is the owner/manager hard limit; tenants must never edit it
- `daily_usage_hours` is the appliance-profiler hours field (also drives the demo simulator); do not add a duplicate `estimated_daily_hours` column
- Add Appliance registers the device first so the ESP32 can post MAC-based telemetry before AI profiling completes
- new devices default to `require_approval_on_expiry = true`, exposed to clients as `auto_cutoff_enabled = false`; existing rows keep their stored preference
- `last_seen_at` / `is_online` are written by the `energy_logs` trigger on every reading; `is_online` is never cleared, so do not use it for status

### `energy_logs`

High-volume telemetry table for cumulative kWh and live metrology (about 17,000 rows per device per day).

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

- `device_id` is intentionally `TEXT` with no foreign key: it holds either `devices.id::text` or `devices.mac_address` (hardware and the demo simulator write the MAC). All lookups must support both formats
- deleting a device or profile does not delete its `energy_logs`; delete by both UUID text and MAC explicitly (as `DELETE /api/admin/demo-units/[deviceId]` does)
- `energy_kwh` is a cumulative meter reading; usage is always computed from positive deltas
- AFTER INSERT triggers fire in name order: `energy_logs_update_device_last_seen` → `on_energy_log_smart_budget` → `zz_energy_log_budget_warning`
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

- `message` is text; the app stores normalized JSON serialized into it
- rows are written server-side with the service role; check for a recent cached row before generating
- token fields support AI cost/admin observability

## Smart Control Tables

### `device_month_usage`

Billing-cycle per-device accumulator written only by `handle_energy_log_smart_budget()`.

```sql
CREATE TABLE device_month_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,   -- the device owner
  month_start DATE NOT NULL,
  usage_kwh NUMERIC(12, 4) NOT NULL DEFAULT 0,
  variable_spend_php NUMERIC(14, 6) NOT NULL DEFAULT 0,              -- (12,2) before 039
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
- stores per-device billing-cycle usage and variable Meralco spend; fixed monthly charges are excluded by design
- `month_start` keeps its name for compatibility, but since `013` it stores the billing-cycle start date, not necessarily the first of a calendar month
- since `039` spend keeps six decimal places and is never rounded per reading; round for display only
- `household_monthly_kwh_for()` sums `usage_kwh` across an owner's rows to project the household tier

### `device_budget_events`

Audit and alert feed for Smart Control budget thresholds and actions.

```sql
CREATE TABLE device_budget_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,   -- the device owner
  month_start DATE NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('budget_warning', 'approval_required', 'auto_cutoff')),  -- 015
  threshold_php NUMERIC(10, 2),
  threshold_percent SMALLINT
    CHECK (threshold_percent IS NULL OR threshold_percent BETWEEN 1 AND 100),     -- 025
  spend_php NUMERIC(12, 2) NOT NULL,
  usage_kwh NUMERIC(12, 4) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_device_budget_events_user_created
  ON device_budget_events(user_id, created_at DESC);
CREATE INDEX idx_device_budget_events_device_month
  ON device_budget_events(device_id, month_start, event_type);
CREATE UNIQUE INDEX idx_device_budget_warning_percent_dedup
  ON device_budget_events(device_id, month_start, event_type, threshold_percent)
  WHERE event_type = 'budget_warning';
CREATE UNIQUE INDEX idx_device_budget_terminal_dedup
  ON device_budget_events(device_id, month_start, event_type)
  WHERE event_type IN ('approval_required', 'auto_cutoff');
```

Notes:

- `budget_warning` rows are written at 50% and 80% (one each per device per cycle); `approval_required` or `auto_cutoff` is the single terminal 100% event
- each INSERT triggers external delivery through the Database Webhook (see Notification Tables)
- `apply_device_budget_settings()` deletes and re-inserts the current cycle's terminal event when a new limit is already reached

### `device_automations`

Scheduled turn-offs (`041`). A rule turns one device OFF: at a time (`time`), or after it spends PHP `threshold` (`spend`) or uses `threshold` kWh (`usage`) more, counted from when the rule was created, until `ends_at`. Rules never turn a device on.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `device_id` | uuid NOT NULL | FK `devices(id)` ON DELETE CASCADE |
| `created_by` | uuid NOT NULL | FK `profiles(id)` ON DELETE CASCADE |
| `trigger_type` | text NOT NULL | `time`, `spend`, `usage` |
| `run_at` | timestamptz | `time` rules only |
| `threshold` | numeric(14,6) | PHP or kWh; `spend`/`usage` only, > 0 |
| `ends_at` | timestamptz NOT NULL | window end; `time` rules get `run_at + 1 hour` |
| `status` | text NOT NULL DEFAULT `active` | `active`, `done`, `cancelled`, `expired` |
| `consumed_kwh`, `consumed_php` | numeric(14,6) DEFAULT 0 | progress since creation |
| `last_usage_kwh`, `last_spend_php`, `last_month_start` | | last `device_month_usage` snapshot the scheduler saw |
| `created_at`, `executed_at`, `ended_at` | timestamptz | |

- CHECK `device_automations_trigger_fields`: `time` needs `run_at` and no `threshold`; `spend`/`usage` need `threshold > 0` and no `run_at`
- indexes: partial `(created_at) WHERE status = 'active'`, and `(device_id, created_at DESC)`
- RLS on; `owners_select_device_automations` lets `authenticated` read rules on devices they own (`owner_id` or `user_id`). No insert/update/delete policies; all writes go through the functions below. `anon` has no table privileges
- progress reads `device_month_usage` deltas, which the budget trigger already prices with `meralco_variable_rate_per_kwh`; when the billing cycle rolls over, the new cycle's row counts from zero

## Notification Tables

### `notification_preferences`

One private row per profile: backfilled by `027` and created for new profiles by `on_profile_created_create_notification_preferences`.

```sql
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  onesignal_external_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  budget_push_enabled BOOLEAN NOT NULL DEFAULT false,
  budget_email_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- users may select only their row; authenticated UPDATE is column-granted to `budget_push_enabled` and `budget_email_enabled` only
- the random OneSignal alias keeps Supabase auth UUIDs out of provider payloads
- `touch_notification_preferences_updated_at` (BEFORE UPDATE) maintains `updated_at`

### `notification_deliveries`

Service-role audit and idempotency record for OneSignal/Resend attempts.

```sql
CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_event_id UUID REFERENCES device_budget_events(id) ON DELETE SET NULL,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('push', 'email')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  provider_message_id TEXT,
  error_code TEXT,
  error_message TEXT,
  is_test BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_notification_delivery_event_recipient_channel
  ON notification_deliveries(budget_event_id, recipient_id, channel)
  WHERE budget_event_id IS NOT NULL;
CREATE INDEX idx_notification_deliveries_recipient_created
  ON notification_deliveries(recipient_id, created_at DESC);
CREATE INDEX idx_notification_test_cooldown
  ON notification_deliveries(recipient_id, channel, created_at DESC)
  WHERE is_test = true;
```

- the partial unique index prevents duplicate provider sends per event/recipient/channel
- users may read only deliveries addressed to them; authenticated clients cannot insert, update, or delete
- `touch_notification_delivery_updated_at` (BEFORE UPDATE) maintains `updated_at`
- `reserve_notification_test_delivery()` enforces the rolling 60-second test cooldown

### `customer_ai_messages`

Customer assistant history and proposal audit state (`028`); `029` adds the allowlisted rich-display payload.

```sql
CREATE TABLE customer_ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  proposal JSONB,
  proposal_status TEXT CHECK (proposal_status IS NULL OR proposal_status IN
    ('pending', 'processing', 'confirmed', 'expired', 'failed')),
  proposal_result JSONB,
  display_data JSONB,                                   -- 029
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  CONSTRAINT customer_ai_proposal_state_check CHECK (
    (proposal IS NULL AND proposal_status IS NULL)
    OR (proposal IS NOT NULL AND role = 'assistant' AND proposal_status IS NOT NULL)
  )
);

CREATE INDEX idx_customer_ai_messages_user_created
  ON customer_ai_messages(user_id, created_at DESC);
```

- authenticated users have SELECT-only access to their own rows; inserts and proposal transitions are service-role-only after an API route authenticates the session
- server routes keep the latest 10 rows per user and enforce a rolling message limit (`lib/customer-assistant-policy.ts`)
- the `pending` → `processing` conditional update prevents double confirmation
- `customer_ai_display_data_check`: `display_data` is NULL or a `device_list` object with 1–8 `devices`; no arbitrary HTML is stored

### `public_chat_hits` (`042`)

Rate-limit log for the signed-out landing-page chatbot (`/api/public-assistant`). One row per accepted message; nothing else about the conversation is stored.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | bigint identity | PK |
| `client_hash` | text | HMAC-SHA256 of the visitor IP (keyed with the service-role key); raw IPs are never stored |
| `created_at` | timestamptz | `now()` |

- Indexes: `(client_hash, created_at DESC)`, `(created_at)`.
- RLS on with no policies, and `REVOKE ALL` from `anon` and `authenticated`: only the service role reads or writes it.
- `take_public_chat_slot(p_client_hash, p_per_minute, p_per_day, p_global_per_day)` (SECURITY DEFINER, `service_role` only) takes a per-visitor advisory lock, deletes rows older than a day, and returns `minute`, `day`, or `global` when a limit is used up, otherwise inserts a row and returns `ok`. Limits live in `lib/public-assistant-policy.ts` (5 per minute, 30 per day, 1500 per day across all visitors). The route fails closed (503) if the RPC errors.

## Admin / Automation Tables

### `meralco_rate_sync_runs`

Observability log for the `sync-meralco-rates` Edge Function.

```sql
CREATE TABLE meralco_rate_sync_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status TEXT NOT NULL,              -- 'success' | 'skipped' | 'failed' (no CHECK)
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

- a failed extraction is recorded with `status = 'failed'`; `meralco_rates` is untouched until all parsed components pass required-field, range, and anomaly validation
- written with the service role; only `super_admin` can read

### `admin_audit_logs`

Admin console audit trail (`020`), written by `writeAdminAudit` in `lib/admin-auth.ts` with the service role.

```sql
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  reason TEXT,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX idx_admin_audit_target ON admin_audit_logs(target_type, target_id);
CREATE INDEX idx_admin_audit_actor ON admin_audit_logs(actor_id, created_at DESC);
```

- `ON DELETE RESTRICT`: a profile with audit rows (an acting super admin) cannot be deleted until those rows are handled
- only `super_admin` can read

### `demo_device_simulations`

Super-admin controlled virtual WattWise meters (`024`, extended in `039`). Each row belongs to a normal `devices` row; `simulate_demo_units()` writes the same cumulative payload to `energy_logs` as real ESP32 hardware.

```sql
CREATE TABLE demo_device_simulations (
  device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  simulated_watts NUMERIC(10, 2) NOT NULL DEFAULT 100
    CHECK (simulated_watts >= 0 AND simulated_watts <= 5000),
  simulated_voltage_v NUMERIC(10, 2) NOT NULL DEFAULT 230
    CHECK (simulated_voltage_v >= 180 AND simulated_voltage_v <= 260),
  energy_kwh NUMERIC(16, 6) NOT NULL DEFAULT 0,      -- (12,4) before 039
  last_generated_at TIMESTAMPTZ,
  live_since TIMESTAMPTZ,                            -- 039
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_demo_device_simulations_active ON demo_device_simulations(is_active);
```

- virtual devices use a locally administered MAC starting with `02:DE:`
- only the server-side super-admin APIs (`app/api/admin/demo-units`, `app/api/admin/test-lab`) create, assign, start, pause, reset, or delete simulations; update payloads are built by `buildDemoSimulationUpdate` in `lib/demo-units.ts`
- Start writes `is_active = true` and `live_since = NULL` together and preserves `last_generated_at` and `energy_kwh`, so the next tick starts a fresh four-hour window and backfills the real gap (up to 14 days)
- Reset sets `energy_kwh = 0` and `last_generated_at = NULL`; it does not delete historical `energy_logs`. Deleting a demo unit deletes its `energy_logs` (UUID and MAC) and the device
- `created_by ON DELETE RESTRICT` blocks deleting the creating admin's profile while the row exists

## Functions and Triggers

### Triggers

| Table | Trigger | Timing | Function |
| --- | --- | --- | --- |
| `auth.users` | `on_auth_user_created` | AFTER INSERT | `handle_new_user()` |
| `profiles` | `guard_profile_privileged_columns` | BEFORE INSERT OR UPDATE | `guard_profile_privileged_columns()` |
| `profiles` | `on_profile_created_create_notification_preferences` | AFTER INSERT | `create_notification_preferences_for_profile()` |
| `devices` | `sync_device_owner_columns_before_write` | BEFORE INSERT OR UPDATE | `sync_device_owner_columns()` |
| `energy_logs` | `energy_logs_update_device_last_seen` | AFTER INSERT | `update_device_last_seen()` |
| `energy_logs` | `on_energy_log_smart_budget` | AFTER INSERT | `handle_energy_log_smart_budget()` |
| `energy_logs` | `zz_energy_log_budget_warning` | AFTER INSERT | `record_device_budget_warnings()` |
| `notification_preferences` | `touch_notification_preferences_updated_at` | BEFORE UPDATE | `touch_notification_preferences_updated_at()` |
| `notification_deliveries` | `touch_notification_delivery_updated_at` | BEFORE UPDATE | `touch_notification_delivery_updated_at()` |

All trigger functions except `sync_device_owner_columns`, `guard_profile_privileged_columns`, and the two `touch_*` functions are SECURITY DEFINER.

### `handle_new_user()`

- inserts `id`, `email`, `raw_user_meta_data->>'full_name'`, and the sanitized role (`user` or `manager`, else `user`)
- on conflict: refreshes `email`, keeps an existing `full_name`, and only upgrades `user` → `manager`

### `guard_profile_privileged_columns()`

Applies only when `current_user` is `authenticated` or `anon` and the caller is not a super admin. INSERT may set only `role` `user`/`manager` with NULL `manager_id`, `disabled_at`, `disabled_reason`. UPDATE may not change `role`, `email`, `manager_id`, `disabled_at`, `disabled_reason`, or set `must_update_password` from false to true. Raises SQLSTATE `42501`. Service-role and SECURITY DEFINER writes are unaffected; never write `role` from client code.

### `update_device_last_seen()`

Sets `devices.last_seen_at = now()` and `is_online = true` for the device whose UUID or MAC the row names, when `user_id IS NOT NULL`. Captured in `035`; SECURITY DEFINER since `036` because hardware inserts as `anon`, which has no UPDATE policy on `devices`. EXECUTE revoked from PUBLIC/anon/authenticated. Treat a device as online when `last_seen_at` (or its latest reading) is within `ACTIVE_READING_WINDOW_MS` (20 s, `lib/device-telemetry.ts`), not from `is_online`.

### `handle_energy_log_smart_budget()`

Behavior:

- resolves the device by `devices.id::text` or exact `devices.mac_address`; returns early when no device or no owner (`COALESCE(owner_id, user_id)`)
- derives the Manila-local billing-cycle start from the owner's `billing_cycle_start_day`
- prices the reading with `meralco_variable_rate_per_kwh(rate, household_monthly_kwh_for(owner, recorded_at))` using the latest row with `effective_month <=` the Manila reading date
- delta = new cumulative kWh − `last_energy_kwh` for the cycle; zero for the first reading of a cycle, a meter reset (negative delta), or a jump beyond `10 kW × elapsed hours + 0.01 kWh` (`039`)
- adds `delta × rate` to `device_month_usage` without rounding (`039`)
- clears an `approval_required` status left over from a previous cycle; `auto_cutoff` stays latched until `restore_device_power()`
- at 100% of `user_approved_limit_php` (status still `ok`): if `require_approval_on_expiry = true`, sets `approval_required` and records it; otherwise sets `relay_state = false`, `auto_cutoff`, `relay_auto_disabled_at`, and records it (`threshold_percent = 100`)

Guardrails:

- telemetry is always accepted: no matching device, no owner, or no rate row skips automation
- terminal events are deduplicated per device/cycle by `idx_device_budget_terminal_dedup`

### `record_device_budget_warnings()`

Runs after the accumulator (name order). For devices with a positive limit, inserts one `budget_warning` each at 50% and 80% of `user_approved_limit_php` for the current cycle (`threshold_php` rounded to centavos, `threshold_percent` 50/80), deduplicated by `idx_device_budget_warning_percent_dedup`.

### `sync_device_owner_columns()`

BEFORE INSERT OR UPDATE on `devices`: copies `user_id` ↔ `owner_id` when one is NULL, then forces `user_id := owner_id` whenever `owner_id` is set.

### Telemetry RPCs

All are `LANGUAGE sql STABLE` and SECURITY INVOKER, so `devices`/`energy_logs` RLS still applies. Each includes devices where `owner_id`, `user_id`, or `tenant_id` equals `p_user_id`, matches readings by UUID text or MAC, and returns `device_id` as `devices.id::text` (since `014`) even for MAC-keyed rows.

| Function | Returns | Notes |
| --- | --- | --- |
| `get_latest_device_readings(p_user_id uuid)` | `device_id, average_watts, voltage_v, current_a, energy_kwh, recorded_at` | Newest reading per device. Since `034` two index probes (UUID, MAC) per device, so cost does not grow with history. Devices with no readings are omitted |
| `get_usage_kwh_by_device(p_user_id, p_start, p_end)` | `device_id, usage_kwh` | Window inclusive at both ends; one reading per device per minute (latest in the minute); sum of positive cumulative deltas, negatives count as 0. The first reading in the window has no anchor, so usage before it is not counted |
| `get_usage_kwh_by_device_day(p_user_id, p_start, p_end)` | `device_id, day_key, usage_kwh` | Same logic, grouped by Manila `day_key` (`YYYY-MM-DD`). Main source for dashboard, calendar, analytics, and reports |
| `get_average_watts_by_device(p_user_id, p_start, p_end)` | `device_id, average_watts, readings` | `034`. Mean of `average_watts` (NULL as 0) per device with readings in the window. Use instead of averaging raw rows |
| `get_device_usage_periods(p_user_id uuid, p_device_id uuid, p_now timestamptz DEFAULT now())` | `period_key, started_at, usage_kwh` | `023`. One device; rows for `hour`, `day`, `week` (Monday), `month` (calendar month, not billing cycle) in Manila time. Anchors on the last reading before each period start |
| `get_hourly_averages(p_user_id uuid, p_date date)` | `hour_key, avg_watts` | Average `average_watts` by Manila hour for one Manila date across all accessible devices. Not called by current app code; its date filter is not index-friendly |

### Billing and Smart Control functions

| Function | Security / grants | Purpose |
| --- | --- | --- |
| `meralco_variable_rate_per_kwh(r meralco_rates, p_household_kwh numeric DEFAULT NULL)` | IMMUTABLE | VAT-inclusive variable cost of one kWh (`037`, tiers in `038`): component VAT, the household's distribution tier, plus energy tax averaged over all kWh above 650 kWh. Mirrors `applyHouseholdTier` + `computeVariableRatePerKwh` in `lib/meralco-bill.ts` (October 2026: 14.8761 at base tier; Meralco typical bills at 300, 500, 1,000 kWh) |
| `household_monthly_kwh_for(p_owner uuid, p_as_of timestamptz)` | SECURITY DEFINER; EXECUTE revoked from PUBLIC/anon/authenticated (service role and triggers) | Owner's `meralco_monthly_kwh`, else current-cycle `device_month_usage` projected to the full cycle, else NULL (base tier) |
| `my_household_usage()` | SECURITY DEFINER; `authenticated` only | `(monthly_kwh, source)` for the caller's home, `source` = `bill` or `projected`; tenants get their manager's home; no row when there is no figure. Used by `getHouseholdUsage()` in `lib/meralco-rates-server.ts` |
| `apply_device_budget_settings(p_device_id uuid, p_limit_php numeric, p_auto_cutoff_enabled boolean)` | SECURITY DEFINER; `authenticated` | Returns `device_id, auto_cutoff_enabled, relay_state, budget_status, current_spend_php`. Owner/`user_id` or super admin only (never tenants); limit 0 < x ≤ 9,999,999.99. Sets the limit and `require_approval_on_expiry = NOT p_auto_cutoff_enabled`, then reconciles with current-cycle spend (may cut power now, record a terminal event, or reset to `ok`) |
| `restore_device_power(p_device_id uuid, p_confirmed boolean)` | SECURITY DEFINER; `authenticated` | Returns `device_id, relay_state, budget_status, current_spend_php`. The only recovery path from `auto_cutoff`; requires `p_confirmed = true`, same access rules, and refuses while auto-cutoff is enabled and the limit is still reached. Sets `relay_state = true` and `approval_required` or `ok` |

| `create_device_automation(p_device_id uuid, p_trigger text, p_run_at timestamptz, p_threshold numeric, p_ends_at timestamptz)` | SECURITY DEFINER; `authenticated` (revoked from PUBLIC, anon) | Returns the new rule's id. Caller must have role `user` and own the device. `time`: `run_at` within the next 7 days (`ends_at` is set to `run_at + 1 hour`). `spend`: 0 < PHP ≤ 9,999,999.99; `usage`: 0 < kWh ≤ 100,000; `ends_at` within 7 days. At most 5 active rules per device. Snapshots the device's latest `device_month_usage` row so progress counts from now. Errors use SQLSTATE `42501`, `22023`, or `P0001` with user-facing messages. Called by the customer-assistant confirm route |
| `cancel_device_automation(p_automation_id uuid)` | SECURITY DEFINER; `authenticated` (revoked from PUBLIC, anon) | Sets an active rule on a device the caller owns to `cancelled`; returns false when there was nothing to cancel. Called by `DELETE /api/devices/[deviceId]/automations/[automationId]` |
| `run_device_automations()` | SECURITY DEFINER; `service_role` only | The scheduler (pg_cron, every 15 s). For each active rule (`FOR UPDATE SKIP LOCKED`): time rules fire when `run_at <= now() < ends_at`; spend/usage rules add the `device_month_usage` delta and fire at the threshold. Firing sets `devices.relay_state = false` and the rule to `done`; a rule whose window passed becomes `expired` |

`026` qualifies `device_month_usage` columns in both budget RPCs to avoid `RETURNS TABLE` name conflicts.

### RLS helper functions

| Function | Notes |
| --- | --- |
| `current_profile_role()` | SECURITY DEFINER, `row_security = off`; returns the caller's `profiles.role`, NULL when `auth.uid()` is NULL (`016`–`018`). Call as `(SELECT current_profile_role())` in policies |
| `can_access_device(target_device devices)` | SECURITY DEFINER; true for super admin, owner, `user_id`, or tenant, and true when `auth.uid()` IS NULL (`018`) |
| `is_registered_device_mac(candidate_mac text)` | SECURITY DEFINER, `row_security = off`; `upper(mac_address) = upper(trim(candidate_mac))`; EXECUTE for anon, authenticated (`022`) |
| `accessible_energy_log_device_keys()` | SECURITY DEFINER, `row_security = off`; SETOF text of UUID and MAC keys of devices the caller owns, uses, or rents; EXECUTE for anon (returns nothing) and authenticated (`033`) |

### `reserve_notification_test_delivery(p_recipient_id uuid, p_channel text)`

SECURITY DEFINER, EXECUTE for `service_role` only (also checks `auth.role()`). Returns `(delivery_id uuid, retry_after_seconds integer)`: inserts a pending `is_test` delivery, or returns NULL plus seconds to wait when one exists for that recipient/channel in the last 60 seconds. Serialized with an advisory lock. Called by the `dispatch-budget-notifications` Edge Function.

### `simulate_demo_units(p_device_id uuid DEFAULT NULL)`

`039`. SECURITY DEFINER, EXECUTE for `service_role` only; returns the number of units that received a live reading. Replaces the old `simulate-demo-units` Edge Function.

- takes `pg_try_advisory_xact_lock(hashtext('simulate_demo_units'))`; returns 0 if another run holds it
- deactivates units whose `live_since` is more than 4 hours old
- for each active unit with a MAC (or only `p_device_id`): if the last reading is over 1 minute old, backfills from `last_generated_at` (capped at 14 days) in 15-minute steps; steps are on during a daily window of `daily_usage_hours` (default 4, clamped 0.5–24) ending 22:00 Manila, at `simulated_watts` with ±20% day-to-day variation, and 0 W while the relay is off
- then writes one live reading near `simulated_watts` (±3%, 0 W while the relay is off) with `device_id = mac_address`, so the normal `energy_logs` triggers run
- a NULL `last_generated_at` starts ten seconds before the current tick, so a new or reset meter has no seeded history
- updates `energy_kwh` (full precision), `last_generated_at`, and sets `live_since` when the unit came back online or `live_since` was NULL

### Scheduled jobs (pg_cron, `039`, `041`)

| Job | Schedule | Command |
| --- | --- | --- |
| `simulate-demo-units` | `10 seconds` | `SELECT public.simulate_demo_units()` |
| `purge-cron-run-details` | `17 3 * * *` (daily, pg_cron clock) | `DELETE FROM cron.job_run_details WHERE end_time < now() - interval '1 day'` |
| `run-device-automations` (`041`) | `15 seconds` | `SELECT public.run_device_automations()` |

## RLS Summary

### Enabled tables

RLS is enabled on every table above: `profiles`, `meralco_rates`, `devices`, `energy_logs`, `ai_insights`, `device_month_usage`, `device_budget_events`, `notification_preferences`, `notification_deliveries`, `customer_ai_messages`, `meralco_rate_sync_runs`, `admin_audit_logs`, `demo_device_simulations`. The service role bypasses RLS.

### Policies by table

| Table | SELECT | INSERT / UPDATE / DELETE |
| --- | --- | --- |
| `profiles` | own row, profiles with `manager_id = auth.uid()` (a manager's tenants), or super admin | INSERT/UPDATE own row (`id = auth.uid()`), limited by `guard_profile_privileged_columns`; no DELETE |
| `meralco_rates` | any `authenticated` user (not anon) | INSERT/UPDATE: super admin |
| `devices` | `users_select_accessible_devices` via `can_access_device()`; plus anon (see below) | INSERT: role `user`/`manager`/`super_admin` and `COALESCE(owner_id, user_id) = auth.uid()`. UPDATE/DELETE: super admin, or `user`/`manager` owner. Tenants are read-only |
| `energy_logs` | `users_select_accessible_energy_logs` (`033`) | INSERT: anon hardware only; service role for demo units |
| `ai_insights` | own rows or super admin | service role only |
| `device_month_usage` | super admin, or devices the caller owns, uses, or rents | trigger only |
| `device_budget_events` | super admin, or devices the caller owns, uses, or rents | triggers and budget RPCs only |
| `notification_preferences` | own row | UPDATE own row, columns `budget_push_enabled`, `budget_email_enabled` only |
| `notification_deliveries` | `recipient_id = auth.uid()` | service role only |
| `customer_ai_messages` | own rows | service role only |
| `meralco_rate_sync_runs` | super admin | service role only |
| `admin_audit_logs` | super admin | service role only |
| `demo_device_simulations` | super admin | service role only |

`energy_logs` SELECT is a single policy: `(SELECT current_profile_role()) = 'super_admin' OR device_id IN (SELECT accessible_energy_log_device_keys())`. Never reintroduce per-row function calls or `EXISTS` subqueries in `energy_logs` policies. Older policies from `002`/`009`/`012` (`super_admin_select_meralco_rates`, `super_admin_select_ai_insights`, `super_admin_select_sync_runs`, `super_admin_select_device_month_usage`, `super_admin_select_device_budget_events`) still use the per-row `EXISTS (SELECT 1 FROM profiles ...)` pattern; acceptable on these small tables, not a pattern to copy.

### Hardware anon access

The `anon` role is intentionally allowed to support ESP32 hardware:

- `INSERT` into `energy_logs` when `is_registered_device_mac(device_id)` is true (case-insensitive, trimmed)
- `SELECT` from `devices` so hardware can poll `relay_state` by MAC (`hardware_anon_select_devices`, `USING (true)`)

Cautions:

- the anon device policy (and `can_access_device()` returning true for a NULL `auth.uid()`) lets anyone with the public anon key read every `devices` row and column; the hardware's `select=relay_state&mac_address=eq.<MAC>` filter is a client choice, not a restriction
- the insert check ignores case and whitespace, but the triggers and RPCs match `device_id` exactly; hardware must post the MAC exactly as stored (uppercase with colons) or the reading is stored but skipped by last-seen, budget, and usage logic

## Query and Implementation Rules

### Billing

- never compute cost with a flat multiplier like `kWh * 10`
- read rates through `lib/meralco-rates-server.ts` (`getActiveMeralcoRates`, `getMeralcoRatesForRange`, `getMeralcoRateHistory`): all rows are cached across requests (service-role client, 1 h revalidate, tag `meralco-rates`; direct reads when the service key is missing), and the active row is chosen per request by today's Manila date
- the household tier is applied automatically from `my_household_usage()`; admin code passes `{ household }` for a specific owner (from `household_monthly_kwh_for`, service role)
- compute cost only with `computeMeralcoBill` / `computeVariableRatePerKwh` from `lib/meralco-bill.ts`: monthly VAT rates on Generation, Transmission, Ancillary Service; `vat_rate` on distribution, supply, metering, fixed charges, and the AWAT / regulatory reset / lifeline rate / senior citizen adjustments; no VAT on System Loss, Universal Charge, FIT-All, GEA-All, RPT, lifeline subsidy, and energy tax
- change `meralco_variable_rate_per_kwh` together with `lib/meralco-bill.ts` and `tests/meralco-bill.test.ts`, and keep the October 2026 checks passing
- do not fall back to hardcoded rates; `selectActiveMeralcoRates` throws when no row applies
- fixed monthly charges (`metering_charge + supply_charge`) are home-level bill context, never part of per-device cutoff logic
- never round money per reading; round only for display
- reports come from `buildEnergyReport` in `lib/reports.ts`: per-day usage RPC, `get_average_watts_by_device`, and day-by-day pricing over a bounded Manila window

### Telemetry

- keep compatibility with both `devices.id::text` and `devices.mac_address`
- bound all `energy_logs` reads by time or `LIMIT`; read through the index-backed RPCs (`get_latest_device_readings`, `get_usage_kwh_by_device[_day]`, `get_average_watts_by_device`, `get_device_usage_periods`) rather than raw rows
- device lists filter `devices` by `owner_id`, `user_id`, or `tenant_id` (`lib/dashboard-data.ts`); single-device lookups for tenants filter by `tenant_id` only
- online/LIVE status comes from the latest reading or `last_seen_at` within `ACTIVE_READING_WINDOW_MS` (`isFreshReading`), never from `is_online`
- keep `energy_logs` and `devices` in the `supabase_realtime` publication. Triggers update `devices` on every reading, so react to `devices` UPDATEs only when `relay_state` or `budget_status` changes, and never call `router.refresh()` per reading

### Data access and RLS

- pages and route handlers get the user from `getSessionUser()` (`lib/auth-context.ts`); do not call `supabase.auth.getUser()` there or read `x-wattwise-*` headers elsewhere
- keep RLS on large tables cheap: wrap `auth.uid()` and `current_profile_role()` in `(SELECT ...)` and compare against a SECURITY DEFINER key list (`033`)
- before applying an RLS, trigger, or RPC change, verify it on production in a transaction that ends in `ROLLBACK`, as each role (`authenticated` with `request.jwt.claims`, `anon`); `032`–`036` record how
- dashboard-made changes must be captured in a migration and marked with `supabase migration repair --status applied <version> --linked`
- start independent queries together (`startQuery` in `lib/start-query.ts`, `Promise.all`)

### AI and caching

- all OpenAI calls stay server-side
- insight routes check `ai_insights` for a cached row within the per-type `CACHE_WINDOW_DAYS` (`app/api/insights/route.ts`) before generating; serialize structured payloads into `message`
- manager AI insight cards use `manager_fleet_alert`, `manager_room_anomaly`, `manager_cutoff_forecast`, and `manager_cost_optimizer` as `insight_type`
- manager AI and chatbot routes scope data to manager-owned devices; chatbot replies are advisory and must not mutate relays, limits, tenants, or assignments
- customer AI routes scope context to devices visible to the homeowner/tenant. The model only prepares typed proposals; the confirm route revalidates and applies them through RLS and `apply_device_budget_settings` (tenants may change only notification preferences)

### Notifications

- deliver only from deduplicated `device_budget_events` (Database Webhook → `dispatch-budget-notifications`), never from `energy_logs`
- policy: 50% in-app only, 80% push, 100% terminal events push plus critical email
- target `notification_preferences.onesignal_external_id`, never Supabase user UUIDs; missing provider credentials record a `skipped` delivery

### Service-role routes

- `createAdminClient()` (`lib/supabase/admin.ts`, `server-only`) uses `SUPABASE_SERVICE_ROLE_KEY`, falling back to `SUPABASE_SECRET_KEY`. It backs the admin console, tenant creation, account deletion, demo units, customer assistant writes, and the Meralco rate cache
- service-role clients must never be imported into client components

### Smart Control

- billing-cycle boundaries come from the owner's `profiles.billing_cycle_start_day` in `Asia/Manila`
- compare `device_month_usage.variable_spend_php` against `devices.user_approved_limit_php`; change limits and cutoff preference only through `apply_device_budget_settings`, and restore power only through `restore_device_power`
- `require_approval_on_expiry = true` must not auto-disable relay power
- relay changes from the app are commands applied on the unit's next 5 s poll; confirm before turning a device off and word results as "sent"

## Common Query Patterns

### Latest live telemetry for accessible devices

```sql
SELECT * FROM get_latest_device_readings($1);
```

### Device usage for a bounded range

```sql
SELECT * FROM get_usage_kwh_by_device(p_user_id := $1, p_start := $2, p_end := $3);
```

### Per-day usage for a bounded range

```sql
SELECT * FROM get_usage_kwh_by_device_day(p_user_id := $1, p_start := $2, p_end := $3);
```

### Average watts per device for a report window

```sql
SELECT * FROM get_average_watts_by_device(p_user_id := $1, p_start := $2, p_end := $3);
```

### Hour / day / week / month usage for one device

```sql
SELECT * FROM get_device_usage_periods(p_user_id := $1, p_device_id := $2);
```

### Current device-cycle accumulator rows

```sql
SELECT *
FROM device_month_usage
WHERE user_id = $1
  AND month_start = $2;
```

- `$1` is the owner; `$2` is the current billing-cycle start computed from `profiles.billing_cycle_start_day`, not `date_trunc('month', ...)`

### Recent device budget events

```sql
SELECT *
FROM device_budget_events
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 50;
```

### Update device limit and auto-cutoff

```sql
SELECT * FROM apply_device_budget_settings($1, $2, $3);  -- device id, limit PHP, auto-cutoff enabled
```

### Current active Meralco rates (SQL equivalent of the app selector)

```sql
SELECT *
FROM meralco_rates
WHERE effective_month <= (now() AT TIME ZONE 'Asia/Manila')::date
ORDER BY effective_month DESC
LIMIT 1;
```

- app code uses `getActiveMeralcoRates()` instead of querying directly

### Cached insight lookup

```sql
SELECT message
FROM ai_insights
WHERE user_id = $1
  AND insight_type = $2
  AND created_at >= $3   -- now() minus the type's cache window
ORDER BY created_at DESC
LIMIT 1;
```

### Update Home wallet budget

```sql
UPDATE profiles
SET monthly_budget_php = $2
WHERE id = $1;
```

- `$1` must be the authenticated profile id (RLS allows only the own row)
- exposed from the Home dashboard wallet flow; the customer assistant confirm route is the only other writer
