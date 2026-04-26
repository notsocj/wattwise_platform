---
description: WattWise 4-Phase Implementation Roadmap — Foundation, Billing & Control, AI & PWA, Super Admin. Load when planning sprint work, checking phase dependencies, or onboarding contributors.
applyTo: "**"
---

# WattWise Platform — 4-Phase Implementation Roadmap

> **Last Updated:** April 26, 2026
> **Architecture:** Next.js 16.1.7 (React 19) + Supabase + ESP32-S3 + OpenAI
> **Overall Meralco Rate (March 2026):** ₱13.8161/kWh (unbundled)

---

## Progress Summary
| Phase | Status | Completion | Notes |
|---|---|---|---|
| 1 — Foundation | In Progress | ~64% | Design system done, auth UI + Supabase auth wired, DB schema + RLS ready, middleware done, dashboard reads `devices` + bounded `energy_logs`; dashboard and device detail now auto-refresh from Supabase Realtime with live online/offline + W/V/A card telemetry, plus periodic refresh fallback for stale-to-offline transitions; reusable `LoadingIndicator` and global route-transition indicator now wired in root layout, shared loading states are applied to splash/auth/onboarding flows, and route-level loading skeletons now exist for app/dashboard/insights/device detail |
| 2 — Billing & Control | In Progress | ~67% | Device Detail UI + Home Wallet + Meralco billing implemented (DB-driven, includes FIT-All + fixed charges); usage now aggregated via RPC minute-delta logic; Meralco base-rate auto-sync scaffolded via Supabase Edge Function + scheduled workflow (non-lifeline summary PDF mapping, anomaly guards, auto-upsert); scheduler now runs daily around midday PH with current-month no-op guard; relay on/off toggle on dashboard cards + device detail (PATCH API + RelayToggle component); relay and budget mutations now include inline spinners, disabled pending controls, and error toasts; device metadata migration (appliance_type, daily_usage_hours, relay_state) |
| 3 — AI & PWA | In Progress | ~66% | Insights UI implemented with Appliances Overview + CoachingFeed client component; AI insights API route fully implemented with Trigger & Cache (4 types: budget_alert, weekly_recap, anomaly_alert, cost_optimizer); AI onboarding wizard in AddApplianceModal (4-step flow with setup-recommendation API) now includes inline loading states, disabled pending controls, and API error toast feedback; OpenAI package installed; PWA still pending |
| 4 — Super Admin | In Progress | ~20% | Admin layout & guards implemented; admin pages scaffolded |

---

## Phase 1: Foundation & "The Digital Twin"

**Objective:** Establish the complete data pipeline — from the physical PZEM-004T sensor on the ESP32-S3, through Supabase, to a live dashboard in the browser. By the end of this phase, a user can register, pair a device, and see real-time Watts on screen.

### Platform Tasks (Web)

- [x] **Supabase Project Bootstrap**
  - [ ] Create Supabase project and configure `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` *(env vars stubbed — fill in real values from Supabase dashboard)*
  - [x] Run SQL migrations to create all 5 tables: `profiles`, `meralco_rates`, `devices`, `energy_logs`, `ai_insights` *(migration at `supabase/migrations/001_initial_schema.sql`)*
  - [x] Create all required indexes (`idx_energy_logs_device_time`, `idx_ai_insights_user_type_date`)
  - [x] Enable Row Level Security (RLS) policies on all tables

