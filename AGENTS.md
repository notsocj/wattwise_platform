# AGENTS.md

## Scope

This file applies to the entire repository rooted at `wattwise_platform/`.
If a subdirectory later adds its own `AGENTS.md`, that file should take precedence for work inside that subtree.

## Project Snapshot

Wattwise is a mobile-first energy monitoring SaaS platform for Philippine households. It combines a Next.js 16 App Router frontend, Supabase auth/database/realtime, Meralco-aware billing logic, and OpenAI-powered Taglish energy insights.

- Frontend: Next.js 16.1.7, React 19.2.3, TypeScript 5, Tailwind CSS 4
- Backend/services: Supabase, Supabase Edge Functions, OpenAI SDK
- UI/data libs: Lucide React, Recharts, html5-qrcode
- Deployment/runtime: Vercel-ready app with OpenNext Cloudflare preview/deploy scripts available

## Repository Map

- `app/`: Next.js App Router pages, layouts, route loading states, and API routes
- `components/`: reusable UI, admin, insights, provider, and realtime components
- `lib/`: billing logic, usage helpers, constants, form messaging, and Supabase clients
- `supabase/migrations/`: canonical database schema and RPC history
- `supabase/functions/`: Edge Functions, including Meralco rate sync automation
- `.github/instructions/`: roadmap, workflow, and schema reference docs that must stay in sync with meaningful implementation changes

## Essential Commands

- `npm run dev`: start local development server
- `npm run build`: production build validation
- `npm run start`: run the production build locally
- `npm run lint`: run ESLint
- `npm test`: unit tests (`node --test` with `--experimental-strip-types`; needs Node 22.6+)
- `npx tsc --noEmit -p .`: type-check, including `tests/`
- `npm run preview`: OpenNext Cloudflare preview build
- `npm run deploy`: OpenNext Cloudflare deploy build
- `npm run cf-typegen`: refresh Cloudflare env typings

Default local URL is `http://localhost:3000`. If you need to avoid a port conflict with related Wattwise projects, prefer port `3001`.

## Deployment and Database Changes

- Pushing to `main` deploys production through Vercel's Git integration. Functions are pinned to Seoul (`icn1`) in `vercel.json`, next to the Supabase project (ap-northeast-2); keep them in the same region.
- Deploys do not apply migrations. Check `supabase migration list --linked`, then apply with `supabase db push --linked`.
- Before applying an RLS, trigger, or RPC change, verify it on production inside a transaction that ends in `ROLLBACK`: run the old and new versions as each role (`SET LOCAL ROLE authenticated` plus `request.jwt.claims` for a real user; `anon` for hardware) and compare results and timing. Migrations `032`-`036` record how this was done.
- If something was changed in the Supabase dashboard, capture it in a migration and mark it with `supabase migration repair --status applied <version> --linked` instead of re-running it.

## Architecture Rules

### Meralco billing

- Never compute cost with a flat multiplier like `kWh * 10`.
- Always fetch the active row from `meralco_rates` and compute cost from unbundled components plus fixed charges, then apply VAT last.
- Do not fall back to hardcoded runtime defaults if the database rate row is missing.

### Supabase and data access

- Treat Supabase as the system of record for auth, rates, telemetry, and cached AI insights.
- Never expose server secrets in client code. `SUPABASE_SECRET_KEY` and `OPENAI_API_KEY` stay server-only.
- Do not query `energy_logs` without a hard limit or a bounded time range. Each hardware unit adds about 17,000 rows a day; read telemetry through the bounded, index-backed RPCs (`get_latest_device_readings`, `get_usage_kwh_by_device[_day]`, `get_average_watts_by_device`) rather than raw rows.
- Keep RLS on large tables cheap: wrap `auth.uid()` and `current_profile_role()` in `(SELECT ...)` and compare against a SECURITY DEFINER key list (see migration `033`). Never add per-row function calls or per-row `EXISTS` subqueries to `energy_logs` policies.
- Pages and route handlers get the signed-in user from `getSessionUser()` (`lib/auth-context.ts`). The middleware verifies the session once, reads the profile once, and forwards id, email, role, and billing day in `x-wattwise-*` request headers after deleting any client-supplied copies. Never read those headers anywhere else, and never set them from client code.
- Start independent queries together (`startQuery` in `lib/start-query.ts`, `Promise.all`) and put secondary server components under `<Suspense>`; avoid one awaited query per line.
- The root layout must not read cookies or headers, or every public page becomes dynamic again. The session is read in the browser by `SupabaseProvider`.
- Prefer RPCs and server-side aggregation for billing-grade totals and charts.
- During the `energy_logs.device_id` transition, support both `devices.id` and legacy `devices.mac_address`.

### OpenAI usage

- All OpenAI calls must happen server-side only.
- Use the trigger-and-cache flow through `app/api/insights/route.ts`.
- Check `ai_insights` for a recent cached row before generating a new response.
- Insight tone must stay casual, practical, and Taglish, grounded in exact user data.

### External notifications

- Trigger OneSignal/Resend delivery only from deduplicated `device_budget_events`, never directly from `energy_logs`.
- Keep the MVP policy at 50% in-app only, 80% push, and both 100% terminal events push plus critical email.
- Never expose Supabase user UUIDs to notification providers; target the private random OneSignal external ID.
- Push permission must always follow an explicit user action. Missing provider credentials must degrade to a recorded skipped delivery without affecting telemetry or Smart Control.

### UI and design system

