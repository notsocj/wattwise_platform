---
description: Wattwise platform coding constraints — Meralco billing precision, hardware safety handshake, data ingestion throttling, and OpenAI integration architecture. Apply when writing API routes, energy calculations, UI controls, Supabase queries, or AI insight features.
applyTo: "**"
---

# Wattwise Platform — AI Agent Workflow & Constraints

## 1. Meralco Billing Precision (The "No Flat Rate" Rule)

**Hard constraint:** Never calculate energy cost with a single flat rate multiplier (e.g., `totalKWh * 10`). This is incorrect and academically indefensible.

**Required pattern:** Always unbundle the Meralco billing components, add fixed monthly charges, then apply VAT last:

```ts
// CORRECT — DB-driven unbundled Meralco rate structure
const activeRate = await getActiveMeralcoRates(supabase); // includes vat_rate + fixed monthly charges

function computeMeralcoBill(
  kWh: number,
  rates: MeralcoRateComponents,
  vatRate: number,
  fixedChargesPhp: number
): number {
  const subtotalPerKWh =
    rates.generation +
    rates.transmission +
    rates.systemLoss +
    rates.distribution +
    rates.universalCharges +
    rates.fitAll;

  const variableSubtotal = subtotalPerKWh * kWh;
  const preVatTotal = variableSubtotal + fixedChargesPhp;

  return preVatTotal * (1 + vatRate); // VAT applied at the final step only
}

// WRONG — never do this
// const cost = kWh * 10;
```

- In app/runtime code, fetch the active row from `meralco_rates` (`effective_month <= current_date`, ordered descending, `limit 1`) and map DB fields (`vat_rate`, `system_loss`, `universal_charges`, `fit_all`, `metering_charge`, `supply_charge`) to the billing component object before calling `computeMeralcoBill`.
- For automated rate ingestion, use Meralco Rates Archives (`https://company.meralco.com.ph/news-and-advisories/rates-archives`) as discovery source, then select the latest **Summary Schedule of Rates** PDF link for the target month. Avoid hardcoding article slugs like `higher-residential-rates-march-2026`.
- Customer-facing rate views must distinguish the effective month from the time WattWise fetched the row, and show the recorded Meralco archive/PDF link where available. Never imply a manual legacy row has an official source link.
- Preferred scheduler cadence is daily around 10:00-12:00 PM PH time. In automatic mode, first check whether the current Manila month (`YYYY-MM-01`) already exists in `meralco_rates`; if present, return a no-op and skip external fetch/upsert.
- If current month is not yet in DB, attempt current-month Summary Schedule lookup first; if not published yet, fall back to latest available summary and only write when that effective month is missing.
- Automation must extract **base non-lifeline residential components** for `meralco_rates` and ignore lifeline-only discount/subsidy rows unless tiered billing schema is explicitly implemented.
- In fully automatic mode (no admin approval), enforce strict parser validation: required fields present, sane numeric ranges, and month-over-month anomaly threshold checks. Abort write on validation failure; do not partially update the active rate row.
- Prefer storing sync provenance and observability metadata when available (`source_url`, `source_pdf_url`, `fetched_at`, `auto_updated`) and writing run logs to a dedicated table for failed/success runs.
- When `energy_logs.energy_kwh` stores cumulative meter readings, never sum all rows directly for a billing period. Compute usage from **sequential deltas** (`current - previous`) per device after minute-bucket dedupe; treat tiny negative drift as jitter (`0`) and only treat large drops as meter reset. Prefer DB RPC aggregation over client-side row scans for monthly/weekly totals.
- The application must be DB-only: do not use in-code default rate constants, including VAT.
- If the table query returns no rows or the query fails, surface a clear, actionable admin-visible error or warning (server-side) instructing the admin to add a `meralco_rates` entry. Do not silently fall back to hardcoded constants.
- All cost values displayed in the UI must be derived from this calculation, never hardcoded.

---

## 2. Data Ingestion Throttling (Free Tier Guardrail)

**Hard constraint:** Never query the `energy_logs` table (or any high-volume table) without a hard row limit or a time-range filter. Fetching unbounded rows will crash the browser and time out the Supabase API.

**Required pattern — always scope queries:**

```ts
// CORRECT — time-range filter with a limit guard
const { data } = await supabase
  .from('energy_logs')
  .select('*')
  .gte('created_at', startOfDay.toISOString())
  .lte('created_at', endOfDay.toISOString())
  .order('created_at', { ascending: false })
  .limit(100);

// CORRECT — aggregated query using date_trunc (prefer this for charts)
const { data } = await supabase.rpc('get_hourly_averages', {
  p_user_id: userId,
  p_date: targetDate,
});

// WRONG — never do this
// const { data } = await supabase.from('energy_logs').select('*');
```