- [x] **Authentication Flow**
  - [x] Implement Supabase Auth provider wrapper in `app/layout.tsx` *(`SupabaseProvider` in `components/providers/SupabaseProvider.tsx`, session fetched server-side)*
  - [x] Add global route-transition loading indicator in root layout using reusable `LoadingIndicator` *(implemented via `components/ui/RouteTransitionIndicator.tsx` + `app/layout.tsx` wiring)*
  - [x] Build Registration page (`app/register/page.tsx`) — fields: Home Name, Email, Password *(UI complete + Supabase `signUp` wired)*
  - [x] Build Login page (`app/login/page.tsx`) — fields: Email, Password + "Forgot Password" link *(UI complete + Supabase `signInWithPassword` wired)*
  - [x] Build Onboarding/Splash page (`app/onboarding/page.tsx`) with WattWise branding and glow logo
  - [x] Implement auth middleware to protect `/dashboard` and other authenticated routes *(`proxy.ts` — uses Next.js 16 `proxy` convention)*
  - [x] Auto-create `profiles` row on sign-up via Supabase trigger or client-side insert *(PostgreSQL trigger `handle_new_user` in migration)*
  - [x] **Password Reset Flow** *(fully functional with Supabase email integration)*
    - [x] Build Forgot Password page (`app/forgot-password/page.tsx`) — prompts for email, sends reset link
    - [x] Build Reset Password page (`app/reset-password/page.tsx`) — validates token, sets new password
    - [x] Implement `supabase.auth.resetPasswordForEmail()` for sending recovery emails
    - [x] Implement `supabase.auth.updateUser()` for password update with token validation
    - [x] Add error handling for expired/invalid tokens and password validation
    - [x] Create setup guide at `FORGOT_PASSWORD_SETUP.md` with Supabase configuration instructions

- [x] **Design System Setup** *(95% complete)*
  - [x] Load **Space Grotesk** from local TTF files in `public/fonts` via `@font-face` in `app/globals.css`
  - [x] Configure Tailwind 4 custom tokens: `bg-base (#121212)`, `bg-surface (#1E1E1E)`, `text-mint (#00E66F)`, `text-bida (#10B981)`, `text-naku (#F59E0B)`, `text-danger (#EF4444)`
  - [x] Define `mint-glow` box-shadow utility (20–40px blur, `#00E66F` at 40–60% opacity)
  - [ ] Set global `border-radius: 8px` (Round Eight) default for cards and buttons

- [ ] **Device Pairing & Registration**
  - [ ] Build "Add Appliance" UI flow — user enters device name + MAC address
  - [ ] Insert new row into `devices` table with `user_id`, `device_name`, `mac_address`
  - [x] Display paired devices in a grid on the Home Dashboard (`app/dashboard/page.tsx`) *(data now loaded from `devices` table)*

- [ ] **Live Dashboard — Real-time Telemetry**
  - [x] Subscribe to Supabase Realtime on the `energy_logs` table filtered by `device_id` *(implemented with a client-side realtime bridge that triggers throttled `router.refresh()` for server-rendered dashboard/device-detail data on telemetry INSERT/UPDATE events)*
  - [x] Display live **Power (W)** gauge on each device card *(cards now show live online/offline state plus W/V/A telemetry with freshness gating)*
  - [x] Display **Total Live Wattage** aggregate across all user devices at the top of the dashboard
  - [x] Implement time-range filter on all `energy_logs` queries (`.gte('recorded_at', startOfDay)`) with `.limit(100)` guard *(implemented for dashboard + device detail energy queries)*

- [ ] **Historical Charts (Daily View)**
  - [ ] Create Supabase RPC function `get_hourly_averages(p_user_id, p_date)` for server-side aggregation
  - [ ] Build daily bar chart using **Recharts** `BarChart` with responsive container
  - [ ] Cache chart data using SWR or TanStack Query to prevent re-fetches on re-render

### Hardware Tasks (Firmware)

- [ ] **ESP32-S3 PlatformIO Project Setup**
  - [ ] Initialize PlatformIO project with ESP32-S3 board definition
  - [ ] Configure serial debug output (115200 baud)
  - [ ] Set up Wi-Fi connection manager with credentials stored in `secrets.h`

- [ ] **PZEM-004T Sensor Integration**
  - [ ] Wire PZEM-004T V3.0 to ESP32-S3 via UART (TX/RX pins)
  - [ ] Read raw telemetry: Voltage (V), Current (A), Power (W), Energy (kWh), Frequency (Hz), Power Factor
  - [ ] Validate sensor readings (reject NaN / out-of-range values)

