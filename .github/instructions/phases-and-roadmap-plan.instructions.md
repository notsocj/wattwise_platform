---
description: WattWise implementation roadmap — Foundation, Billing & Control, AI & PWA, Super Admin, Multi-Tenant. Load when planning sprint work, checking phase dependencies, or onboarding contributors.
applyTo: "**"
---

# WattWise Platform — Implementation Roadmap

> **Last Updated:** November 7, 2026
> **Architecture:** Next.js 16.1.7 (React 19) + Supabase + ESP32-S3 + OpenAI
> **Billing source:** active `meralco_rates` row, with household distribution tiers and per-component VAT; no fixed runtime rate.

---

## Progress Summary

Completion percentages below are earlier planning estimates, not a fresh acceptance-test result. Checked implementation items describe source code; physical acceptance and deployment must be verified separately using `TESTING.md`.

| Phase | Status | Completion | Notes |
|---|---|---|---|
| 1 — Foundation | In Progress | ~82% | Auth, middleware, design system, bounded telemetry RPCs, and Realtime are implemented. Dashboard cards patch W/V/A directly and refresh only on relay/budget changes; device detail uses a throttled refresh bridge. Migrations through `042` define the current schema. Desktop layout (sidebar + panel at `lg`), token-based light mode, and motion tokens shipped 2026-11-07 (UI only). Hardware firmware samples every 2 s and schedules uploads and relay reads every 5 s; online freshness is 20 s. Physical acceptance remains unrecorded. |
| 2 — Billing & Control | In Progress | ~92% | Device Detail UI + Home Wallet + Meralco billing implemented; usage is aggregated via bounded RPCs; Smart Control now standardizes 50/80/100 in-app alerts, opt-in per-device automatic cutoff, variable-spend-only control progress, cutoff-safe relay guards, and explicitly confirmed manual power restoration; `billing_cycle_start_day` drives wallet, analytics, alerts, and cutoff windows. The device diagnostics footer (RSSI, board temperature) is not built. |
| 3 — AI & PWA | In Progress | ~88% | AI insights API route and customer AI assistant MVP are implemented; the assistant provides account-scoped Taglish guidance and explicit-confirmation setting proposals. OneSignal web-push and Resend critical-email delivery are implemented for 80%/100% budget events; Serwist offline caching, the service worker, and an install prompt are still pending |
| 4 — Super Admin | In Progress | ~90% | Admin layout, guards, users/devices/audit pages, and demo-unit controls implemented; demo units stream every 10 s through pg_cron and backfill existing gaps (migration `039`). Explicit Start resets the run timer so units can restart after the four-hour auto-pause. Rate editor (audited, cache-expiring), Growth, AI Costs (estimated USD), Health (real database size), and Global Analytics (platform daily kWh) are built (migration `043`). Open: MRR and a savings estimate (no pricing or baseline yet), token tracking for chat replies, and a phone layout for the admin console. |
| 5 — Multi-Tenant | In Progress | ~55% | Additive `owner_id`/`tenant_id` schema and RLS added; public registration can choose home user or property manager; manager portal now has dedicated Fleet, Rooms, Tenants, Calendar, AI, and Settings routes and uses the shared desktop sidebar (`MANAGER_DESKTOP_SECTIONS`); managers can create tenants, pair hardware, assign rooms, set hard limits, override relays, and consult scoped manager AI; tenant dashboard/settings/analytics use assigned devices and hide owner controls |

---

## Phase 1: Foundation & "The Digital Twin"

**Objective:** Establish the complete data pipeline — from the physical PZEM-004T sensor on the ESP32-S3, through Supabase, to a live dashboard in the browser. By the end of this phase, a user can register, pair a device, and see real-time Watts on screen.

### Platform Tasks (Web)

- [x] **Supabase Project Bootstrap**
  - [ ] Verify the target environment's Supabase project and `.env.local` configuration (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`); source files do not prove deployment configuration
  - [x] Run SQL migrations to create all 5 tables: `profiles`, `meralco_rates`, `devices`, `energy_logs`, `ai_insights` *(migration at `supabase/migrations/001_initial_schema.sql`)*
  - [x] Create all required indexes (`idx_energy_logs_device_time`, `idx_ai_insights_user_type_date`)
  - [x] Enable Row Level Security (RLS) policies on all tables

- [x] **Authentication Flow**
  - [x] Implement Supabase Auth provider wrapper in `app/layout.tsx` *(`SupabaseProvider` reads the browser session; the root layout does not read cookies or headers. Server pages use middleware-verified identity through `getSessionUser()`.)*
  - [x] Add global route-transition loading indicator in root layout *(`components/ui/RouteTransitionIndicator.tsx`, wired in `app/layout.tsx`; a thin top progress bar since 2026-11-07)*
  - [x] Build Registration page (`app/register/page.tsx`) — fields: account type (home user or property manager), Full Name, Email, Password *(UI complete + Supabase `signUp` wired)*
  - [x] Build Login page (`app/login/page.tsx`) — fields: Email, Password + "Forgot Password" link *(UI complete + Supabase `signInWithPassword` wired)*
  - [x] Shared auth form states: `SubmitButton` (idle → processing → success) and `FormAlert` in login, register, forgot-password, and `UpdatePasswordForm`; desktop split layout with `AuthBrandPanel` on login, register, and forgot-password
  - [x] Build Splash (`app/page.tsx`, CSS keyframe intro that prefetches and redirects) and the Onboarding landing page (`app/onboarding/page.tsx`: full-width, 3D WattWise unit, scroll reveals, Lenis smooth scrolling)
  - [x] Implement auth middleware to protect `/dashboard` and other authenticated routes *(`proxy.ts` — uses Next.js 16 `proxy` convention)*
  - [x] Auto-create `profiles` row on sign-up via Supabase trigger or client-side insert *(PostgreSQL trigger `handle_new_user` in migration)*
  - [x] **Password Reset Flow** *(fully functional with Supabase email integration)*
    - [x] Build Forgot Password page (`app/forgot-password/page.tsx`) — prompts for email, sends reset link
    - [x] Build Reset Password page (`app/reset-password/page.tsx`) — validates token, sets new password
    - [x] Implement `supabase.auth.resetPasswordForEmail()` for sending recovery emails
    - [x] Implement `supabase.auth.updateUser()` for password update with token validation
    - [x] Add error handling for expired/invalid tokens and password validation
    - [ ] Setup guide for the Supabase reset-email configuration *(`FORGOT_PASSWORD_SETUP.md` is no longer in the repo; only the manual checks in `TESTING.md` cover this flow)*