- Default to `.limit(100)` when the exact row count is unknown.
- For chart data, prefer server-side aggregation via Supabase RPC functions over client-side array processing.
- For billing-grade totals, use RPCs that aggregate by minute and sum cumulative deltas (`get_usage_kwh_by_device`, `get_usage_kwh_by_device_day`) instead of raw row loops.
- Cache idempotent client-side API reads with SWR and the shared `lib/fetcher.ts` JSON fetcher to preserve stale data during back-navigation while revalidating in the background.
- When correlating `energy_logs.device_id` to devices, normalize and support both key formats (`devices.id` and legacy `devices.mac_address`) to avoid zeroed dashboard totals during schema transition.
- For "active appliance" status in UI cards, never rely on the latest row alone. Use `recorded_at` freshness (for example, last 1 minute for 10-second telemetry) before showing live/active wattage; stale readings must render as offline or idle to avoid false-active states when a unit is unplugged.
- For Device Detail metrology gauges, query only the latest row with scoped filters and read `average_watts`, `voltage_v`, and `current_a`; if `voltage_v`/`current_a` are null on legacy rows, fall back safely without removing the freshness gate.
- For Home Dashboard device cards, derive online/offline from telemetry freshness and expose live `average_watts`, `voltage_v`, and `current_a` (with safe voltage/current fallback for legacy rows) so W/V/A stays coherent with live status.
- For server-rendered dashboard/device pages that must feel live, use a small client-side Supabase Realtime listener (filtered by owned `device_id` keys) to trigger a throttled `router.refresh()` on `energy_logs` INSERT/UPDATE events. This preserves RPC-based billing accuracy while keeping UI telemetry live without periodic polling.
- For dashboard cards that show live W/V/A, bind Supabase Realtime INSERT payloads directly into client state so the UI updates immediately without waiting for the server refresh bridge.
- During schema transitions, avoid hard-failing device lists on optional metadata columns (for example `devices.relay_state`). Use a compatibility fetch path: try full select first, then retry with a reduced column set when PostgreSQL returns undefined-column (`42703`), and map sensible defaults in the view model.
- Multi-tenant device access is owner/tenant based: managers/users manage `devices.owner_id = auth.uid()` while tenants only read `devices.tenant_id = auth.uid()`. `devices.user_id` is legacy compatibility only.

### 2b. Smart Control Budget Shutoff

- Pairing must register the device row before AI profiling. Hardware anon INSERT is MAC-gated against `devices.mac_address`, so unregistered MACs cannot send telemetry.
- AI appliance profiling accepts telemetry from the latest 2-minute hardware startup window. The client may poll `POST /api/devices/[deviceId]/ai-profile` for up to 2 minutes because Wi-Fi provisioning, the 5-second relay poll, sensor initialization, and the first telemetry POST do not complete atomically.
- Treat missing/stale telemetry (`telemetry_pending`) separately from a live meter reporting zero load (`load_not_detected`). The latter must tell the user to turn the appliance on; neither state may call OpenAI or be presented as a completed profile.
- A duplicate MAC owned by the same user may resume setup only when `devices.profiled_at` is still null. A completed device must continue to reject duplicate registration.
- The Smart Appliance profiler route is `POST /api/devices/[deviceId]/ai-profile`. It must run server-side only, verify device ownership, and send OpenAI the exact persona: "Act as an expert energy consultant in the Philippines. You speak in a casual, practical Taglish tone."
- Appliance profiling prompts must include `appliance_type`, fresh baseline watts, and `estimated_daily_hours`, and must force raw JSON output with exactly `estimated_monthly_kwh`, `suggested_monthly_limit_php`, and `taglish_advice`.
- When live Meralco prompt context is unavailable, the profiler may fall back to PHP 12/kWh for AI copy only. Billing-grade cost logic must still come from the DB-backed unbundled Meralco computation path.
- Per-device shutoff compares current billing-cycle variable Meralco spend against `devices.user_approved_limit_php`. The cycle boundary comes from `profiles.billing_cycle_start_day` in Asia/Manila. Fixed monthly charges are home-level billing context and must not be assigned to one appliance for cutoff decisions.
- For tenant-assigned devices, `devices.user_approved_limit_php` is the manager hard limit. Tenant UI and APIs must hide or reject edits to hard limits, relay controls, pairing, billing-cycle settings, and account deletion.
- Budget automation runs in PostgreSQL via the `energy_logs` INSERT trigger from `012_smart_budget_controls.sql`; do not duplicate cutoff decisions in client code.
- Migration `025_budget_alert_policy.sql` records one 50% green info event and one 80% amber warning per device/billing cycle; the terminal `approval_required` or `auto_cutoff` event is the single red 100% alert.
- `devices.require_approval_on_expiry` remains the compatibility field, but public APIs expose its inverse as `auto_cutoff_enabled`. New devices default to alert-only mode (`require_approval_on_expiry = true`).
- If automatic cutoff is disabled, the trigger records `budget_status = 'approval_required'` without changing the relay. If enabled, it sets `relay_state = false` and `budget_status = 'auto_cutoff'`.
- Automatic cutoff is latched: neither a new billing cycle nor a raised limit restores power. Owners/managers must call `POST /api/devices/[deviceId]/restore` with explicit confirmation, and relay ON routes must not bypass an active cutoff.
- After migration `013_custom_billing_cycles.sql`, `device_month_usage.month_start` stores the billing-cycle start date instead of always representing the first day of a calendar month.

