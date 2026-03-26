---
description: WattWise 4-Phase Implementation Roadmap — Foundation, Billing & Control, AI & PWA, Super Admin. Load when planning sprint work, checking phase dependencies, or onboarding contributors.
applyTo: "**"
---

# WattWise Platform — 4-Phase Implementation Roadmap

> **Last Updated:** March 26, 2026
> **Architecture:** Next.js 16.1.7 (React 19) + Supabase + ESP32-S3 + OpenAI
> **Overall Meralco Rate (March 2026):** ₱13.8161/kWh (unbundled)

---

## Progress Summary

| Phase | Status | Completion | Notes |
|---|---|---|---|
| 1 — Foundation | In Progress | ~45% | Design system done, auth UI + Supabase auth wired, DB schema + RLS ready, middleware done, all route placeholders scaffolded |
| 2 — Billing & Control | Scaffolded | ~5% | Route placeholders created (`/dashboard/[deviceId]`, `/api/relay`), blocked by Phase 1 completion |
| 3 — AI & PWA | Scaffolded | ~5% | Route placeholders created (`/insights`, `/api/insights`), blocked by Phase 2 |
| 4 — Super Admin | In Progress | ~20% | Route guard + role-based middleware + sidebar layout done, admin RLS policies created, page scaffolds updated for sidebar layout, functional page implementations pending |
| 1 — Foundation | In Progress | ~50% | Design system done, auth UI + Supabase auth wired, DB schema + RLS ready, middleware done, dashboard UI built with mock data |
| 2 — Billing & Control | In Progress | ~25% | Device Detail UI built (gauges, wallet, relay toggle, safety thresholds, diagnostics — mock data); `lib/meralco-rates.ts` added, `computeMeralcoBill` implemented, Dashboard Total Daily Cost now derived from unbundled formula (mock kWh source) |
| 3 — AI & PWA | In Progress | ~25% | Insights dashboard UI built (leaderboard, coaching feed, trend chart, forecast — mock data), bottom nav done, AI tip banner done |
| 4 — Super Admin | Scaffolded | ~5% | Route placeholders created (all 5 admin pages + layout), blocked by Phases 1–3 |

---

## Phase 1: Foundation & "The Digital Twin"

**Objective:** Establish the complete data pipeline — from the physical PZEM-004T sensor on the ESP32-S3, through Supabase, to a live dashboard in the browser. By the end of this phase, a user can register, pair a device, and see real-time Watts on screen.

### Platform Tasks (Web)

- [x] **Supabase Project Bootstrap**
  - [ ] Create Supabase project and configure `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` *(env vars stubbed — fill in real values from Supabase dashboard)*
  - [x] Run SQL migrations to create all 6 tables: `profiles`, `meralco_rates`, `devices`, `energy_logs`, `relay_commands`, `ai_insights` *(migration at `supabase/migrations/001_initial_schema.sql`)*
  - [x] Create all required indexes (`idx_energy_logs_device_time`, `idx_ai_insights_user_type_date`)
  - [x] Enable Row Level Security (RLS) policies on all tables

- [x] **Authentication Flow**
  - [x] Implement Supabase Auth provider wrapper in `app/layout.tsx` *(`SupabaseProvider` in `components/providers/SupabaseProvider.tsx`, session fetched server-side)*
  - [x] Build Registration page (`app/register/page.tsx`) — fields: Home Name, Email, Password *(UI complete + Supabase `signUp` wired)*
  - [x] Build Login page (`app/login/page.tsx`) — fields: Email, Password + "Forgot Password" link *(UI complete + Supabase `signInWithPassword` wired)*
  - [x] Build Onboarding/Splash page (`app/onboarding/page.tsx`) with WattWise branding and glow logo
  - [x] Implement auth middleware to protect `/dashboard` and other authenticated routes *(`proxy.ts` — uses Next.js 16 `proxy` convention)*
  - [x] Auto-create `profiles` row on sign-up via Supabase trigger or client-side insert *(PostgreSQL trigger `handle_new_user` in migration)*