- [x] **Design System Setup** *(95% complete)*
  - [x] Load **Space Grotesk** using `next/font/google` in `app/layout.tsx`, self-hosted as variable woff2 and mapped to the shared font token
  - [x] Configure Tailwind 4 custom tokens in `app/globals.css`: `canvas (#121212)`, `surface (#1E1E1E)`, `mint (#00E66F)`, `bida (#10B981)`, `naku (#F59E0B)`, `danger (#EF4444)`, plus `fg`, `accent`, `shade`, `sidebar`, and `ink` (dark values shown)
  - [x] Define `mint-glow` utilities *(`shadow-mint-glow` / `text-mint-glow` still exist but are no-ops: the glow was removed globally)*
  - [x] Light mode through theme tokens: `fg`, `accent`, `shade`, `sidebar`, and darker `bida`/`naku`/`danger` switch under `[data-theme="light"]`; hard-coded white classes and the 46 per-class light overrides are gone; a boot script in `app/layout.tsx` applies the saved theme before paint; the splash follows the theme; toggle in Settings and the desktop sidebar *(2026-11-07)*
  - [ ] Light mode follow-ups: a "System" theme option, a light-mode card shadow, and a light-mode QA pass of manager, admin, and signed-out pages *(see `docs/light-mode-plan.md`)*
  - [x] Desktop layout (Tailwind `lg`, 1024px+): `components/ui/AppFrame.tsx` picks the frame by path; app routes get `AppSidebar` (groups from `APP_DESKTOP_SECTIONS` in `components/ui/app-nav.ts`) and sit on the rounded `DESKTOP_PANEL`; `PageHeader` becomes an in-page title block; shared cards from `components/ui/Card.tsx` *(2026-11-07)*
  - [x] Motion tokens: `ease-out` / `ease-in-out` / `ease-drawer` easings, `ww-enter` / `ww-stagger` page entrances, budget bars that fill in on load, each with a reduced-motion fallback *(2026-11-07)*
  - [ ] Set global `border-radius: 8px` (Round Eight) default for cards and buttons *(not adopted: cards use `CARD` with `rounded-2xl`, buttons use `rounded-xl`)*

- [x] **Device Pairing & Registration**
  - [x] Build "Add Appliance" UI flow — user enters device name + MAC address *(four-step registration, type, live telemetry, and budget approval flow; unfinished same-owner MAC setup is resumable)*
  - [x] Insert new row into `devices` table with `owner_id`/legacy `user_id`, `device_name`, `mac_address`
  - [x] Display paired devices in a grid on the Home Dashboard (`app/dashboard/page.tsx`) *(data now loaded from `devices` table)*

- [x] **Live Dashboard — Real-time Telemetry**
  - [x] Subscribe to scoped `energy_logs` INSERTs for direct dashboard W/V/A updates, and `devices` UPDATEs for relay/budget changes. Ignore heartbeat-only updates; the device-detail page separately uses `RealtimeRefreshBridge` for throttled server refreshes.
  - [x] Display live **Power (W)** gauge on each device card *(cards now show live online/offline state plus W/V/A telemetry with freshness gating)*
  - [x] Display **Total Live Wattage** aggregate across all user devices at the top of the dashboard
  - [x] Load latest readings and usage through bounded, index-backed RPCs (`get_latest_device_readings`, `get_usage_kwh_by_device[_day]`); keep direct telemetry reads scoped and bounded

- [ ] **Historical Charts (Daily View)**
  - [x] Create Supabase RPC function `get_hourly_averages(p_user_id, p_date)` for server-side aggregation *(migration at `supabase/migrations/007_get_hourly_averages.sql` — Asia/Manila timezone, avg_watts per hour-of-day)*
  - [ ] Build daily bar chart using **Recharts** `BarChart` with responsive container
  - [ ] Cache chart data using SWR or TanStack Query to prevent re-fetches on re-render

### Hardware Tasks (Firmware)

- [x] **ESP32-S3 PlatformIO Project Setup** *(implemented in `wattwise_hardware`; flashing and physical acceptance are separate)*
  - [x] Configure ESP32-S3 Arduino target in PlatformIO (`esp32coore` environment)
  - [x] Configure serial debug output (115200 baud)
  - [x] Provision Wi-Fi through the branded `WattWise-Setup` WiFiManager portal with stored credentials and a five-second BOOT reset

- [ ] **PZEM-004T Sensor Integration**
  - [x] Implement UART setup and pin probing for the PZEM-004T V3.0 (default ESP32 RX/TX GPIO 4/5, Modbus address `0x01`)
  - [x] Read voltage, current, power, and cumulative energy every 2 seconds; skip failed voltage reads and NaN power/energy samples
  - [ ] Record physical wiring and sensor acceptance checks; frequency/power factor telemetry and comprehensive range validation are not implemented