---

## 3. OpenAI Integration Architecture (Trigger & Cache)

These rules apply when implementing any AI-powered insight feature (e.g., Budget Alerts, Weekly Recaps).

### 3a. Persona & Tone

The OpenAI system prompt **must** define the assistant as:
- **Role:** Friendly Filipino financial and energy advisor.
- **Language:** Casual conversational Taglish (Tagalog-English mix).
- **Tone:** Encouraging, practical, and hyper-specific to the user's data.
- **Data binding:** Always reference exact PHP amounts, appliance names, and timeframes. Never give generic advice.
- **Multi-tenant tone:** Tenant insights should mention the landlord/manager-set hard limit when relevant; manager insights should frame advice around room/fleet management.

Example phrasing to steer toward:
> *"Naku boss, Day 15 pa lang pero nasa PHP 1,500 na tayo sa PHP 2,000 budget mo. Medyo dahan-dahan tayo sa washing machine this week para di tayo ma-over budget."*

### 3b. Supported Insight Types

| `insight_type` | Purpose | Required input data |
|---|---|---|
| `budget_alert` | Warns if spend trajectory will exceed the home budget this billing cycle | `currentSpend`, `monthlyBudget`, `daysElapsed` |
| `weekly_recap` | Positive reinforcement comparing week-over-week consumption | `thisWeekKWh`, `lastWeekKWh`, `thisWeekPHP`, `lastWeekPHP` |
| `anomaly_alert` | Flags unusual spikes or one-device outliers | `thisWeekKWh`, `lastWeekKWh`, top-device usage/cost |
| `cost_optimizer` | Gives one concrete savings action | `monthlyBudget`, `projectedBillingCycle`, top-device usage/cost |
| `manager_fleet_alert` | Flags the manager's highest-priority room/fleet issue | manager-owned rooms, tenant labels, hard limits, relay state |
| `manager_room_anomaly` | Highlights stale telemetry, unusual room spend, or room-level behavior | manager-owned latest readings and current-cycle room spend |
| `manager_cutoff_forecast` | Forecasts tenant-room cutoff risk against manager hard limits | per-room spend, hard limit, cycle elapsed days, relay state |
| `manager_cost_optimizer` | Suggests one manager action or tenant coaching message | top spend room, tenant assignment, hard limit, current cycle spend |

### 3b.1 Contextual Insight UX

- The dedicated `/insights` page is deprecated. Prefer small contextual cards injected into existing workflows instead of a single long AI feed.
- `budget_alert` belongs below the Home budget summary, `anomaly_alert` belongs near Burn analytics, and `cost_optimizer` belongs in device-level or device-list contexts.
- Contextual AI cards must be dismissible on the client and should remember the dismissal per insight type and message so stale repeats stay hidden.
- `app/api/insights/route.ts` must return structured JSON booleans for these cards. `budget.is_at_risk`, `anomaly.is_detected`, and `tipid_tip.has_tip` are the source of truth for rendering, not message heuristics.
- If a boolean is false, its message must be an empty string. Do not return filler text like "everything looks normal."
- If an insight payload is non-actionable, render `null` instead of a card. Clean dashboards beat mandatory AI chrome.
- Calendar habit analysis belongs in `app/api/insights/calendar/route.ts`. It should accept bounded grouped daily rows from the month calendar, keep the same Taglish persona, and return a structured JSON analysis payload suitable for a modal or side panel.
- Manager AI lives under `/manager/ai` and uses server routes under `/api/manager/ai/*`. It must scope every query to `devices.owner_id = auth.uid()`, cache manager insight cards in `ai_insights`, and keep chatbot behavior advisory-only. The chatbot must never claim it changed relays, limits, tenants, or room assignments.
- Structured insight payloads stored in `ai_insights.message` may include `billing_cycle_start_day`, `cycle_start_date`, and `cycle_end_date`. Cache reuse should validate those values before returning a billing-sensitive cached response.