- [x] **Design System Setup** *(95% complete)*
  - [x] Load **Space Grotesk** via `next/font/google` in `app/layout.tsx`
  - [x] Configure Tailwind 4 custom tokens: `bg-base (#121212)`, `bg-surface (#1E1E1E)`, `text-mint (#00E66F)`, `text-bida (#10B981)`, `text-naku (#F59E0B)`, `text-danger (#EF4444)`
  - [x] Define `mint-glow` box-shadow utility (20–40px blur, `#00E66F` at 40–60% opacity)
  - [ ] Set global `border-radius: 8px` (Round Eight) default for cards and buttons

- [ ] **Device Pairing & Registration**
  - [ ] Build "Add Appliance" UI flow — user enters device name + MAC address
  - [ ] Insert new row into `devices` table with `user_id`, `device_name`, `mac_address`
  - [ ] Display paired devices in a grid on the Home Dashboard (`app/dashboard/page.tsx`)

- [ ] **Live Dashboard — Real-time Telemetry**
  - [ ] Subscribe to Supabase Realtime on the `energy_logs` table filtered by `device_id`
  - [ ] Display live **Power (W)** gauge on each device card
  - [ ] Display **Total Live Wattage** aggregate across all user devices at the top of the dashboard
  - [ ] Implement time-range filter on all `energy_logs` queries (`.gte('recorded_at', startOfDay)`) with `.limit(100)` guard

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

**Objective:** Transform raw kWh into Philippine Pesos using the unbundled Meralco formula, and implement the remote 30A relay Kill Switch with the optimistic UI + MQTT safety handshake. By the end of this phase, a user can see their real-time cost and remotely control their appliance.

### Platform Tasks (Web)

- [ ] **Unbundled Meralco Billing Module**
  - [x] Create `lib/meralco-rates.ts` with the rate structure constants (March 2026 values):
    ```
    generation: 5.3727, transmission: 0.8468, systemLoss: 0.5012,
    distribution: 1.4798, subsidies: -0.0682, governmentTaxes: 0.2563,
    universalCharges: 0.1754, VAT: 12%
    ```
  - [x] Implement `computeMeralcoBill(kWh: number): number` — unbundled subtotal × (1 + 0.12)
  - [ ] Seed the `meralco_rates` table with the March 2026 row (`effective_month: '2026-03-01'`)
  - [ ] Fetch active rates from Supabase (`WHERE effective_month <= CURRENT_DATE ORDER BY effective_month DESC LIMIT 1`) and use them in the billing function
  - [x] Display **Total Daily Cost (₱)** on the Home Dashboard derived from this calculation — never hardcoded *(currently sourced from mock device `dailyKWh`; Supabase rates/data wiring pending)*

- [x] **Device Detail Screen** *(UI complete — mock data, no Supabase wiring yet)*
  - [x] Build Device Detail page (`app/dashboard/[deviceId]/page.tsx`) — no bottom nav (focus mode)
  - [x] Implement three "Liquid Glass" gauge rings: Power (W), Voltage (V), Current (A)
  - [x] Build **Device Wallet** section:
    - [x] Monthly Budget slider (PHP) — updates `profiles.monthly_budget_php`
    - [x] Burn Rate progress bar — current spend vs. budget, color-coded (Bida/Naku!/Danger)
  - [x] Display diagnostics footer: Wi-Fi RSSI and Board Temperature

- [ ] **Remote 30A Kill Switch (Optimistic UI)** *(UI toggle built — no MQTT/Supabase wiring yet)*
  - [x] Build large tactile relay toggle button on Device Detail page
  - [ ] Implement optimistic UI pattern:
    1. [ ] Immediately update local state to `off` on user tap
    2. [ ] INSERT into `relay_commands` table: `{ device_id, command: 'OFF', status: 'pending', origin: 'user' }`
    3. [ ] Publish MQTT command via Next.js API route (`app/api/relay/route.ts`)
    4. [ ] Listen for MQTT ACK via Supabase Realtime on `relay_commands` row
    5. [ ] On ACK (< 5s) → update status to `confirmed`
    6. [ ] On timeout (> 5s) → revert optimistic state, show warning toast
  - [ ] Build "Slide to Power Off All" emergency control on Home Dashboard

- [ ] **MQTT Broker Setup**
  - [ ] Configure MQTT broker (HiveMQ Cloud free tier or Mosquitto)
  - [ ] Create Next.js API route (`app/api/relay/route.ts`) as MQTT publisher (server-side only)
  - [ ] Define topic structure: `wattwise/{device_mac}/command` (publish) and `wattwise/{device_mac}/ack` (subscribe)

