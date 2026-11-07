---
description: WattWise Smart Control implementation guide for realtime telemetry, AI appliance profiling, per-device budget limits, automatic relay shutoff, settings overrides, and burn-rate analytics.
applyTo: "**"
---

# WattWise Smart Control Architecture Blueprint

## Implementation Summary

Smart Control extends the existing Next.js + Supabase + ESP32-S3 architecture. It keeps Supabase as the system of record, preserves DB-driven Meralco billing, and uses the current hardware contract: ESP32-S3 posts MAC-address telemetry and polls `devices.relay_state`.

Core behavior:
- Dashboard live W/V/A updates come directly from Supabase Realtime `energy_logs` INSERT payloads. The dashboard refreshes server data when relay or budget status changes, not on each reading.
- Add Appliance registers the MAC first with `relay_state = true`, then profiles from a fresh telemetry row within the 20-second freshness window.
- Per-device monthly limits are stored on `devices.user_approved_limit_php`.
- `energy_logs` INSERT triggers update `device_month_usage` and can set `devices.relay_state = false` when a device reaches its approved monthly variable spend limit.
- `devices.require_approval_on_expiry = true` prevents auto-cutoff and is the default for newly paired devices. Product/API copy exposes the inverse as `auto_cutoff_enabled`.

## Database Objects

Migration: `supabase/migrations/012_smart_budget_controls.sql`

New `devices` columns:
- `suggested_monthly_limit_php`
- `user_approved_limit_php`
- `require_approval_on_expiry`
- `budget_status`
- `budget_breached_at`
- `relay_auto_disabled_at`
- `profiled_baseline_watts`
- `profiled_voltage_v`
- `profiled_current_a`
- `profiled_at`

New tables:
- `device_month_usage`: custom billing-cycle accumulator per device since migration `013`, using the owner's `profiles.billing_cycle_start_day` in Asia/Manila. Stores kWh, variable spend, and the last cumulative meter reading; migration `039` preserves six decimal places of spend without per-reading centavo rounding.
- `device_budget_events`: user-visible/audit events for `approval_required` and `auto_cutoff`.

Trigger:
- `handle_energy_log_smart_budget()` runs after `energy_logs` INSERT.
- It resolves `NEW.device_id` against both `devices.id::text` and `devices.mac_address`.
- It counts meter resets and physically implausible kWh jumps as zero usage (migration `039`).
- It prices kWh with `public.meralco_variable_rate_per_kwh(rate, household_kwh)` on the active `meralco_rates` row (migrations `037`, `038`, `039`): per-component VAT, the home's distribution tier, and energy tax, with the household kWh from `household_monthly_kwh_for()`. It must match `lib/meralco-bill.ts`.
- It excludes fixed charges from per-device shutoff decisions.

## App Surfaces

AI profile route:
- `POST /api/devices/[deviceId]/ai-profile`
- Requires authenticated ownership.
- Requires fresh telemetry within 20 seconds.
- Calls OpenAI server-side with the Smart Appliance profiler persona: "Act as an expert energy consultant in the Philippines. You speak in a casual, practical Taglish tone."
- Forces the model to return raw JSON with `estimated_monthly_kwh`, `suggested_monthly_limit_php`, and `taglish_advice`.
- Uses the active Meralco variable rate for prompt context when available, or a PHP 12/kWh fallback for profiling copy only.

Profile save route:
- `PATCH /api/devices/[deviceId]/profile`
- Stores daily hours, profiled baseline readings, suggested limit, and user-approved limit.

Settings and recovery routes:
- `app/settings/page.tsx`
- User self-service theme, password reset, account deletion, and per-device automatic-cutoff opt-in.
- `PATCH /api/devices/[deviceId]/settings` accepts `auto_cutoff_enabled` and reconciles current-cycle spend atomically.
- `POST /api/devices/[deviceId]/restore` requires `{ "confirmed": true }`; an enabled cutoff still above its limit returns `409`.

Analytics route:
- `app/analytics/page.tsx`
- Uses bounded usage RPCs and active Meralco rates to render the projected bill for the billing cycle, the forecast, and the "Daily spend, last 7 days" chart.

Reports route:
- `app/reports/page.tsx` and `app/api/reports/route.ts`
- Supports bounded daily, weekly, and monthly measured-versus-estimated appliance reports built once by `buildEnergyReport()` (`lib/reports.ts`), with CSV and PDF downloads (`lib/report-pdf.ts`) and print styles.

Budget warnings:
- Migration `025_budget_alert_policy.sql` records deduplicated 50% green and 80% amber warning events. The terminal approval/cutoff event supplies the one red 100% alert.
- Smart Control progress always uses billing-cycle variable spend. Fixed charges remain estimated-bill context only.
- Automatic cutoffs remain OFF until a confirmed manual restore; cycle rollover and limit edits never energize the relay automatically.

## Supabase Cloud Setup

Keep both `energy_logs` and `devices` in the `supabase_realtime` publication:
1. Open Supabase Dashboard.
2. Go to Database > Replication.
3. Enable Realtime for both tables.
4. Confirm telemetry INSERTs and device UPDATEs are broadcast to authorized browser clients. Ignore heartbeat-only device updates when deciding whether to refresh the dashboard.

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) for account deletion through `supabase.auth.admin.deleteUser()`, tenant creation, the admin console, and the cross-request rate cache.

## Hardware Contract

No firmware change is required if ESP32-S3 already:
- POSTs to `energy_logs` every 5 seconds using MAC-address `device_id`.
- Includes cumulative `energy_kwh`, `average_watts`, `voltage_v`, and `current_a`.
- Polls `devices?select=relay_state&mac_address=eq.<MAC>` every 5 seconds.
- Drives the relay LOW when `relay_state` is false.

Newly paired devices are inserted with `relay_state = true` so telemetry can flow before AI profiling.

## Testing Checklist

- Run `npm run lint`.
- Run `npm run build`.
- Pair a device and confirm the DB row is created before profiling.
- Confirm fresh telemetry enables AI profiling and zero/stale telemetry blocks it with friendly copy.
- Confirm dashboard W/V/A updates without manual refresh on `energy_logs` INSERT.
- Confirm `device_month_usage` increments on telemetry inserts.
- Confirm auto-cutoff sets `relay_state = false` when `user_approved_limit_php` is reached.
- Confirm approval-required mode records an event and does not change `relay_state`.
- Confirm Analytics uses bounded RPCs and no unbounded `energy_logs` query.