- Use the existing Space Grotesk typography, loaded with `next/font/google` in `app/layout.tsx` (self-hosted woff2, exposed as `--font-sans`).
- Use Tailwind utility classes and shared theme tokens such as `bg-canvas`, `bg-surface`, `text-mint`, `text-bida`, `text-naku`, and `text-danger`.
- Use `text-ink` for dark text on mint/bright fills (it stays dark in both themes). Never name a color token after a Tailwind size keyword (`base`, `sm`, `lg`, ...): `--color-base` once turned every `text-base` into a color instead of 16px.
- Avoid hardcoding new hex colors in JSX when a theme token should be used instead.
- Reserve danger red for destructive or safety-critical states only.
- Reuse shared feedback primitives like `components/ui/LoadingIndicator.tsx` for pending states.
- Use `components/ui/PageHeader.tsx` (with `pt-[84px]` on the body) for mobile page headers, `useConfirmDialog` from `components/ui/ConfirmDialog.tsx` instead of `window.confirm`/`alert`, and `app/error.tsx` as the route error boundary.
- Light theme works by overriding `text-white/*`, `bg-white/*`, and `border-white/*` classes in `app/globals.css`. When you introduce a new opacity step, add its light override (the bg/border block is generated from usage). Keep tap targets at least 40px (`h-10 w-10`) and readable copy at `text-white/50` or stronger.

### React and TypeScript

- TypeScript strict mode is enabled. Avoid `any`.
- Use the `@/*` path alias for local imports.
- React Compiler is enabled in `next.config.ts`; do not add defensive `useMemo`/`useCallback` boilerplate unless there is a demonstrated need.
- Keep components readable and extract reusable UI into `components/` rather than growing route files indefinitely.

## Workflow Expectations For Agents

1. Read the relevant route, component, helper, and migration files before changing behavior.
2. Preserve the current architecture instead of introducing parallel patterns for billing, telemetry, caching, or auth.
3. For user-facing forms, prefer inline validation and friendly recovery messages over raw provider errors or browser default popups.
4. Keep live telemetry freshness-aware. Stale readings should render offline or idle rather than active.
5. Keep `profiles.monthly_budget_php` editable only from the Home Dashboard wallet flow.
6. Run `npm run lint` and `npm run build` before handoff when the change is substantial enough to justify validation.

## Known Project Conventions

- App Router pages already exist for `/`, `/dashboard`, `/dashboard/calendar`, `/analytics`, `/settings`, `/admin`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/update-password`, and `/onboarding`.
- Smart Control user routes also exist for `/analytics` and `/settings`.
- Shared Supabase helpers live under `lib/supabase/`.
- Shared helpers: telemetry freshness (`ACTIVE_READING_WINDOW_MS`, `isFreshReading`) in `lib/device-telemetry.ts`, peso formatting in `lib/format.ts`, the OpenAI chat model in `lib/openai.ts`, and PostgREST search sanitizing in `lib/postgrest.ts`. Reuse them instead of redefining per file.
- Reports are built once in `lib/reports.ts` (`buildEnergyReport`) from the per-day usage RPC, `get_average_watts_by_device`, and day-by-day Meralco pricing; `/reports` renders it on the server and `/api/reports` serves the same rows as JSON, CSV, or PDF. Keep period windows bounded and never read raw `energy_logs` rows for totals.
- Meralco rates are read through `lib/meralco-rates-server.ts` (cached across requests); the signed-in user comes from `getSessionUser()` in `lib/auth-context.ts`, which reads identity the middleware forwards. Do not call `supabase.auth.getUser()` in pages or route handlers.
- Route-level loading UIs are part of the app structure; preserve them when adding slow server-rendered pages.
- Service worker/PWA work is planned but not fully implemented. Be careful not to document it as complete unless the code actually exists.

## Documentation Sync

After meaningful implementation work, update the relevant files in `.github/instructions/`:

- `phases-and-roadmap-plan.instructions.md`: roadmap status and completion notes
- `ai-workflow.instructions.md`: new implementation patterns or guardrails
- `supabase-schema-context.instructions.md`: schema, RPC, index, or query-pattern changes

Skip this sync only for trivial edits that do not materially affect workflow, architecture, or progress tracking.

## Environment Notes

Expected environment variables live in `.env.local`.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` (service role key, server-only): admin console, tenant creation, account deletion, and the cross-request Meralco rate cache in `lib/meralco-rates-server.ts`, which falls back to direct reads when it is missing

Document any newly required variables when adding features.

## Smart Control Notes

- Add Appliance registers a device before AI profiling so the ESP32-S3 can post MAC-address telemetry under the existing anon RLS guard.
- Per-device budget shutoff compares calendar-month variable Meralco spend against `devices.user_approved_limit_php`; fixed charges remain home-level context and are excluded from relay cutoff decisions.
- `devices.require_approval_on_expiry = true` records an approval-required event instead of automatically setting `relay_state = false`.
- Keep `energy_logs` and `devices` in the `supabase_realtime` publication. The dashboard patches live W/V/A from `energy_logs` INSERTs and follows `devices` UPDATEs, but triggers update `devices` on every reading (`last_seen_at`, `budget_status = 'ok'`), so only react when `relay_state` or `budget_status` actually changes. Do not call `router.refresh()` per reading; it re-renders the whole page and its background prefetches.
- A device is LIVE/online when its latest reading or `devices.last_seen_at` is within `ACTIVE_READING_WINDOW_MS` (20 s). `devices.is_online` is set on every reading but never cleared, so do not use it for status.
- `update_device_last_seen()` must stay SECURITY DEFINER: hardware inserts as `anon`, which cannot update `devices` (migration `036`).
- Relay changes from the app are commands; the unit applies them on its next 5 s poll. Confirm before turning a device off and word results as "sent".