- [ ] **Weekly Trend Charts**
  - [ ] Create Supabase RPC `get_daily_totals(p_user_id, p_start_date, p_end_date)`
  - [ ] Build "This Week vs. Last Week" comparison bar chart using Recharts
  - [ ] Display projected monthly bill based on current daily average

### Hardware Tasks (Firmware)

- [ ] **30A Relay Driver**
  - [ ] Wire 30A relay module to designated ESP32-S3 GPIO pin
  - [ ] Implement `setRelay(bool state)` function with debounce protection
  - [ ] Default relay state on boot: **ON** (fail-safe — power stays on if firmware crashes)

- [ ] **MQTT Client Integration**
  - [ ] Connect to MQTT broker using `PubSubClient` library over TLS
  - [ ] Subscribe to `wattwise/{mac}/command` topic
  - [ ] On `OFF` message → call `setRelay(false)`, publish ACK to `wattwise/{mac}/ack`
  - [ ] On `ON` message → call `setRelay(true)`, publish ACK to `wattwise/{mac}/ack`

- [ ] **Autonomous Over-Current Safety Trip**
  - [ ] Implement current monitoring loop (sampled every 100ms)
  - [ ] If current exceeds configurable threshold (default: 30A) → immediately trip relay **in firmware** (no cloud dependency)
  - [ ] After trip: publish safety event to `wattwise/{mac}/safety` topic with `{ event: 'TRIP', amps: measured_value }`
  - [ ] POST `relay_commands` row to Supabase REST: `{ command: 'TRIP', origin: 'system', status: 'confirmed' }`
  - [ ] Require explicit user `ON` command to re-engage relay after safety trip (no auto-reset)

- [ ] **Device Heartbeat**
  - [ ] Every 30 seconds, update `devices.is_online = true` and `last_seen_at = NOW()` via Supabase REST
  - [ ] If Wi-Fi drops, attempt reconnection with exponential backoff

### Integration Points

| Channel | Direction | Payload | Purpose |
|---|---|---|---|
| MQTT `command` topic | Next.js API → ESP32-S3 | `ON` / `OFF` | Remote relay control |
| MQTT `ack` topic | ESP32-S3 → Next.js (via Supabase) | `{ status: 'confirmed' }` | Optimistic UI confirmation |
| MQTT `safety` topic | ESP32-S3 → Supabase | `{ event: 'TRIP', amps }` | Safety event reporting |
| Supabase REST | ESP32-S3 → Supabase | `relay_commands` INSERT | Audit trail for all relay events |
| Supabase Realtime | Supabase → Next.js | `relay_commands` updates | UI state sync |

---

## Phase 3: AI Advisor & PWA Experience

**Objective:** Deploy the Taglish OpenAI-powered "Tipid Advisor" with the Trigger & Cache pattern, and finalize the Serwist PWA so the app can be installed to a user's home screen. By the end of this phase, users receive personalized Taglish energy advice and can use WattWise offline-first.

### Platform Tasks (Web)

- [ ] **OpenAI Integration — Server-Side Only**
  - [ ] Add `OPENAI_API_KEY` to `.env.local` (no `NEXT_PUBLIC_` prefix — server-only)
  - [ ] Install `openai` npm package
  - [ ] Create `app/api/insights/route.ts` — the single entry point for all AI insight requests

- [ ] **Trigger & Cache Flow Implementation**
  - [ ] On insight request, query `ai_insights` table: `WHERE user_id = ? AND insight_type = ? AND created_at > (current_date - interval '7 days')` with `LIMIT 1`
  - [ ] If cache hit → return cached `message` immediately (no OpenAI call)
  - [ ] If cache miss:
    1. [ ] Aggregate user data from `energy_logs` (with `.limit()` guard and date filter)
    2. [ ] Build system prompt defining the **Friendly Filipino Financial Advisor** persona (casual Taglish, encouraging, hyper-specific to user data)
    3. [ ] Call `openai.chat.completions.create()` — server-side only
    4. [ ] INSERT result into `ai_insights`: `{ user_id, insight_type, message, prompt_tokens, completion_tokens }`
    5. [ ] Return the new message to the client