- [x] **Telemetry Aggregation**
  - [x] Accumulate valid 2-second power samples in RAM and upload their average on the 5-second cloud schedule
  - [x] Send `{ device_id, energy_kwh, average_watts, voltage_v, current_a }`; the database assigns `recorded_at`
  - [x] Clear the average only after a successful 2xx POST; preserve the cumulative meter counter and pending average across transient upload failures

- [x] **Supabase REST Ingestion** *(source implemented; physical acceptance remains pending)*
  - [x] POST aggregated payload to Supabase REST API (`/rest/v1/energy_logs`) using `HTTPClient`, with the default minimal response
  - [x] Include `apikey` and `Authorization: Bearer <anon_key>` headers
  - [x] Back off failed uploads from 10 seconds up to 120 seconds while retaining the pending average; registered units continue scheduled 5-second relay polls independently of upload backoff
  - [x] RLS policies allow anon INSERT to `energy_logs` (MAC-address gated) and anon SELECT on `devices` (relay polling) *(migration 011)*

### Integration Points

| Channel | Direction | Payload | Purpose |
|---|---|---|---|
| Supabase REST API | ESP32-S3 → Supabase | Averaged watts and cumulative kWh on a 5-second schedule | Telemetry ingestion |
| Supabase Realtime | Supabase → Next.js | `energy_logs` stream | Live dashboard updates and direct W/V/A state |
| Supabase Auth | Next.js ↔ Supabase | JWT tokens | User authentication |

---

## Phase 2: Billing Engine & Control Logic

**Objective:** Transform raw kWh into Philippine Pesos using the unbundled Meralco formula and deliver weekly trend analytics with projected monthly costs.

### Platform Tasks (Web)

- [ ] **Unbundled Meralco Billing Module**
  - [x] Define the rate row mapping and selectors in `lib/meralco-rates.ts`; runtime rates come from the database, not historical seed constants
  - [x] Implement `computeMeralcoBill` in `lib/meralco-bill.ts` — unbundled charges, household tiers, adjustments, and per-component VAT
  - [x] Add FIT-All as a first-class per-kWh component (`fit_all`) in schema and runtime billing mapper *(migration at `supabase/migrations/008_add_fit_all_to_meralco_rates.sql` + helper update in `lib/meralco-rates.ts`)*
  - [x] Seed the `meralco_rates` table with the March 2026 row (`effective_month: '2026-03-01'`) *(dedicated migration at `supabase/migrations/004_seed_march_2026_meralco_rates.sql`)*
  - [x] Fetch active rates from Supabase (`WHERE effective_month <= CURRENT_DATE ORDER BY effective_month DESC LIMIT 1`) and use them in the billing function *(shared helper in `lib/meralco-rates.ts` — DB-only source)*
  - [x] Display **Total Daily Cost (₱)** on the Home Dashboard derived from this calculation — never hardcoded *(now driven by `devices` + `energy_logs` data and active `meralco_rates` row, with day-over-day increase/decrease trend computed from yesterday usage)*
  - [x] Add Supabase Edge Function automation scaffold to fetch latest `Summary Schedule of Rates` PDF from Meralco Rates Archives, extract base non-lifeline components, validate anomaly thresholds, and auto-upsert `meralco_rates` *(implementation at `supabase/functions/sync-meralco-rates/index.ts` + migration `supabase/migrations/009_add_meralco_rate_sync_automation.sql`; Deno-safe extraction path repaired August 2026)*
  - [x] Align the August 2026 parser and billing model with Meralco's current column order: Ancillary Service, System Loss, Distribution, variable Supply/Metering, fixed customer charges, Universal Charge, and FIT-All *(migration `031` plus parser regression coverage for summary-schedule and residential-bills layouts)*
  - [x] Add scheduler workflow to trigger automatic rate sync without manual approval *(workflow at `.github/workflows/sync-meralco-rates.yml`; daily ~11:00 AM PH with current-month no-op guard)*
  - [x] Bill like Meralco's Summary Schedule of Rates: per-component VAT (Generation/Transmission/Ancillary monthly rates, "Other Charges" on the rest) and the per-kWh adjustments (AWAT refunds, regulatory reset, lifeline rate, senior citizen, RPT, GEA-All, lifeline subsidy) *(migration `037`, `lib/meralco-bill.ts`; within PHP 0.02 of Meralco's October 2026 typical 200 kWh bill)*
  - [x] Distribution tiers and energy tax for homes above 200 kWh, priced from the homeowner's Meralco bill kWh (Settings) or monitored usage projected over the cycle *(migration `038`; within PHP 0.05 of Meralco's October 2026 typical bills at 300, 500, and 1,000 kWh)*
  - [ ] Lifeline discounts (100 kWh and below) and the local franchise tax are not modelled
  - [x] Follow Meralco's site move (November 2026): the sync reads the new rates archive cards *(`parseArchiveEntries` with a fixture test)*
  - [x] Keep budget spend at full precision instead of rounding each 5-second reading to centavos, and ignore physically impossible kWh jumps *(migration `039`)*