### 3c. Trigger & Cache — Mandatory Flow

**Never call `openai.chat.completions.create` on page load or from a client component.**

The required server-side flow for every insight request:

```
Client requests insight
        │
        ▼
Next.js API Route (app/api/insights/route.ts)
        │
        ├─► Query ai_insights WHERE user_id = ? AND insight_type = ? AND created_at > week_start
        │
        ├─[Row found]──► Return cached message string → Done
        │
        └─[No row]
              │
              ▼
        Aggregate bounded usage data (prefer billing-grade RPCs and billing-cycle helpers over raw row loops)
              │
              ▼
        Call openai.chat.completions.create (server-side only)
              │
              ▼
        INSERT result into ai_insights table
              │
              ▼
        Return the new message string → Done
```

### 3d. Required Supabase Schema

```sql
CREATE TABLE ai_insights (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  insight_type  VARCHAR(50) NOT NULL, -- 'budget_alert' or 'weekly_recap'
  message       TEXT NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast cache-hit lookups
CREATE INDEX idx_ai_insights_user_type_date
  ON ai_insights (user_id, insight_type, created_at DESC);
```

### 3e. OpenAI API Key Security

- Store the key in `.env.local` as `OPENAI_API_KEY` (no `NEXT_PUBLIC_` prefix — server-only).
- The API call must only ever occur inside a Next.js API Route or Server Action; never in a client component or directly in a page file.

---

## 4. Home Budget Edit Scope (Single Control Point)

**Hard constraint:** `profiles.monthly_budget_php` must be editable only from the Home Dashboard wallet UI or an authenticated customer-assistant proposal that the homeowner explicitly confirms.

- Device Detail pages may display budget and burn-rate context, but must remain view-only.
- Tenant pages must remain view-only and use assigned-device hard limits instead of exposing the home budget editor.
- Use an icon-triggered editor card/popover in Home Wallet instead of a persistent budget form block.
- Save flow should update only the authenticated profile row (`WHERE id = auth user id`) and refresh the dashboard state after success.
- The customer assistant must show the exact current/proposed values, expire proposals after 15 minutes, and recheck role and ownership on confirmation. Tenants remain unable to change home budgets or device safety settings.

---

## 5. User Form Message Pattern

User-side forms must show helpful inline validation before submit and friendly recovery messages after submit.

- Add `noValidate` to custom-styled forms and handle required/format checks in React so empty submissions surface field-specific messages instead of browser popups or vague alerts.
- Keep submit buttons enabled unless an async submit is already running; disabled empty-form buttons hide the reason the user cannot continue.
- Use `aria-invalid`, `aria-describedby`, and `role="alert"` on visible error summaries.
- Normalize auth email input before Supabase calls, and map Supabase/Auth/API failures to user-facing guidance. Do not display raw database or provider error strings in user forms.
- User form helpers live in `lib/user-form-messages.ts`; dashboard-specific forms may keep local validators when the rules are tightly scoped.

---

## 6. Loading & Mutation Feedback Pattern

When implementing route or mutation feedback in the app shell and interactive controls, use the shared loading primitives and consistent pending/error behavior.

- Reuse `components/ui/LoadingIndicator.tsx` for all inline spinners (buttons, compact control states, and app-level route indicators).
- For slow server-rendered routes, add per-route `loading.tsx` files and compose skeleton layout blocks with `LoadingSkeleton` / `LoadingSkeletonText` to match page structure.
- For API mutations (for example relay toggles and home budget saves), always disable actionable controls while the request is in-flight.
- For mutation failures, surface a visible toast-style error near the bottom safe area and auto-dismiss it after a short interval.
- Keep feedback local to the control context: inline spinner for pending state, toast for recoverable errors, and preserve optimistic UI rollback when the mutation fails.

---

## 7. Root Agent Context File

- Keep the root `AGENTS.md` aligned with the current repo architecture, commands, and non-negotiable workflow constraints.
- When a repo-wide workflow rule changes materially, update `AGENTS.md` alongside this file instead of letting the two drift.

---

## 8. Budget Notification Delivery

