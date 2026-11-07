---
description: Wattwise platform coding constraints — Meralco billing precision, hardware safety handshake, data ingestion throttling, and OpenAI integration architecture. Apply when writing API routes, energy calculations, UI controls, Supabase queries, or AI insight features.
applyTo: "**"
---

# Wattwise Platform — AI Agent Workflow & Constraints

## 1. Meralco Billing Precision (The "No Flat Rate" Rule)

**Hard constraint:** Never calculate energy cost with a single flat rate multiplier (e.g., `totalKWh * 10`). This is incorrect and academically indefensible.

**Required pattern:** Compute every cost with `lib/meralco-bill.ts` (`computeMeralcoBill`, `computeVariableRatePerKwh`, `computeFixedChargesWithVat`). It mirrors Meralco's Summary Schedule of Rates:

- Generation, Transmission, and Ancillary Service carry their own monthly effective VAT rates (`vat_generation`, `vat_transmission`, `vat_ancillary`; NULL on older rows falls back to `vat_rate`).
- Distribution, supply, metering, the fixed customer charges, and the AWAT refunds / regulatory reset / lifeline rate / senior citizen adjustments carry the general VAT rate (`vat_rate`, the schedule's "Other Charges").
- System Loss, Universal Charge (the sum of UC-ME NPC-SPUG, UC-ME RED-CI, UC-EC, and UC-SD), FIT-All, GEA-All, RPT, the lifeline subsidy, and energy tax carry no VAT.
- Distribution is one rate on all kWh, picked by the whole home's monthly kWh (up to 200 / 201-300 / 301-400 / over 400). Energy tax applies above 650 kWh a month. `applyHouseholdTier` sets both from the household kWh: the homeowner's bill (`profiles.meralco_monthly_kwh`) or monitored usage projected over the cycle. The server loaders in `lib/meralco-rates-server.ts` apply it for the signed-in user; pass `{ household }` when pricing someone else's home.

```ts
// CORRECT
const activeRate = await getActiveMeralcoRates(supabase); // lib/meralco-rates-server.ts
const cost = computeMeralcoBill(kWh, activeRate.rates, activeRate.vatRate, {
  fixedChargesPhp: activeRate.fixedMonthlyChargesPhp,
});

// WRONG — never do this
// const cost = kWh * 10;
// const cost = sumOfComponents * kWh * 1.12; // single VAT rate on everything
```

The SQL budget trigger uses the same formula through `public.meralco_variable_rate_per_kwh(rate, household_kwh)` and `household_monthly_kwh_for()`; change both together. Lifeline discounts (100 kWh and below) and the local franchise tax are not modelled.

- In app/runtime code, fetch the active row from `meralco_rates` (`effective_month <= current_date`, ordered descending, `limit 1`) and map DB fields with `mapMeralcoRatesRowToComponents` (all components, adjustments, and component VAT columns in `MERALCO_RATE_SELECT`) before calling `computeMeralcoBill`.
- For automated rate ingestion, use Meralco's rates archive (`https://www.meralco.com.ph/governance/regulatory/rates-archive`; the old `company.meralco.com.ph` page redirects to the homepage since November 2026) as discovery source. Each document is a card with a category line and a month link (`parseArchiveEntries` in `supabase/functions/sync-meralco-rates/parser.ts`); select the **Summary of Schedule of Rates** PDF for the target month. PDF file names are content hashes, so never hardcode them.
- Customer-facing rate views must distinguish the effective month from the time WattWise fetched the row, and show the recorded Meralco archive/PDF link where available. Never imply a manual legacy row has an official source link.
- Preferred scheduler cadence is daily around 10:00-12:00 PM PH time. In automatic mode, first check whether the current Manila month (`YYYY-MM-01`) already exists in `meralco_rates`; if present, return a no-op and skip external fetch/upsert.
- If current month is not yet in DB, attempt current-month Summary Schedule lookup first; if not published yet, fall back to latest available summary and only write when that effective month is missing.
- Automation must extract **base non-lifeline residential components** for `meralco_rates` and ignore lifeline-only discount/subsidy rows unless tiered billing schema is explicitly implemented. Treat Ancillary Service as its own per-kWh field, and never confuse variable Supply/Metering columns with their adjacent fixed customer-charge columns.
- In fully automatic mode (no admin approval), enforce strict parser validation: required fields present, sane numeric ranges, and month-over-month anomaly threshold checks. Abort write on validation failure; do not partially update the active rate row.
- Prefer storing sync provenance and observability metadata when available (`source_url`, `source_pdf_url`, `fetched_at`, `auto_updated`) and writing run logs to a dedicated table for failed/success runs.
- `sync-meralco-rates` runs in Supabase's Deno Edge Runtime. Do not import Node-oriented `pdfjs-dist` builds there: use a configured server-side text extractor first, then the text-only PDF proxy fallback. A failed extraction must return a logged error and never write an unvalidated rate row.
- When `energy_logs.energy_kwh` stores cumulative meter readings, never sum all rows directly for a billing period. Compute usage from **sequential deltas** (`current - previous`) per device after minute-bucket dedupe; treat tiny negative drift as jitter (`0`) and only treat large drops as meter reset. Prefer DB RPC aggregation over client-side row scans for monthly/weekly totals.
- The application must be DB-only: do not use in-code default rate constants, including VAT.
- If the table query returns no rows or the query fails, surface a clear, actionable admin-visible error or warning (server-side) instructing the admin to add a `meralco_rates` entry. Do not silently fall back to hardcoded constants.
- All cost values displayed in the UI must be derived from this calculation, never hardcoded.

---

## 2. Data Ingestion Throttling (Free Tier Guardrail)

**Hard constraint:** Never query the `energy_logs` table (or any high-volume table) without a hard row limit or a time-range filter. Fetching unbounded rows will crash the browser and time out the Supabase API.

**Required pattern — always scope queries:**

```ts
// CORRECT — time-range filter with a limit guard (energy_logs is timed by recorded_at)
const { data } = await supabase
  .from('energy_logs')
  .select('device_id,average_watts,voltage_v,current_a,recorded_at')
  .eq('device_id', deviceId)
  .gte('recorded_at', startOfDay.toISOString())
  .lte('recorded_at', endOfDay.toISOString())
  .order('recorded_at', { ascending: false })
  .limit(100);

// CORRECT — server-side aggregation (prefer this for totals and charts)
const { data } = await supabase.rpc('get_usage_kwh_by_device', {
  p_user_id: userId,
  p_start: startOfDay.toISOString(),
  p_end: now.toISOString(),
});

// WRONG — never do this
// const { data } = await supabase.from('energy_logs').select('*');
```

- Default to `.limit(100)` when the exact row count is unknown.
- For chart data, prefer server-side aggregation via Supabase RPC functions over client-side array processing.
- For billing-grade totals, use RPCs that aggregate by minute and sum cumulative deltas (`get_usage_kwh_by_device`, `get_usage_kwh_by_device_day`) instead of raw row loops.
- Cache idempotent client-side API reads with SWR and the shared `lib/fetcher.ts` JSON fetcher to preserve stale data during back-navigation while revalidating in the background.
- When correlating `energy_logs.device_id` to devices, normalize and support both key formats (`devices.id` and legacy `devices.mac_address`) to avoid zeroed dashboard totals during schema transition.
- For "active appliance" status in UI cards, use `isFreshReading` and `ACTIVE_READING_WINDOW_MS` from `lib/device-telemetry.ts` (20 seconds) before showing live wattage. Stale readings must render as offline or idle; `devices.is_online` is never reset and is not a freshness signal.
- For Device Detail metrology gauges, query only the latest row with scoped filters and read `average_watts`, `voltage_v`, and `current_a`; if `voltage_v`/`current_a` are null on legacy rows, fall back safely without removing the freshness gate.
- For Home Dashboard device cards, derive online/offline from telemetry freshness and expose live `average_watts`, `voltage_v`, and `current_a` (with safe voltage/current fallback for legacy rows) so W/V/A stays coherent with live status.
- On the Home Dashboard, patch telemetry directly and refresh only when `devices.relay_state` or `devices.budget_status` changes. Ignore heartbeat-only device updates; do not add a page refresh per reading. The device-detail page currently uses `RealtimeRefreshBridge` for scoped, throttled server refreshes and skips hidden-tab work.
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
- When live Meralco prompt context is unavailable, the profiler may fall back to PHP 12/kWh for AI copy only. The suggested limit is always `estimated_monthly_kwh` × a fixed PHP 12/kWh safety factor; it is a starting limit the user approves, not a bill. Billing-grade cost logic must still come from the DB-backed unbundled Meralco computation path.
- Per-device shutoff compares current billing-cycle variable Meralco spend against `devices.user_approved_limit_php`. The cycle boundary comes from `profiles.billing_cycle_start_day` in Asia/Manila. Fixed monthly charges are home-level billing context and must not be assigned to one appliance for cutoff decisions.
- For tenant-assigned devices, `devices.user_approved_limit_php` is the manager hard limit. Tenant UI and APIs must hide or reject edits to hard limits, relay controls, pairing, billing-cycle settings, and account deletion.
- Budget automation runs in PostgreSQL via the `energy_logs` INSERT trigger from `012_smart_budget_controls.sql`; do not duplicate cutoff decisions in client code.
- Migration `025_budget_alert_policy.sql` records one 50% green info event and one 80% amber warning per device/billing cycle; the terminal `approval_required` or `auto_cutoff` event is the single red 100% alert.
- `devices.require_approval_on_expiry` remains the compatibility field, but public APIs expose its inverse as `auto_cutoff_enabled`. New devices default to alert-only mode (`require_approval_on_expiry = true`).
- If automatic cutoff is disabled, the trigger records `budget_status = 'approval_required'` without changing the relay. If enabled, it sets `relay_state = false` and `budget_status = 'auto_cutoff'`.
- Automatic cutoff is latched: neither a new billing cycle nor a raised limit restores power. Owners/managers must call `POST /api/devices/[deviceId]/restore` with explicit confirmation, and relay ON routes must not bypass an active cutoff.
- After migration `013_custom_billing_cycles.sql`, `device_month_usage.month_start` stores the billing-cycle start date instead of always representing the first day of a calendar month.

### 2c. Demo-unit lifecycle

- `public.simulate_demo_units()` runs through pg_cron every 10 seconds (migration `039`). The previous Edge Function and manual Run now endpoint are removed.
- An explicit Start (`PATCH /api/admin/demo-units/[deviceId]` with `is_active: true`) must clear `live_since` in the same update. The simulator establishes the new timestamp on its next tick, preventing an expired run from immediately pausing again. Pause and settings-only edits must not renew the run.
- Start preserves `energy_kwh` and `last_generated_at`, allowing the SQL simulator to backfill an existing gap in 15-minute steps, capped at 14 days. New or reset meters have no prior timestamp and begin with live readings rather than seeded history. Meter reset retains historical rows.
- Keep regression coverage for restarting after the four-hour timeout and after a short manual pause. The restart fix changes the admin write contract only; it requires no new migration beyond `039`.

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
        ├─► Query ai_insights WHERE user_id = ? AND insight_type = ? AND created_at >= now() - cache window
        │     (CACHE_WINDOW_DAYS: 1 day budget_alert/anomaly_alert, 7 days weekly_recap/cost_optimizer)
        │
        ├─[Row found and its billing-cycle metadata matches]──► Return cached payload → Done
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
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES profiles(id) ON DELETE CASCADE,
  insight_type      VARCHAR(50) NOT NULL, -- any type in 3b
  message           TEXT NOT NULL,        -- structured JSON payload for contextual cards
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

### 5a. Form submit states

- Full-width form submits use `components/ui/SubmitButton.tsx` with a `SubmitStatus` of `"idle" | "loading" | "success"` and three labels (`idleLabel`, `loadingLabel`, `successLabel`). The labels share one grid cell and crossfade, so the button never changes size; a polite `role="status"` region announces the processing and done states. Do not hand-roll a spinner-in-button for these forms.
- Flow: validate first (field errors, no status change) → `setStatus("loading")` → on failure, set a friendly message and return to `"idle"` → on success, `"success"`. When success navigates away, leave the button in `"success"` (it stays disabled) so a second tap cannot resubmit mid-navigation.
- Leave the `disabled` prop unset so the button stays tappable and validation can explain what is missing. `UpdatePasswordForm` currently passes `disabled` until both password fields are filled; do not copy that.
- Show the submit-level error with `components/ui/FormAlert.tsx` (`message={string | null}`), placed above the form. It renders nothing for `null`, has `role="alert"`, and eases in. Field-level messages stay inline under each field.
- Used today in login, register, forgot-password, and `UpdatePasswordForm` (reset and update password).

---

## 6. Loading & Mutation Feedback Pattern

When implementing route or mutation feedback in the app shell and interactive controls, use the shared loading primitives and consistent pending/error behavior.

- Reuse `components/ui/LoadingIndicator.tsx` for inline spinners in compact controls (relay toggles, budget saves, panels). Full-width form submits use `SubmitButton` (5a).
- Route loading is shown once, app-wide, by `components/ui/RouteTransitionIndicator.tsx` (a thin top progress bar mounted in `app/layout.tsx`). Do not add per-page navigation spinners.
- For slow server-rendered routes, add per-route `loading.tsx` files and compose skeleton layout blocks with `LoadingSkeleton` / `LoadingSkeletonText` to match page structure. Start them with `PageTitleSkeleton` (from `components/ui/PageHeader.tsx`) so the desktop title block has a placeholder; it renders nothing on phones.
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
- Homeowners may confirm home-budget, owned-device limit, automatic-cutoff, scheduled turn-off, and own notification-preference changes. Tenants may confirm only their own notification preferences.
- Scheduled turn-offs (`schedule_turn_off`, migration `041`): the model sends only a device ref and either `{"trigger":"time","time":"HH:MM"}` or `{"trigger":"spend"|"usage","php"|"kwh":n,"until":"HH:MM"|null}`. `resolveAutomationRequest()` (`lib/device-automations.ts`) turns that into Manila timestamps on the server; never accept model-supplied timestamps. Confirmation calls `create_device_automation()`, which rechecks owner role, ownership, the 7-day window, and the 5-active-rules cap. `run_device_automations()` (pg_cron, every 15 s) only ever sets `relay_state = false`. Spend and usage count from confirmation, using `device_month_usage` deltas (already Meralco-priced), not from the start of the billing cycle.
- Chat never turns relay power on, switches it immediately, restores cutoff devices, changes credentials/billing-cycle dates/Wi-Fi/pairing, or deletes data. Scheduled turn-offs are the only relay effect, and only after the owner confirms.
- `customer_ai_messages` is readable only by its owning user. Browser roles have no INSERT/UPDATE/DELETE grants; trusted server routes write through the service role and retain only the latest 10 messages.
- Scope guardrail: the assistant only discusses the user's energy, bills, rates, budgets, devices, saving tips, and WattWise. `offTopicReply()` (`lib/customer-assistant-policy.ts`, tested in `tests/customer-assistant-scope.test.ts`) answers clear off-topic requests (code, homework, essays) with a fixed reply before any context load or OpenAI call; anything mentioning energy words always reaches the model, whose system prompt also refuses off-topic requests and prompt-injection attempts.
- Enforce the persisted rolling message limit before calling OpenAI. If OpenAI is missing or fails, return contextual advice from current WattWise data without fabricating an action proposal.
- Common bill-driver and device-list questions must use deterministic grounding from current-cycle `device_month_usage` plus latest telemetry before calling OpenAI. Never ask the customer to guess which device is expensive when WattWise already has ranked device data.
- When calendar-month spend differs from the current billing-cycle accumulator, show both windows explicitly. Calendar-month answers must use the same bounded daily usage plus active Meralco-rate calculation as Calendar Analytics; device-limit progress remains billing-cycle-only.
- Rich assistant output is an allowlisted `display_data` payload. The current MVP supports only `device_list`, with at most eight server-resolved devices; never render arbitrary model HTML or model-supplied database identifiers.

## 10a. Public Landing Chatbot

- `POST /api/public-assistant` is the only signed-out OpenAI route. It never reads accounts or devices, has no tools or actions, and stores no messages; the client sends the last few turns back.
- Order of checks: same-origin `Origin`, `parsePublicChatBody`, `take_public_chat_slot()` (rate limit, migration `042`), `publicGuardReply`, then OpenAI with `max_tokens` 300. A rate-limit RPC error returns 503; never skip the limiter.
- The model may only state facts in `PUBLIC_ASSISTANT_SYSTEM_PROMPT`. It must not invent prices, stock, warranty, delivery, or contact details, must not collect personal data, and sends visitors to log in for anything about their own account.
- Off-topic detection is shared with the customer assistant (`isClearlyOffTopic` in `lib/customer-assistant-policy.ts`); add prompt-injection phrasings to `INJECTION_PATTERN` with a test.

## 11. UI Shell, Theme, and Motion

The base rules (tokens, card and grid classes, `pt-[84px] lg:pt-0`, motion naming) are in `AGENTS.md` under "UI and design system". This section covers what agents most often get wrong.

### 11a. Desktop layout (Tailwind `lg`, 1024px+)

- Never add a page-level frame. `components/ui/AppFrame.tsx` (root layout) picks it by path: `APP_SHELL_PREFIXES` get `AppSidebar` plus the rounded `DESKTOP_PANEL`; `/login`, `/register`, and `/forgot-password` get the `AuthBrandPanel` split; `/admin`, `/manager`, `/onboarding`, `/pitch-deck`, `/privacy`, and `/terms` lay themselves out; everything else (including `/reset-password` and `/update-password`) stays in the 430px phone column.
- A new customer route needs its prefix in `APP_SHELL_PREFIXES` and an entry in `APP_TABS` or `APP_DESKTOP_SECTIONS` (`components/ui/app-nav.ts`). Settings is not listed in the sections; the sidebar adds it at the bottom. Active items come from `getActiveHref` (longest match wins).
- The manager portal reuses `AppSidebar` with `MANAGER_DESKTOP_SECTIONS` and `DESKTOP_PANEL` inside `ManagerShell`; admin keeps its own `AdminSidebar`.
- `PageHeader` is the only page header. It never shows a logout button (log out is in Settings → Account and the sidebar). On desktop it drops the back button, icon, and eyebrow and shows `description` and `desktopTitle`. Sub-pages that need a way back on desktop add a breadcrumb, as Device Detail does.
- Fixed elements that should centre on the panel (toasts) use `lg:left-[calc(50%+var(--app-sidebar,0px)/2)]`; `AppFrame` sets `--app-sidebar`.
- The phone bottom bar (`BottomNav`) is `lg:hidden`; do not render desktop-only navigation inside pages.

### 11b. Theme tokens

- Light mode is tokens only: `[data-theme="light"]` redefines `fg`, `accent`, `shade`, `sidebar`, `canvas`, `surface`, and darker `bida`/`naku`/`danger` in `app/globals.css`. Never add per-class overrides such as `[data-theme="light"] .text-white\/60`; they were deleted.
- `dark:` follows `data-theme` on `<html>` (custom variant), not the OS setting. There is no "System" option yet.
- Charts read `var(--chart-axis)`, `var(--chart-grid)`, `var(--chart-track)`, `var(--chart-muted-bar)`, and `var(--color-mint)` rather than literal colours.
- The saved theme (`localStorage` key `wattwise-theme`) is applied before paint by `THEME_BOOT_SCRIPT` in `app/layout.tsx`; change it only through `ThemeProvider` (`setTheme` / `toggleTheme`). Pages, including the splash, must not force `data-theme`.
- The owl is `BrandMark` (CSS mask, painted in the current text colour). Size it with `h-*`/`w-*` and colour it with `text-*`; do not swap in a robot or generic bot icon for the assistant or manager AI.
- Remaining light-mode work (System option, card shadow, QA of manager, admin, and signed-out pages) is tracked in `docs/light-mode-plan.md`.

### 11c. Motion

- Every new keyframe or entrance needs a `prefers-reduced-motion` fallback (see the `ww-fade` swaps in `app/globals.css`). Under reduced motion all transitions under `html[data-theme]` are already turned off.
- Use `starting:` for mount entrances (for example budget bars: `origin-left starting:scale-x-0` with `transition-[width,scale]`). Keep `ww-stagger` on page bodies and `lg:ww-enter` on title blocks; both are `backwards`-filled, so do not change them to `both`/`forwards` (a lingering transform traps fixed children).
- `ww-splash-*` belongs to the `/` splash and `ww-rise` to decorative brand content (sign-in panel). Do not reuse them for app content.

### 11d. Landing page (`/onboarding`)

- three and @react-three/fiber are imported only inside `components/landing/device/`, and `WattWiseCanvas` loads through `next/dynamic` with `ssr: false`. Keep it that way so the 3D code never reaches app routes.
- `WattWiseStage` must keep its fallbacks: the `DevicePoster` SVG shows until the first 3D frame and stays when WebGL is missing, the canvas throws, or the context is lost; rendering pauses while offscreen; reduced motion is passed to the canvas.
- Lenis (`components/landing/SmoothScroll.tsx`) is landing-only and skipped under reduced motion; do not mount it in the app shell. `Reveal` handles the scroll reveals.
- Overlays on the landing page that scroll (the chatbot panel) need `data-lenis-prevent`, or Lenis swallows wheel scrolling inside them.

---

## Quick Reference — What NOT to Do

| Situation | Forbidden | Required instead |
|---|---|---|
| Computing energy cost | `kWh * 10`, or one VAT rate on everything | `computeMeralcoBill` from `lib/meralco-bill.ts` with the active `meralco_rates` row (per-component VAT, household tiers) |
| Fetching energy data | `.from('energy_logs').select('*')` | Bounded RPCs, or a `recorded_at` range plus `.limit(100)` |
| Generating AI insights | Call OpenAI from client on page load | Check `ai_insights` cache first via API route |
| OpenAI API key | `NEXT_PUBLIC_OPENAI_API_KEY` | `OPENAI_API_KEY` (server-only) |
| Editing home budget | Unconfirmed or tenant-side writes | Home wallet editor, or a homeowner-confirmed assistant proposal that updates only their profile |
| User form errors | Raw provider/DB messages, alerts, or disabled empty-submit buttons | Inline field messages, `FormAlert` for the submit-level message, `SubmitButton` for state |
| API mutation feedback | Keep controls active and silent on errors | Disable pending controls, show inline `LoadingIndicator`, and display auto-dismiss error toast |
| Appliance shutoff | Client-side cutoff math | PostgreSQL trigger updates `devices.relay_state` from `device_month_usage` |
| Colours | `text-white`, `bg-white/5`, new hex values, `[data-theme="light"]` class overrides | `fg`/`accent`/`shade` tokens (`text-fg/60`, `bg-fg/[0.04]`, `text-accent`) |
| Desktop layout | A page-level sidebar or frame, or a desktop back button | `AppFrame` + `app-nav.ts` entries, `PageHeader` `description`, breadcrumb for sub-pages |
| 3D / smooth scroll | Importing three or Lenis outside `components/landing/` | Keep them in `components/landing/` on `/onboarding`; the 3D canvas loads with `next/dynamic` (`ssr: false`) |