- [x] **Device Detail Screen** *(UI + core Supabase wiring complete; voltage/current now read from `energy_logs` telemetry when available, with compatibility fallback for legacy rows; no hardware diagnostics yet)*
  - [x] Build Device Detail page (`app/dashboard/[deviceId]/page.tsx`) — no bottom nav on phones (focus mode); on desktop it keeps the sidebar and shows a breadcrumb back to Home
  - [x] Implement three "Liquid Glass" gauge rings: Power (W), Voltage (V), Current (A)
  - [x] Build **Appliance Budget/Burn** section *(view-only budget on Device Detail; editing moved to Home Wallet to keep a single budget control point)*:
    - [x] Home budget editor (PHP) is available on Home Dashboard via icon-triggered card and updates `profiles.monthly_budget_php`
    - [x] Burn Rate progress bar — current spend vs. budget, color-coded (Bida/Naku!/Danger)
  - [x] Add **Home Wallet** card under Daily Cost on Home Dashboard (profile budget + burn rate from bounded monthly `energy_logs`)
  - [x] Add inline loading + error toast feedback for relay and home budget actions *(implemented in `RelayToggle` and `HomeBudgetEditor`)*
  - [x] Add Smart Control per-device budget automation *(migration `012_smart_budget_controls.sql`: `device_month_usage`, `device_budget_events`, approved limits, approval override, and `energy_logs` INSERT trigger that can set `relay_state = false`)*
  - [x] Refactor billing-sensitive logic to a custom Meralco billing cycle *(migration `013_custom_billing_cycles.sql`: `profiles.billing_cycle_start_day`, custom-cycle Smart Control accumulation/backfill, cycle-aware Home/Burn/Device Detail math, and Settings UI save path)*
  - [x] Add staged multi-tenant owner/tenant model *(migration `014_multi_tenant_manager_tenant.sql`: `profiles.manager_id`, `profiles.must_update_password`, `devices.owner_id`, `devices.tenant_id`, manager/tenant RLS, role-aware usage RPCs, and owner-based Smart Control trigger)*
  - [x] Split manager command center into dedicated portal routes for fleet dashboard, rooms, tenants, calendar, AI assistant, and settings
  - [x] Add manager AI assistant and cached manager insight cards scoped to manager-owned rooms
  - [x] Add frontend instant-load pass: verified internal navigation uses `next/link`, added manager route skeleton, and moved manager AI insight-card GET reads to SWR with shared JSON fetcher
  - [ ] Display diagnostics footer: Wi-Fi RSSI and Board Temperature *(not in the page or the schema; blocked on Phase 3 telemetry enrichment)*

