# WattWise Platform

WattWise is a mobile-first energy monitoring app for Philippine households. It pairs with the [WattWise ESP32-S3 sub-meter](https://github.com/notsocj/wattwise_hardware) to show live per-appliance usage, compute Meralco-accurate costs, enforce per-device budgets through a smart relay, and explain usage in casual Taglish through AI insights.

Production: [wattwise-app.site](https://www.wattwise-app.site)

## Features

- **Live dashboard** with per-device watts, voltage, and current from Supabase Realtime, plus freshness-aware online/idle/offline states
- **Meralco billing** computed from the active unbundled rate row (generation, transmission, ancillary, system loss, distribution, supply, metering, universal charges, FIT-All, fixed charges, VAT last), with a public `/rates` transparency page
- **Smart Control**: per-device monthly budget limits that cut the relay when spend is exceeded, with optional approval-on-expiry
- **Budget alerts** at 50% (in-app), 80% (push), and 100% (push + email) via OneSignal and Resend
- **Analytics, calendar, and reports** with CSV and PDF export
- **AI insights and a customer assistant**, generated server-side with OpenAI and cached in `ai_insights`
- **Manager mode** for landlords: rooms, tenants, fleet dashboard, and manager AI
- **Admin console**: users, devices, rates, analytics, AI costs, audit log, health, demo units, and a hardware test lab

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | Next.js 16 (App Router, React Compiler), React 19, TypeScript, Tailwind CSS 4, Recharts, Lucide |
| Backend | Supabase (Postgres, Auth, Realtime, RLS, Edge Functions) |
| AI | OpenAI SDK (server-side only) |
| Notifications | OneSignal Web Push, Resend email |
| Hosting | Vercel (OpenNext Cloudflare scripts also available) |

## Getting started

Requirements: Node.js 20.9 or later and access to the WattWise Supabase project.

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
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` | server only | Admin client: tenant creation, account deletion, admin console |
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
lib/                 Billing, usage, notification, and assistant logic; Supabase clients in lib/supabase/
supabase/
  migrations/        Canonical schema, RLS, and RPC history (apply in order)
  functions/         Edge Functions: sync-meralco-rates, dispatch-budget-notifications, simulate-demo-units
tests/               Node test runner suites
.github/
  instructions/      Roadmap, AI workflow, and schema reference docs
  workflows/         Daily Meralco rate sync (11:00 Manila)
```

## Hardware integration

Each ESP32-S3 unit identifies itself by its Wi-Fi MAC address. Every 5 seconds it reads `devices.relay_state` and inserts an averaged telemetry row into `energy_logs` using the anon key. RLS allows the insert only when the MAC matches a registered device (migrations `011` and `022`). A database trigger then updates monthly usage and may switch the relay off when a budget is exceeded. Firmware and field names must change together with the migrations.

## Contributing notes

Project conventions for billing, data access, AI, notifications, and UI live in [AGENTS.md](AGENTS.md). After meaningful changes, keep the docs in `.github/instructions/` in sync.