- [ ] **1-Minute Aggregation Engine**
  - [ ] Implement rolling average buffer (60 samples at 1/sec → 1-minute average)
  - [ ] On each 1-minute tick, prepare a JSON payload: `{ device_id, energy_kwh, average_watts, recorded_at }`
  - [ ] Ensure no raw per-second data is transmitted to the cloud (Free Tier guardrail)

- [ ] **Supabase REST Ingestion**
  - [ ] POST aggregated payload to Supabase REST API (`/rest/v1/energy_logs`) using `HTTPClient`
  - [ ] Include `apikey` and `Authorization: Bearer <anon_key>` headers
  - [ ] Handle HTTP errors gracefully (retry once, then skip and log locally)

### Integration Points

| Channel | Direction | Payload | Purpose |
|---|---|---|---|
| Supabase REST API | ESP32-S3 → Supabase | `energy_logs` INSERT (1-min avg) | Telemetry ingestion |
| Supabase Realtime | Supabase → Next.js | `energy_logs` stream | Live dashboard updates |
| Supabase Auth | Next.js ↔ Supabase | JWT tokens | User authentication |

---

## Phase 2: Billing Engine & Control Logic

**Objective:** Transform raw kWh into Philippine Pesos using the unbundled Meralco formula and deliver weekly trend analytics with projected monthly costs.

### Platform Tasks (Web)

- [ ] **Unbundled Meralco Billing Module**
  - [x] Create `lib/meralco-rates.ts` with the rate structure constants (March 2026 values):
    ```
    vatRate: 0.12, generation: 5.3727, transmission: 0.8468, systemLoss: 0.5012,
    distribution: 1.4798, universalCharges: 0.1754, fitAll: 0.0838
    ```
  - [x] Implement `computeMeralcoBill(kWh, rates, vatRate, fixedChargesPhp)` — unbundled subtotal + fixed monthly charges, then VAT
  - [x] Add FIT-All as a first-class per-kWh component (`fit_all`) in schema and runtime billing mapper *(migration at `supabase/migrations/008_add_fit_all_to_meralco_rates.sql` + helper update in `lib/meralco-rates.ts`)*
  - [x] Seed the `meralco_rates` table with the March 2026 row (`effective_month: '2026-03-01'`) *(dedicated migration at `supabase/migrations/004_seed_march_2026_meralco_rates.sql`)*
  - [x] Fetch active rates from Supabase (`WHERE effective_month <= CURRENT_DATE ORDER BY effective_month DESC LIMIT 1`) and use them in the billing function *(shared helper in `lib/meralco-rates.ts` — DB-only source)*
  - [x] Display **Total Daily Cost (₱)** on the Home Dashboard derived from this calculation — never hardcoded *(now driven by `devices` + `energy_logs` data and active `meralco_rates` row, with day-over-day increase/decrease trend computed from yesterday usage)*
  - [x] Add Supabase Edge Function automation scaffold to fetch latest `Summary Schedule of Rates` PDF from Meralco Rates Archives, extract base non-lifeline components, validate anomaly thresholds, and auto-upsert `meralco_rates` *(implementation at `supabase/functions/sync-meralco-rates/index.ts` + migration `supabase/migrations/009_add_meralco_rate_sync_automation.sql`)*
  - [x] Add scheduler workflow to trigger automatic rate sync without manual approval *(workflow at `.github/workflows/sync-meralco-rates.yml`; daily ~11:00 AM PH with current-month no-op guard)*