- [ ] **Weekly Trend Charts**
  - [x] Create Supabase RPC aggregation functions for accurate weekly/device usage *(implemented as `get_usage_kwh_by_device` and `get_usage_kwh_by_device_day` in `supabase/migrations/006_accuracy_usage_rpcs.sql`)*
  - [ ] Build "This Week vs. Last Week" comparison bar chart using Recharts
  - [x] Display projected monthly bill based on current daily average *(Burn Analytics projects the billing-cycle bill from the cycle's average daily variable cost, up to 7 days, plus fixed charges with VAT)*

### Hardware Tasks (Firmware)

- [ ] **Device Heartbeat and Recovery**
  - [x] Update `devices.last_seen_at` and `is_online` server-side on each accepted telemetry insert (`update_device_last_seen`, migrations `035`/`036`); hardware does not issue a separate heartbeat UPDATE
  - [x] Derive online state from the shared 20-second freshness window, not the sticky `is_online` column
  - [ ] Record Wi-Fi outage/recovery and relay acceptance tests on flashed units. Upload backoff is implemented; the firmware does not implement a separate exponential Wi-Fi reconnection loop.

Relay timing is a schedule, not a strict five-second response guarantee: synchronous HTTP requests use an eight-second timeout. Boot starts OFF; after a valid command, network failures preserve the last applied relay state.

---

## Phase 3: AI Advisor & PWA Experience

**Objective:** Deploy the Taglish OpenAI-powered "Tipid Advisor" with the Trigger & Cache pattern, and finalize the Serwist PWA so the app can be installed to a user's home screen. By the end of this phase, users receive personalized Taglish energy advice and can use WattWise offline-first.

### Platform Tasks (Web)

- [x] **OpenAI Integration — Server-Side Only**
  - [ ] Verify server-only `OPENAI_API_KEY` configuration in the target environment; never use a `NEXT_PUBLIC_` prefix
  - [x] Install `openai` npm package
  - [x] Create `app/api/insights/route.ts` — the single entry point for all AI insight requests
  - [x] Create `app/api/devices/[deviceId]/ai-profile/route.ts` for fresh-telemetry appliance budget profiling with strict JSON output (`estimated_monthly_kwh`, `suggested_monthly_limit_php`, `taglish_advice`)

- [x] **Trigger & Cache Flow Implementation**
  - [x] On insight request, query `ai_insights` table: `WHERE user_id = ? AND insight_type = ? AND created_at >= now() - cache window` with `LIMIT 1` *(window per type in `app/api/insights/route.ts`: 1 day for `budget_alert`/`anomaly_alert`, 7 days for `weekly_recap`/`cost_optimizer`; a hit must also match the current billing cycle)*
  - [x] If cache hit → return cached `message` immediately (no OpenAI call)
  - [x] If cache miss:
    1. [x] Aggregate user data from `energy_logs` (with `.limit()` guard and date filter)
    2. [x] Build system prompt defining the **Friendly Filipino Financial Advisor** persona (casual Taglish, encouraging, hyper-specific to user data)
    3. [x] Call `openai.chat.completions.create()` — server-side only
    4. [x] INSERT result into `ai_insights`: `{ user_id, insight_type, message, prompt_tokens, completion_tokens }`
    5. [x] Return the new message to the client

- [x] **Budget "Naku!" Alert (`budget_alert`)**
  - [x] Calculate inputs: `currentSpend` (sum of this billing cycle's kWh priced against the correct Meralco rate rows), `monthlyBudget` (from `profiles.monthly_budget_php`), `daysElapsed`
  - [x] System prompt must reference exact ₱ amounts, appliance names, and timeframes
  - [x] Example output tone: *"Naku boss, Day 15 pa lang pero nasa ₱1,500 na tayo sa ₱2,000 budget mo..."*
  - [x] Display as a dismissible contextual card on the Home Dashboard when the payload is actionable or urgent

- [x] **Weekly "Bida" Recap (`weekly_recap`)**
  - [x] Calculate inputs: `thisWeekKWh`, `lastWeekKWh`, `thisWeekPHP`, `lastWeekPHP`
  - [x] System prompt must compare week-over-week and provide positive reinforcement
  - [x] Keep available through `app/api/insights/route.ts`, but do not force-render it when the UX would become noisy

- [x] **Event-Driven Contextual Insight UX**
  - [x] Deprecate the dedicated `/insights` route and remove it from the bottom navigation
  - [x] Break AI insights into dismissible contextual cards: `BudgetAlertCard`, `AnomalyAlertCard`, and `TipidTipCard`
  - [x] Inject cards into existing workflows: Home budget summary, Burn analytics, and Device Detail
  - [x] Hide cards when the AI payload is empty, generic, or not actionable

- [x] **Predictive Burn-Rate Analytics (`app/analytics/page.tsx`)**
  - [x] Use bounded usage RPCs for the past 7 days and month-to-date usage
  - [x] Use active unbundled Meralco rates for projected PHP cost
  - [x] Render 7-day financial velocity and projected billing-cycle bill
  - [x] Render anomaly AI context above the burn-rate chart only when actionable

- [x] **Calendar Analytics (`app/dashboard/calendar/page.tsx`)**
  - [x] Add a compact 7-day summary widget on the Home Dashboard with an expand affordance
  - [x] Build a current-month calendar grid that displays per-day kWh and variable cost
  - [x] Color-code day cells subtly by consumption intensity
  - [x] Add `POST /api/insights/calendar` for Taglish calendar habit analysis
  - [x] Render the AI readout in a dismissible slide-up panel using `LoadingIndicator`

- [x] **Advanced Settings (`app/settings/page.tsx`)**
  - [x] Add global theme controls through `ThemeProvider`
  - [x] Add password reset email and self-service account deletion
  - [x] Add per-device `require_approval_on_expiry` safety override toggles
  - [x] Add budget notification preferences, explicit OneSignal push opt-in, iOS install guidance, critical Resend email opt-out, and rate-limited test controls

- [x] **Budget Notification Delivery Scaffold**
  - [x] Keep 50% in-app only, send push at 80%, and send push plus email for both 100% terminal events
  - [x] Resolve the owner/manager and assigned tenant without duplicates and honor per-recipient channel preferences
  - [x] Add private OneSignal external identities, RLS-protected delivery logs, provider idempotency, bounded retries, and graceful missing-key behavior
  - [x] Add production OneSignal/Resend credentials, verify the sending domain, deploy the Edge Function, and activate the Database Webhook *(verified with a real OneSignal provider message and Resend delivery on 2026-08-22)*

- [x] **Bottom Navigation Bar**
  - [x] Implement persistent navbar: **Home**, **Burn**, **Reports**, and **Settings** (`APP_TABS` in `components/ui/app-nav.ts`); hidden at `lg`, where `AppSidebar` takes over
  - [x] Active tab highlighted *(accent colour plus a mint dot; the glow was removed)*
  - [x] Navigation bar hidden on Device Detail page (focus mode)
  - [x] Desktop sidebar: Overview (Home, Burn, Reports) and Billing (Calendar, Meralco Rates) groups, then Settings, light/dark toggle, log out, and an account card; one highlight glides to the clicked item *(2026-11-07)*

- [ ] **Serwist PWA Configuration**
  - [ ] Configure Serwist in `next.config.ts` for offline caching
  - [x] Add `public/site.webmanifest` with WattWise branding, icons, and standalone display, linked from root metadata
  - [ ] Implement service worker for static asset caching and API response caching
  - [ ] Add install prompt banner for iOS/Android home screen installation
  - [ ] Test offline behavior: cached dashboard loads, graceful fallback for live data

- [x] **Contextual Tipid Tips**
  - [x] Replace the old mascot banner with a dismissible `TipidTipCard` in the device-detail flow
  - [x] Keep the card hidden when the AI response is generic or non-actionable

### Hardware Tasks (Firmware)

- [ ] **Telemetry Enrichment**
  - [ ] Add Wi-Fi RSSI (signal strength in dBm) to the telemetry payload
  - [ ] Add ESP32-S3 internal temperature reading to the payload
  - [ ] Transmit enriched payload with RSSI and board temperature alongside the existing fields; continue assigning `recorded_at` in the database

- [ ] **OTA (Over-The-Air) Update Preparation**
  - [ ] Implement OTA update listener for future firmware pushes
  - [ ] Report current firmware version in heartbeat payload

### Integration Points

| Channel | Direction | Payload | Purpose |
|---|---|---|---|
| Next.js API Route | Client → Server → OpenAI | Aggregated energy data | AI insight generation |
| `ai_insights` table | Server → Client | Cached Taglish message | Insight delivery (cache-first) |
| Service Worker (planned) | Browser cache | Static assets + API responses | Offline PWA support; the existing OneSignal worker handles push only |
| OneSignal + Resend | Budget event → user channels | 80% push; 100% push + email | External budget warnings |

---

## Phase 4: Super Admin & Global Analytics

**Objective:** Build the "Mission Control" Super Admin dashboard for platform health monitoring, Meralco rate management, OpenAI cost tracking, and system-wide energy impact analytics. By the end of this phase, the platform owner has full visibility into operational metrics and can manage the system globally.

### Platform Tasks (Web)

- [x] **Demo-unit restart recovery**: explicit Start clears `live_since` alongside `is_active = true`, so the next SQL tick begins a fresh four-hour run after either manual or automatic pause. Preserve the meter and previous timestamp for gap backfill; new units start without seeded history. No new migration is required beyond `039`; live acceptance remains on the `TESTING.md` checklist.

- [x] **Super Admin Route Guard**
  - [x] Create `app/admin/layout.tsx` with role-based access control *(async Server Component, fetches profile + verifies super_admin role, redirects non-admins)*
  - [x] Check `profiles.role === 'super_admin'` on every admin page load *(defense-in-depth: middleware + layout both verify role)*
  - [x] Redirect non-admin users to `/dashboard` with unauthorized toast *(middleware redirects to `/login?error=unauthorized`, layout redirects to `/dashboard`)*
  - [x] Create admin navigation sidebar (separate from the user nav) *(`components/admin/AdminSidebar.tsx` — client component with active nav state, sign-out, 11 nav links)*
  - [x] Update middleware to gate `/admin` routes by `super_admin` role *(queries `profiles` table for `/admin` paths only)*
  - [x] Update login page with role-based redirect *(super_admin → `/admin`, user → `/dashboard`)*
  - [x] Create super_admin RLS policies *(migration at `supabase/migrations/002_admin_rls_policies.sql` — SELECT on all tables + INSERT/UPDATE on meralco_rates)*

- [x] **Meralco Rate Editor (`app/admin/rates/page.tsx`)** *(2026-11-07; `components/admin/RateEditor.tsx` → `POST /api/admin/rates`)*
  - [x] Form for every rate column: per-kWh components, distribution tiers, signed adjustments, VAT (overall and per component), and fixed monthly charges, prefilled from the latest month or any history row
  - [x] Live preview of PHP/kWh incl. VAT and fixed charges, using the billing formula (`computeVariableRatePerKwh`)
  - [x] Save upserts the `effective_month` row as a manual entry (`auto_updated = false`), audits before/after with a required reason, and expires the rate cache; the monthly sync replaces it if Meralco later publishes that month
  - [x] Display history of past rate entries in a table, with a Synced/Manual source chip and an Edit action
  - [x] Server-side validation of every value and its bounds (`lib/meralco-rate-input.ts`, `tests/meralco-rate-input.test.ts`)

- [x] **Revenue & Growth Dashboard (`app/admin/growth/page.tsx`)** *(2026-11-07)*
  - [x] Total users and units, new in 7/30/90 days, and accounts by role
  - [x] Query `devices` table: total paired devices, online vs. offline count *(on the `/admin` overview; online means a reading inside the 20 s freshness window)*
  - [x] 30-day chart of daily sign-ups and new units
  - [ ] Calculate hypothetical MRR (Monthly Recurring Revenue) based on user count *(not built: there is no pricing yet)*

- [x] **OpenAI Usage & Cost Tracker (`app/admin/ai-costs/page.tsx`)** *(2026-11-07)*
  - [x] Aggregate `ai_insights` tokens by Manila day
  - [x] Estimated USD cost from `OPENAI_PRICE_PER_MILLION_TOKENS` in `lib/openai.ts`
  - [x] 30-day daily token bar chart
  - [x] Totals: insights, tokens (in/out), estimated cost all time and last 30 days
  - [x] Breakdown by `insight_type`
  - [ ] Record tokens for assistant and chatbot replies *(only insights store usage today)*

- [x] **Database & System Health (`app/admin/health/page.tsx`)** *(2026-11-07)*
  - [x] Actual database size and `energy_logs` size from `admin_storage_stats()` (migration `043`), with an exact reading count
  - [x] Storage progress bar against the 500 MB free tier, amber at 80% and red at 90%
  - [x] Fleet status: online, idle, stale, and never-reported counts, plus a unit table with last-seen times and demo tags
  - [x] Latest rate-sync run (status, message, month, time); the old query sorted by a missing `started_at` column and always showed "No runs"
  - [x] Build device health table: MAC address, name, live/last-seen state, owner *(`/admin/devices`, `components/admin/AdminDevicesTable.tsx`)*

- [x] **Global Energy Analytics (`app/admin/analytics/page.tsx`)** *(2026-11-07)*
  - [x] Total platform kWh monitored (all time, from `device_month_usage`) and total variable spend tracked
  - [x] Week-over-week kWh change for the last 7 full days
  - [x] Platform-wide daily kWh area chart for 30 days from `admin_platform_daily_kwh()` (migration `043`, meter deltas, capped at 92 days)
  - [x] Units and current-cycle kWh by appliance type
  - [ ] Estimated Total Savings (₱) *(not built: needs a baseline to compare against; week-over-week kWh change is shown instead)*

- [x] **Admin Audit Log**
  - [x] Log admin actions (timestamp, admin user, action type, target, reason) *(`writeAdminAudit` in the users, devices, relay, demo-unit, Test Lab, and rates admin routes; `admin_audit_logs`)*
  - [x] Log rate changes *(`meralco_rates_create` / `meralco_rates_update` with before/after rows)*
  - [x] Display recent admin actions in a feed on the admin home page *(latest 8 on `/admin`, latest 100 on `/admin/audit`, with actor emails)*

### Hardware Tasks (Firmware)

- [ ] **Fleet Diagnostics Reporting**
  - [ ] Include uptime counter (seconds since last boot) in heartbeat payload
  - [ ] Include free heap memory in heartbeat payload
  - [ ] Include Wi-Fi reconnection count since boot

- [ ] **Graceful Degradation**
  - [ ] If Supabase REST is unreachable for > 5 minutes, store telemetry locally in SPIFFS/LittleFS
  - [ ] On reconnection, flush buffered data to Supabase in batches (max 50 rows per request)

- [ ] **Production Hardening**
  - [ ] Implement watchdog timer to auto-reset ESP32-S3 on firmware hang
  - [ ] Disable serial debug output in production builds (compile flag)

### Integration Points

| Channel | Direction | Payload | Purpose |
|---|---|---|---|
| Supabase RPC | Admin UI → Supabase | Aggregation queries | Global analytics |
| `meralco_rates` table | Admin → All Users | Updated rate row | System-wide billing update |
| `ai_insights` aggregation | Admin query | Token counts by date | OpenAI cost tracking |
| ESP32-S3 heartbeat | ESP32-S3 → Supabase | `{ uptime, heap, rssi, reconnects }` | Fleet health monitoring |

---

## Phase Dependency Map

```
Phase 1 (Foundation)
  ├── Supabase schema + Auth ─────────────────────────┐
  ├── ESP32-S3 sensor reading + REST ingestion ────────┤
  └── Live dashboard + Realtime subscription ──────────┤
                                                       ▼
Phase 2 (Billing & Control) ◄──── Requires Phase 1 tables + auth
  ├── Meralco billing module (uses meralco_rates table)
                                                       ▼
Phase 3 (AI & PWA) ◄──── Requires Phase 2 billing data + energy_logs history
  ├── OpenAI integration (uses energy_logs + profiles + meralco_rates)
  ├── Trigger & Cache (uses ai_insights table)
  └── Serwist PWA offline support
                                                       ▼
Phase 4 (Super Admin) ◄──── Requires all Phase 1–3 tables populated
  ├── Admin role guard (uses profiles.role)
  ├── Rate editor (writes to meralco_rates)
  ├── Cost tracker (reads ai_insights tokens)
  └── Global analytics (reads all tables)
```

---

## Quick Reference — Key Files by Phase

| Phase | Key Platform Files | Key Firmware Files |
|---|---|---|
| 1 | `app/layout.tsx`, `app/globals.css`, `components/ui/AppFrame.tsx`, `components/ui/app-nav.ts`, `app/login/page.tsx`, `app/register/page.tsx`, `app/dashboard/page.tsx` | `wattwise_hardware/src/main.cpp` (all current firmware) |
| 2 | `lib/meralco-bill.ts`, `lib/meralco-rates.ts`, `lib/meralco-rates-server.ts`, `app/dashboard/[deviceId]/page.tsx` | None |
| 3 | `app/api/insights/route.ts`, `app/api/insights/calendar/route.ts`, `components/insights/ContextualInsightCard.tsx`, `app/dashboard/page.tsx`, `app/dashboard/calendar/page.tsx`, `app/analytics/page.tsx`, `app/dashboard/[deviceId]/page.tsx`, `public/site.webmanifest`, `sw.ts` (planned) | `config_handler.cpp`, `ota_updater.cpp` (planned) |
| 4 | `app/admin/layout.tsx`, `app/admin/rates/page.tsx`, `app/admin/ai-costs/page.tsx`, `app/admin/health/page.tsx`, `app/admin/analytics/page.tsx` | `diagnostics.cpp`, `offline_buffer.cpp` (planned) |

### Completion note: Admin Test Lab

- [x] Added `/admin/test-lab` for super-admin presentation verification across selected user, virtual/physical devices, real telemetry injection, budget thresholds, cutoff recovery, notification evidence, and audited changes.
- [x] Test Lab retains production event deduplication and requires exact-name confirmation plus a reason before any physical-device mutation.
- [x] Hardened production notification diagnostics and navigation: invalid OneSignal App ID configuration falls back to the verified public app identifier, structured provider errors remain actionable, core mobile tabs are prefetched, Reports has a route skeleton, and dashboard/Burn data dependencies avoid unnecessary sequential requests.
- [x] Added authenticated, ready-to-share PDF exports for daily, weekly, and monthly energy reports, generated from the same bounded usage and Meralco cost rows as JSON/CSV.
- [x] Added customer-facing Meralco rate transparency: effective month, recorded sync timestamp/source, detailed component view, and bounded historical monthly rows.
- [x] Added the customer AI assistant FAB and bottom sheet for homeowner/tenant routes, with latest-10 history, scoped usage context, contextual fallback replies, rate limiting, and expiring review-before-confirm settings proposals.
- [x] Grounded bill-driver/device-list questions in exact cycle data and added persistent, tappable device cards with spend, limit progress, live watts, and telemetry freshness.

- 2026-09-27: Added an editable Remotion end-user survey orientation in `wattwise-survey-video/`, with narrated household workflows, clearly labeled illustrative interfaces/sample data, and a conceptual hardware unit. This research asset does not change implementation status or replace hands-on usability testing.

- 2026-09-27: Tightened the survey orientation video to ~84 seconds with shorter narration, staggered screen reveals, animated budget bars, alternating layouts, and a low-volume original instrumental pulse. The original ~144-second MP4 remains available for comparison.

- 2026-09-27: Integrated the supplied ElevenLabs recording into the survey walkthrough (~156 seconds), with local word-aligned captions, per-scene narration splits, and a quiet instrumental bed that ducks beneath speech and fades at the ends. Earlier MP4 cuts are retained.

- 2026-09-27: Added a separate 1080p Remotion motion graphics edition of the survey video (`WattwiseMotionFilm`): 33 narration-aligned shots, conceptual hardware reveal, kinetic type, live metrics, animated budget dial, usage charts, and reports. The finished ElevenLabs narration/music master and earlier walkthrough composition are preserved; this research asset does not alter feature implementation status.

- 2026-11-07: UI-only week (no migrations; the schema still ends at `039`):
  - Desktop layout at `lg` (1024px+): `AppFrame` in the root layout picks the frame by path. App routes get `AppSidebar` (`APP_DESKTOP_SECTIONS`: Overview = Home/Burn/Reports, Billing = Calendar/Meralco Rates; Settings, theme toggle, log out, and an account card at the bottom) and sit on `DESKTOP_PANEL`. `PageHeader` is an in-page title block on desktop (`description`, `desktopTitle`, no back button); loading screens use `PageTitleSkeleton`; cards use `CARD`/`CardHeader`/`CardPill`; Device Detail shows a breadcrumb. The manager portal uses the same sidebar (`MANAGER_DESKTOP_SECTIONS`) and panel.
  - Auth pages: desktop split layout with `AuthBrandPanel`; shared `SubmitButton` and `FormAlert` in login, register, forgot-password, and `UpdatePasswordForm`.
  - `/onboarding` is a full-width landing page with the 3D WattWise unit (three 0.186.1 + @react-three/fiber 9.8.1 in `components/landing/device/`, ported from the owner's gsap-portfolio repo), scroll reveals, and Lenis smooth scrolling (landing only). The `/` splash plays CSS keyframes (`ww-splash-*`), prefetches, fades out, then redirects.
  - Light mode moved to theme tokens (about 980 class changes; the 46 per-class overrides are deleted), with a pre-paint theme script; the splash no longer forces dark. Still open: a "System" option and a light-mode QA pass of manager, admin, and signed-out pages.
  - Motion: easing tokens, `ww-enter`/`ww-stagger` entrances, budget bars that fill in on load, and a top progress bar for route loading (`RouteTransitionIndicator`).
  - `components/ui/BrandMark.tsx` (the owl as a CSS-mask mark) replaces the robot icon for the customer assistant and manager AI.
  - New dependencies: `three`, `@react-three/fiber`, `@types/three`, `lenis`. PWA/service-worker work is unchanged and still pending.

- 2026-11-07 (later): scheduled turn-offs and UI polish:
  - Scheduled turn-offs from the customer assistant: `device_automations` (migration `041`, applied), run by pg_cron every 15 seconds; only ever turns devices off; listed and cancellable on Device Detail (`DeviceAutomationsCard`).
  - Assistant: opens at the latest message, skeleton and typing states, a review card for proposals, and an off-topic guardrail (`offTopicReply`) plus a scope rule in the system prompt.
  - Pill-shaped buttons and fields everywhere; icons switched from Lucide to Solar (Iconify, `npm run icons`).
  - Responsive pass: tablet column `md:max-w-2xl`, sidebar `w-56`/`xl:w-64`, panel up to `2xl:max-w-7xl`; the sidebar highlight re-measures on resize.
  - Settings redesign: grouped rows (`SettingsGroup`/`SettingsRow`), shared `Switch`, Light/Dark segmented control, in-app billing day picker, Log out and Log out of all devices in Account; the header logout button is removed from every page.
  - Landing page chatbot (**Ask WattWise**): signed-out, WattWise-only answers via `POST /api/public-assistant`, with a same-origin check, input caps, an off-topic and prompt-injection pre-check, and per-visitor and global daily limits (`public_chat_hits` / `take_public_chat_slot()`, migration `042`, applied). The logo on the sign-in pages now links to the landing page.
  - Privacy Policy (`/privacy`) and Terms and Conditions (`/terms`), written for the Data Privacy Act (RA 10173), with contact Wattwise888@gmail.com. Registration requires accepting both; the accepted version and time are saved in the user metadata. The landing footer links to both.
  - Manager portal polish: the AI tab became a floating owl button (shared `FloatingChat`, also used by the landing chatbot) and its priority cards moved to Fleet; managers can reissue a tenant's temporary password until the tenant sets their own; restyled tenant cards, room picker, and forms.
  - Security: migration `040` (applied) stops the public anon key from reading `devices`; anon may read only `mac_address` and `relay_state` (the firmware's relay poll), and `can_access_device()` is false without a signed-in user. Still open: per-device secrets so a known MAC can't post fake readings (needs a firmware update).
  - Unit management (migration `044`, applied): owners and managers can rename a unit, change its type, or remove it together with its readings (`/api/devices/[deviceId]`). Picking "Other" asks what the appliance is (`devices.appliance_detail`), shown in reports and passed to AI profiling. The customer assistant can now turn a unit on or off right away, after the owner confirms.
  - Landing page speed (Lighthouse, production build): desktop without a GPU 65 → 100 (blocking 990 ms → 0), desktop with a GPU 71 → 94-100, mobile 73-90 → 86-95. The 3D unit starts only after load and idle and is skipped on software-only WebGL; the headline is visible from the first frame; the owl mask is 15 KB instead of 150 KB.
  - Speed: the middleware verifies tokens locally (`getClaims()`) and makes one database call (`middleware_session_profile()`, migration `045`, applied) instead of an Auth server call plus a profile read. Every page, API call, and prefetch is about 110-150 ms faster in local measurements; the middleware runs in Singapore on Vercel, so production saves one Singapore-Seoul round trip per request. Sign-outs and disabled accounts still take effect at once.
  - Admin console: Meralco rate editor with live preview and audit, Growth and AI Costs charts with estimated spend, Health with real database size and unit status, Global Analytics with platform daily kWh, and a recent-actions feed on Overview (migration `043`, applied). Shared `AdminUi` and `AdminChart` components.