- [ ] **Budget "Naku!" Alert (`budget_alert`)**
  - [ ] Calculate inputs: `currentSpend` (sum of this month's kWh × Meralco rate), `monthlyBudget` (from `profiles.monthly_budget_php`), `daysElapsed`
  - [ ] System prompt must reference exact ₱ amounts, appliance names, and timeframes
  - [ ] Example output tone: *"Naku boss, Day 15 pa lang pero nasa ₱1,500 na tayo sa ₱2,000 budget mo..."*
  - [ ] Display as an **orange/red "Naku!" card** on the Insights Dashboard

- [ ] **Weekly "Bida" Recap (`weekly_recap`)**
  - [ ] Calculate inputs: `thisWeekKWh`, `lastWeekKWh`, `thisWeekPHP`, `lastWeekPHP`
  - [ ] System prompt must compare week-over-week and provide positive reinforcement
  - [ ] Display as a **green "Bida" card** on the Insights Dashboard

- [x] **Insights Dashboard (`app/insights/page.tsx`)** *(UI complete — mock data, no backend logic yet)*
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
  - [ ] Navigation bar hidden on Device Detail page (focus mode)

- [ ] **Serwist PWA Configuration**
  - [ ] Configure Serwist in `next.config.ts` for offline caching
  - [ ] Create `manifest.json` with WattWise branding (name, icons, theme color `#121212`, background `#121212`)
  - [ ] Implement service worker for static asset caching and API response caching
  - [ ] Add install prompt banner for iOS/Android home screen installation
  - [ ] Test offline behavior: cached dashboard loads, graceful fallback for live data

- [x] **Mascot/AI Tip Banner** *(UI complete — mock data, no backend logic yet)*
  - [x] Build sticky AI tip banner on Home Dashboard showing latest insight snippet
  - [x] Tapping the banner navigates to the full Insights Dashboard

### Hardware Tasks (Firmware)

- [ ] **Telemetry Enrichment**
  - [ ] Add Wi-Fi RSSI (signal strength in dBm) to the 1-minute payload
  - [ ] Add ESP32-S3 internal temperature reading to the payload
  - [ ] Transmit enriched payload: `{ device_id, energy_kwh, average_watts, rssi, board_temp_c, recorded_at }`

- [ ] **Auto-Trip Threshold Configuration**
  - [ ] Subscribe to MQTT topic `wattwise/{mac}/config` for runtime configuration
  - [ ] Accept `{ trip_threshold_amps: number }` to update the over-current trip point without reflashing
  - [ ] Store threshold in NVS (Non-Volatile Storage) so it persists across reboots

- [ ] **OTA (Over-The-Air) Update Preparation**
  - [ ] Implement OTA update listener for future firmware pushes
  - [ ] Report current firmware version in heartbeat payload

### Integration Points

| Channel | Direction | Payload | Purpose |
|---|---|---|---|
| Next.js API Route | Client → Server → OpenAI | Aggregated energy data | AI insight generation |
| `ai_insights` table | Server → Client | Cached Taglish message | Insight delivery (cache-first) |
| MQTT `config` topic | Next.js API → ESP32-S3 | `{ trip_threshold_amps }` | Remote threshold config |
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
  - [ ] Build form with 7 unbundled rate fields: Generation, Transmission, System Loss, Distribution, Subsidies, Government Taxes, Universal Charges
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
  - [ ] Ensure relay control via MQTT remains operational even during Supabase outages

- [ ] **Production Hardening**
  - [ ] Implement watchdog timer to auto-reset ESP32-S3 on firmware hang
  - [ ] Disable serial debug output in production builds (compile flag)
  - [ ] Validate all incoming MQTT messages (reject malformed payloads)

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
  ├── MQTT broker + relay control
  └── Optimistic UI + safety trip logging
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
| 2 | `lib/meralco-rates.ts`, `app/api/relay/route.ts`, `app/dashboard/[deviceId]/page.tsx` | `relay_driver.cpp`, `mqtt_client.cpp`, `safety_monitor.cpp` |
| 3 | `app/api/insights/route.ts`, `app/insights/page.tsx`, `manifest.json`, `sw.ts` | `config_handler.cpp`, `ota_updater.cpp` |
| 4 | `app/admin/layout.tsx`, `app/admin/rates/page.tsx`, `app/admin/ai-costs/page.tsx`, `app/admin/health/page.tsx`, `app/admin/analytics/page.tsx` | `diagnostics.cpp`, `offline_buffer.cpp` |