- [x] **Device Detail Screen** *(UI + core Supabase wiring complete; voltage/current now read from `energy_logs` telemetry when available, with compatibility fallback for legacy rows; hardware diagnostics still placeholder-derived)*
  - [x] Build Device Detail page (`app/dashboard/[deviceId]/page.tsx`) — no bottom nav (focus mode)
  - [x] Implement three "Liquid Glass" gauge rings: Power (W), Voltage (V), Current (A)
  - [x] Build **Appliance Budget/Burn** section *(view-only budget on Device Detail; editing moved to Home Wallet to keep a single budget control point)*:
    - [x] Home budget editor (PHP) is available on Home Dashboard via icon-triggered card and updates `profiles.monthly_budget_php`
    - [x] Burn Rate progress bar — current spend vs. budget, color-coded (Bida/Naku!/Danger)
  - [x] Add **Home Wallet** card under Daily Cost on Home Dashboard (profile budget + burn rate from bounded monthly `energy_logs`)
  - [x] Add inline loading + error toast feedback for relay and home budget actions *(implemented in `RelayToggle` and `HomeBudgetEditor`)*
  - [x] Display diagnostics footer: Wi-Fi RSSI and Board Temperature

- [ ] **Weekly Trend Charts**
  - [x] Create Supabase RPC aggregation functions for accurate weekly/device usage *(implemented as `get_usage_kwh_by_device` and `get_usage_kwh_by_device_day` in `supabase/migrations/006_accuracy_usage_rpcs.sql`)*
  - [ ] Build "This Week vs. Last Week" comparison bar chart using Recharts
  - [ ] Display projected monthly bill based on current daily average

### Hardware Tasks (Firmware)

- [ ] **Device Heartbeat**
  - [ ] Every 30 seconds, update `devices.is_online = true` and `last_seen_at = NOW()` via Supabase REST
  - [ ] If Wi-Fi drops, attempt reconnection with exponential backoff

---

## Phase 3: AI Advisor & PWA Experience

**Objective:** Deploy the Taglish OpenAI-powered "Tipid Advisor" with the Trigger & Cache pattern, and finalize the Serwist PWA so the app can be installed to a user's home screen. By the end of this phase, users receive personalized Taglish energy advice and can use WattWise offline-first.

### Platform Tasks (Web)

- [x] **OpenAI Integration — Server-Side Only**
  - [ ] Add `OPENAI_API_KEY` to `.env.local` (no `NEXT_PUBLIC_` prefix — server-only) *(env var stubbed — fill in real key)*
  - [x] Install `openai` npm package
  - [x] Create `app/api/insights/route.ts` — the single entry point for all AI insight requests

- [x] **Trigger & Cache Flow Implementation**
  - [x] On insight request, query `ai_insights` table: `WHERE user_id = ? AND insight_type = ? AND created_at > (current_date - interval '7 days')` with `LIMIT 1`
  - [x] If cache hit → return cached `message` immediately (no OpenAI call)
  - [x] If cache miss:
    1. [x] Aggregate user data from `energy_logs` (with `.limit()` guard and date filter)
    2. [x] Build system prompt defining the **Friendly Filipino Financial Advisor** persona (casual Taglish, encouraging, hyper-specific to user data)
    3. [x] Call `openai.chat.completions.create()` — server-side only
    4. [x] INSERT result into `ai_insights`: `{ user_id, insight_type, message, prompt_tokens, completion_tokens }`
    5. [x] Return the new message to the client