- External notifications must be triggered from deduplicated `device_budget_events`, never directly from high-volume `energy_logs`.
- Channel policy is fixed for the current MVP: 50% in-app only, 80% push, and `approval_required`/`auto_cutoff` push plus email.
- Notify both `COALESCE(devices.owner_id, devices.user_id)` and `devices.tenant_id`, deduplicating when they resolve to the same profile.
- OneSignal must target the private `notification_preferences.onesignal_external_id`; never expose Supabase user UUIDs as provider aliases.
- Push permission requires an explicit Settings action. Never auto-prompt during page load or sign-in.
- Provider calls run only in `dispatch-budget-notifications`, use the delivery UUID as the provider idempotency key, retry only `429`, `5xx`, and network failures, and never block Smart Control or telemetry writes.
- Treat the OneSignal App ID as a public UUID configuration value: validate its shape and retain the verified WattWise app identifier as a safe fallback so a provider secret pasted into the wrong field cannot cause opaque HTTP 400 failures. Preserve sanitized structured provider error bodies in delivery evidence.
- Missing provider credentials must produce a `skipped/provider_not_configured` delivery instead of breaking the budget-event workflow.
- Deploy the dispatcher with `--no-verify-jwt` only because it performs its own authentication for both the shared-secret Database Webhook and authenticated test requests.
- Full provider and webhook setup is documented in `NOTIFICATION_SETUP.md`.

## 9. Admin Test Lab

- `/admin/test-lab` is super-admin-only and verifies the real telemetry → budget-event → webhook → provider flow; it must never fabricate delivery results.
- Standard test thresholds are 50% (in-app only), 80% (push), and the applicable 100% terminal event (push plus email). Existing current-cycle event deduplication is preserved; use a fresh demo unit for a repeat.
- Physical-device tests require the exact device-name confirmation and a meaningful audit reason. They persist telemetry and possible cutoff state; never add an automatic rollback.
- Every Test Lab mutation uses `requireAdminApi`, server-side service access, and `writeAdminAudit`. Provider secrets and private notification aliases remain server-only.
- Report JSON, CSV, and PDF exports must share the same authenticated, bounded report calculation. PDF generation stays server-side and must not introduce a separate billing or telemetry calculation path.

## 10. Customer AI Assistant

- Customer chat lives under `/api/customer-assistant/*`; OpenAI remains server-only and uses only the authenticated user's visible devices, bounded current-cycle usage, home budget, live-state summary, and notification preferences.
- The model may suggest a strict structured proposal but can never perform a mutation. Only the confirmation route may write, after rechecking role, ownership, valid ranges, current state, expiry, and single-use status.
- Homeowners may confirm home-budget, owned-device limit, automatic-cutoff, and own notification-preference changes. Tenants may confirm only their own notification preferences.
- Chat never operates relay power, restores cutoff devices, changes credentials/billing-cycle dates/Wi-Fi/pairing, or deletes data.
- `customer_ai_messages` is readable only by its owning user. Browser roles have no INSERT/UPDATE/DELETE grants; trusted server routes write through the service role and retain only the latest 10 messages.
- Enforce the persisted rolling message limit before calling OpenAI. If OpenAI is missing or fails, return contextual advice from current WattWise data without fabricating an action proposal.
- Common bill-driver and device-list questions must use deterministic grounding from current-cycle `device_month_usage` plus latest telemetry before calling OpenAI. Never ask the customer to guess which device is expensive when WattWise already has ranked device data.
- When calendar-month spend differs from the current billing-cycle accumulator, show both windows explicitly. Calendar-month answers must use the same bounded daily usage plus active Meralco-rate calculation as Calendar Analytics; device-limit progress remains billing-cycle-only.
- Rich assistant output is an allowlisted `display_data` payload. The current MVP supports only `device_list`, with at most eight server-resolved devices; never render arbitrary model HTML or model-supplied database identifiers.

---

## Quick Reference — What NOT to Do

| Situation | Forbidden | Required instead |
|---|---|---|
| Computing energy cost | `kWh * 10` | Unbundled rates + 12% VAT |
| Fetching energy data | `.from('energy_logs').select('*')` | Add `.limit(100)` or date filter |
| Generating AI insights | Call OpenAI from client on page load | Check `ai_insights` cache first via API route |
| OpenAI API key | `NEXT_PUBLIC_OPENAI_API_KEY` | `OPENAI_API_KEY` (server-only) |
| Editing home budget | Unconfirmed or tenant-side writes | Home wallet editor, or a homeowner-confirmed assistant proposal that updates only their profile |
| User form errors | Raw provider/DB messages, alerts, or disabled empty-submit buttons | Inline field messages plus friendly submit-level guidance |
| API mutation feedback | Keep controls active and silent on errors | Disable pending controls, show inline `LoadingIndicator`, and display auto-dismiss error toast |
| Appliance shutoff | Client-side cutoff math | PostgreSQL trigger updates `devices.relay_state` from `device_month_usage` |
