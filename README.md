# WattWise Platform

WattWise is a mobile-first energy monitoring app for Philippine households. It pairs with the [WattWise ESP32-S3 sub-meter](https://github.com/notsocj/wattwise_hardware) to show live per-appliance usage, compute Meralco-accurate costs, enforce per-device budgets through a smart relay, and explain usage in casual Taglish through AI insights.

Production: [wattwise-app.site](https://www.wattwise-app.site)

## Features

- **Live dashboard** with per-device watts, voltage, and current pushed through Supabase Realtime (no page reloads), plus freshness-aware LIVE/idle/offline states
- **Meralco billing** computed from the active unbundled rate row (generation, transmission, ancillary, system loss, distribution, supply, metering, universal charges, FIT-All, fixed charges, VAT last), with a public `/rates` transparency page
- **Smart Control**: per-device monthly budget limits that cut the relay when spend is exceeded, with optional approval-on-expiry
- **Budget alerts** at 50% (in-app), 80% (push), and 100% (push + email) via OneSignal and Resend
- **Analytics, calendar, and reports**: reports are built on the server from the same usage data as the dashboard, price each day at that day's Meralco rate, and export to CSV and PDF
- **AI insights and a customer assistant**, generated server-side with OpenAI and cached in `ai_insights`
- **Manager mode** for landlords: rooms, tenants, fleet dashboard, and manager AI
- **Admin console**: users, devices, rates, analytics, AI costs, audit log, health, demo units, and a hardware test lab

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | Next.js 16 (App Router, React Compiler), React 19, TypeScript, Tailwind CSS 4, Recharts, Lucide; Space Grotesk via `next/font` |
| Backend | Supabase (Postgres, Auth, Realtime, RLS, Edge Functions) |
| AI | OpenAI SDK (server-side only) |
| Notifications | OneSignal Web Push, Resend email |
| Hosting | Vercel, functions pinned to Seoul (`icn1`) next to the Supabase project in ap-northeast-2 (OpenNext Cloudflare scripts also available) |

## Getting started

Requirements: Node.js 22.6 or later (`npm test` runs TypeScript through `--experimental-strip-types`; the app alone needs 20.9+) and access to the WattWise Supabase project.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use port `3001` (`npm run dev -- -p 3001`) if another Wattwise project is already running.

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Supabase anon key (RLS enforced) |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | client | OneSignal web push app ID |
| `OPENAI_API_KEY` | server only | AI insights, profiling, assistant |
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` | server only | Admin client: tenant creation, account deletion, admin console, and the cross-request Meralco rate cache (without it, rates are read directly on every request) |
| `MERALCO_SYNC_SECRET`, `MERALCO_SYNC_FUNCTION_URL` | server / CI | Triggering the Meralco rate sync function |
| `MERALCO_MAX_RELATIVE_CHANGE` | Edge Function | Anomaly guardrail for rate sync (default `0.5`) |

Edge Function secrets (`ONESIGNAL_APP_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_BASE_URL`, `NOTIFICATION_WEBHOOK_SECRET`) are set with `supabase secrets set`. See [NOTIFICATION_SETUP.md](NOTIFICATION_SETUP.md).

Never prefix a secret with `NEXT_PUBLIC_`; anything with that prefix is bundled into the browser.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (`node --test` over `tests/*.test.ts`) |
| `npm run preview` / `npm run deploy` | OpenNext Cloudflare preview / deploy |

## Project structure

```text
app/                 App Router pages, loading states, and API routes
  admin/             Admin console
  manager/           Landlord / manager mode
  api/               Route handlers (insights, reports, devices, hardware, ...)
components/          UI, admin, manager, billing, analytics, and provider components
lib/                 Billing, notification, and assistant logic, including:
  auth-context.ts    getSessionUser(): the signed-in user, forwarded by the middleware
  meralco-rates*.ts  rate selectors (client-safe) and the cached server loader
  reports.ts         buildEnergyReport() shared by /reports and /api/reports
  device-telemetry.ts  20 s freshness window used for LIVE/online status
  supabase/          browser, server, middleware, and service-role clients
supabase/
  migrations/        Canonical schema, RLS, and RPC history (apply in order)
  functions/         Edge Functions: sync-meralco-rates, dispatch-budget-notifications, simulate-demo-units
tests/               Node test runner suites
.github/
  instructions/      Roadmap, AI workflow, and schema reference docs
  workflows/         Daily Meralco rate sync (11:00 Manila)
```

## How it stays fast

Most of the latency came from round trips between the app server and the database, so the design keeps them few and short:

- **Same region.** Vercel functions run in Seoul (`vercel.json`), next to Supabase.
- **One auth check per request.** The middleware (`lib/supabase/middleware.ts`) verifies the session and reads the profile once, then forwards the user's id, email, role, and billing day as request headers (client-supplied copies are stripped). Pages and route handlers read them with `getSessionUser()` instead of calling Supabase Auth again.
- **Static public pages.** The root layout reads no cookies, so `/`, login, register, onboarding, password reset, and the pitch deck are prerendered and served from the edge.
- **Parallel queries.** Pages start independent queries together (`lib/start-query.ts`) and stream secondary cards with `Suspense`.
- **Cached rates.** Meralco rates are cached across requests for an hour (`lib/meralco-rates-server.ts`).
- **Cheap database reads.** `energy_logs` RLS is evaluated once per query (migration `033`) and telemetry is read through bounded, index-backed RPCs (`034`). A unit adds about 17,000 rows a day, so never add per-row function calls to policies or unbounded `energy_logs` queries.
- **Realtime instead of reloads.** The dashboard patches live readings from Realtime and refreshes only when a device's relay or budget status actually changes.

## Deploying

- Pushing to `main` deploys to production through Vercel's Git integration.
- Database migrations are not applied by the deploy. Apply them with `supabase db push --linked` after checking `supabase migration list --linked`. For policy or RPC changes, verify results and timing as each role (`SET LOCAL ROLE authenticated` with the user's JWT claims) inside a transaction that ends in `ROLLBACK` before applying.
- If a change was made in the Supabase dashboard, capture it in a migration and record it with `supabase migration repair --status applied <version> --linked` (see `035`).

## Hardware integration

Each ESP32-S3 unit identifies itself by its Wi-Fi MAC address. Every 5 seconds it reads `devices.relay_state` and inserts an averaged telemetry row into `energy_logs` using the anon key. RLS allows the insert only when the MAC matches a registered device (migrations `011` and `022`). Database triggers then update monthly usage, may switch the relay off when a budget is exceeded, and set `devices.last_seen_at` (`035`, `036`).

A unit counts as LIVE or online when its latest reading (or `last_seen_at`) is under 20 seconds old; `devices.is_online` is never reset and is not used for status. Firmware timing, field names, and MAC formatting must change together with the migrations. The firmware side of this contract is documented in the [hardware repo](https://github.com/notsocj/wattwise_hardware) (`AGENTS.md` and `docs/`).

## Contributing notes

Project conventions for billing, data access, AI, notifications, and UI live in [AGENTS.md](AGENTS.md). After meaningful changes, keep the docs in `.github/instructions/` in sync.