- [x] **Budget "Naku!" Alert (`budget_alert`)**
  - [x] Calculate inputs: `currentSpend` (sum of this month's kWh × Meralco rate), `monthlyBudget` (from `profiles.monthly_budget_php`), `daysElapsed`
  - [x] System prompt must reference exact ₱ amounts, appliance names, and timeframes
  - [x] Example output tone: *"Naku boss, Day 15 pa lang pero nasa ₱1,500 na tayo sa ₱2,000 budget mo..."*
  - [x] Display as an **orange/red "Naku!" card** on the Insights Dashboard

- [x] **Weekly "Bida" Recap (`weekly_recap`)**
  - [x] Calculate inputs: `thisWeekKWh`, `lastWeekKWh`, `thisWeekPHP`, `lastWeekPHP`
  - [x] System prompt must compare week-over-week and provide positive reinforcement
  - [x] Display as a **green "Bida" card** on the Insights Dashboard

- [x] **Insights Dashboard (`app/insights/page.tsx`)** *(fully wired — Appliances Overview + CoachingFeed client component fetching real AI insights via Trigger & Cache)*
  - [x] Build **Device Performance Leaderboard** — ranked from most expensive to most efficient
  - [x] Build **Coaching Feed** (Bento layout):
    - [x] Naku! Alert card (amber/red styling)
    - [x] Bida Recap card (green styling)
    - [x] Strategy Tip card (actionable advice)
  - [x] Build **Trend Comparison** — "This Wk" vs. "Last Wk" interactive bar chart
  - [x] Build **Financial Forecast** — predicted monthly bill + projected savings %

- [x] **Bottom Navigation Bar**
  - [x] Implement persistent 2-tab navbar: **Home** (fleet view) and **Insights** (analytics)
  - [x] Active tab highlighted with green glow indicator
  - [x] Navigation bar hidden on Device Detail page (focus mode)

- [ ] **Serwist PWA Configuration**
  - [ ] Configure Serwist in `next.config.ts` for offline caching
  - [ ] Create `manifest.json` with WattWise branding (name, icons, theme color `#121212`, background `#121212`)
  - [ ] Implement service worker for static asset caching and API response caching
  - [ ] Add install prompt banner for iOS/Android home screen installation
  - [ ] Test offline behavior: cached dashboard loads, graceful fallback for live data

- [x] **Mascot/AI Tip Banner** *(UI complete — mock data; CoachingFeed now fetches real AI insights)*
  - [x] Build sticky AI tip banner on Home Dashboard showing latest insight snippet
  - [x] Tapping the banner navigates to the full Insights Dashboard

### Hardware Tasks (Firmware)

- [ ] **Telemetry Enrichment**
  - [ ] Add Wi-Fi RSSI (signal strength in dBm) to the 1-minute payload
  - [ ] Add ESP32-S3 internal temperature reading to the payload
  - [ ] Transmit enriched payload: `{ device_id, energy_kwh, average_watts, rssi, board_temp_c, recorded_at }`

- [ ] **OTA (Over-The-Air) Update Preparation**
  - [ ] Implement OTA update listener for future firmware pushes
  - [ ] Report current firmware version in heartbeat payload

### Integration Points

| Channel | Direction | Payload | Purpose |
|---|---|---|---|
| Next.js API Route | Client → Server → OpenAI | Aggregated energy data | AI insight generation |
| `ai_insights` table | Server → Client | Cached Taglish message | Insight delivery (cache-first) |
| Service Worker | Browser cache | Static assets + API responses | Offline PWA support |

---

## Phase 4: Super Admin & Global Analytics

**Objective:** Build the "Mission Control" Super Admin dashboard for platform health monitoring, Meralco rate management, OpenAI cost tracking, and system-wide energy impact analytics. By the end of this phase, the platform owner has full visibility into operational metrics and can manage the system globally.

### Platform Tasks (Web)

- [x] **Super Admin Route Guard**
  - [x] Create `app/admin/layout.tsx` with role-based access control *(async Server Component, fetches profile + verifies super_admin role, redirects non-admins)*
  - [x] Check `profiles.role === 'super_admin'` on every admin page load *(defense-in-depth: middleware + layout both verify role)*
  - [x] Redirect non-admin users to `/dashboard` with unauthorized toast *(middleware redirects to `/login?error=unauthorized`, layout redirects to `/dashboard`)*
  - [x] Create admin navigation sidebar (separate from user 2-tab nav) *(`components/admin/AdminSidebar.tsx` — client component with active nav state, sign-out, 6 nav links)*
  - [x] Update middleware to gate `/admin` routes by `super_admin` role *(queries `profiles` table for `/admin` paths only)*
  - [x] Update login page with role-based redirect *(super_admin → `/admin`, user → `/dashboard`)*
  - [x] Create super_admin RLS policies *(migration at `supabase/migrations/002_admin_rls_policies.sql` — SELECT on all tables + INSERT/UPDATE on meralco_rates)*

- [ ] **Meralco Rate Editor (`app/admin/rates/page.tsx`)**
  - [ ] Build form with base rate fields: Generation, Transmission, System Loss, Distribution, Universal Charges, FIT-All, VAT, optional Supply Charge, and Metering Charge
  - [ ] Show computed total rate and total with VAT as live preview
  - [ ] On save → INSERT new row into `meralco_rates` table with `effective_month`
  - [ ] Display history of past rate entries in a table below the form
  - [ ] Validate all rate values are numeric and within reasonable bounds

- [ ] **Revenue & Growth Dashboard (`app/admin/growth/page.tsx`)**
  - [ ] Query `profiles` table: total registered users, grouped by `created_at` date
  - [ ] Query `devices` table: total paired devices, online vs. offline count
  - [ ] Build 30-day user growth line chart (Recharts `LineChart`)
  - [ ] Calculate hypothetical MRR (Monthly Recurring Revenue) based on user count
  - [ ] Display key metrics: Total Users, Active Devices, New Users (7d), New Users (30d)

- [ ] **OpenAI Usage & Cost Tracker (`app/admin/ai-costs/page.tsx`)**
  - [ ] Aggregate `ai_insights` table: `SUM(prompt_tokens)`, `SUM(completion_tokens)` grouped by date
  - [ ] Calculate estimated USD cost using OpenAI pricing (prompt tokens × rate + completion tokens × rate)
  - [ ] Build daily token usage bar chart
  - [ ] Display totals: Total Insights Generated, Total Tokens Used, Estimated Cost (USD)
  - [ ] Show breakdown by `insight_type` (budget_alert vs. weekly_recap)

- [ ] **Database & System Health (`app/admin/health/page.tsx`)**
  - [ ] Query `energy_logs` total row count (monitor approach toward 500MB limit)
  - [ ] Calculate estimated storage usage (row count × avg row size)
  - [ ] Display storage usage progress bar with warning threshold at 80%
  - [ ] Show device fleet status: online count, offline count, last-seen timestamps
  - [ ] Build device health table: MAC address, name, is_online, last_seen_at, owner email

- [ ] **Global Energy Analytics (`app/admin/analytics/page.tsx`)**
  - [ ] Run aggregated `SUM(energy_kwh)` across all `energy_logs` — total platform kWh monitored
  - [ ] Calculate total estimated Pesos saved by all users (compare usage trends week-over-week)
  - [ ] Build "Big Picture" dashboard cards:
    - [ ] Total kWh Monitored (all-time)
    - [ ] Total Users
    - [ ] Total Devices
    - [ ] Estimated Total Savings (₱)
  - [ ] Build platform-wide daily energy consumption chart (Recharts `AreaChart`)

- [ ] **Admin Audit Log**
  - [ ] Log all rate changes, admin actions (timestamp, admin user, action type)
  - [ ] Display recent admin actions in a feed on the admin home page

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
| 1 | `app/layout.tsx`, `app/login/page.tsx`, `app/register/page.tsx`, `app/dashboard/page.tsx` | `main.cpp`, `wifi_manager.cpp`, `pzem_reader.cpp`, `supabase_client.cpp` |
| 2 | `lib/meralco-rates.ts`, `app/dashboard/[deviceId]/page.tsx` | None |
| 3 | `app/api/insights/route.ts`, `app/insights/page.tsx`, `manifest.json`, `sw.ts` | `config_handler.cpp`, `ota_updater.cpp` |
| 4 | `app/admin/layout.tsx`, `app/admin/rates/page.tsx`, `app/admin/ai-costs/page.tsx`, `app/admin/health/page.tsx`, `app/admin/analytics/page.tsx` | `diagnostics.cpp`, `offline_buffer.cpp` |