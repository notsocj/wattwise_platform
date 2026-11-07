# AGENTS.md

## Scope

This file applies to the entire repository rooted at `wattwise_platform/`.
If a subdirectory later adds its own `AGENTS.md`, that file should take precedence for work inside that subtree.

## Project Snapshot

Wattwise is a mobile-first energy monitoring SaaS platform for Philippine households. It combines a Next.js 16 App Router frontend, Supabase auth/database/realtime, Meralco-aware billing logic, and OpenAI-powered Taglish energy insights.

- Frontend: Next.js 16.1.7, React 19.2.3, TypeScript 5, Tailwind CSS 4
- Backend/services: Supabase, Supabase Edge Functions, OpenAI SDK
- UI/data libs: Solar icons from Iconify (generated into `components/ui/icons.tsx`), Recharts, html5-qrcode; three.js + @react-three/fiber and Lenis on the `/onboarding` landing page only
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

Default local URL is `http://localhost:3000`. If you need to avoid a port conflict with related Wattwise projects, prefer port `3001`. After editing theme tokens in `app/globals.css`, restart the dev server if new colour utilities don't appear; it can keep serving a stale stylesheet.

## Deployment and Database Changes

- Pushing to `main` deploys production through Vercel's Git integration. Functions are pinned to Seoul (`icn1`) in `vercel.json`, next to the Supabase project (ap-northeast-2); keep them in the same region.
- Deploys do not apply migrations. Check `supabase migration list --linked`, then apply with `supabase db push --linked`.
- Before applying an RLS, trigger, or RPC change, verify it on production inside a transaction that ends in `ROLLBACK`: run the old and new versions as each role (`SET LOCAL ROLE authenticated` plus `request.jwt.claims` for a real user; `anon` for hardware) and compare results and timing. Migrations `032`-`036` record how this was done.
- If something was changed in the Supabase dashboard, capture it in a migration and mark it with `supabase migration repair --status applied <version> --linked` instead of re-running it.

## Architecture Rules

### Meralco billing

- Never compute cost with a flat multiplier like `kWh * 10`.
- Always fetch the active row from `meralco_rates` and compute cost with `computeMeralcoBill` / `computeVariableRatePerKwh` from `lib/meralco-bill.ts`, the single implementation. It bills like Meralco's Summary Schedule of Rates: monthly VAT rates on Generation, Transmission, and Ancillary Service (`vat_generation`, `vat_transmission`, `vat_ancillary`); the general rate (`vat_rate`) on distribution, supply, metering, fixed charges, and the AWAT / regulatory reset / lifeline rate / senior citizen adjustments; no VAT on System Loss, Universal Charge, FIT-All, GEA-All, RPT, and the lifeline subsidy.
- Distribution is tiered by the whole home's monthly kWh: one rate on every kWh (up to 200, 201-300, 301-400, over 400; `distribution*` columns), plus energy tax above 650 kWh (BP 36, no VAT). The household kWh is `profiles.meralco_monthly_kwh` (the homeowner's bill, set in Settings) or, when empty, monitored usage this billing cycle projected to the full cycle. `lib/meralco-rates-server.ts` applies it automatically through `my_household_usage()`; admin code passes `{ household }` for a specific owner (`household_monthly_kwh_for`, service role only).
- The budget-cutoff trigger uses the same formula in SQL, `public.meralco_variable_rate_per_kwh(rate, household_kwh)` (migrations `037`, `038`). Change it together with `lib/meralco-bill.ts` and `tests/meralco-bill.test.ts`, and keep the October 2026 checks passing (PHP 14.8761/kWh at the base tier; Meralco's typical bills at 300, 500, and 1,000 kWh).
- Do not fall back to hardcoded runtime defaults if the database rate row is missing.
- Never round money per reading. `device_month_usage.variable_spend_php` keeps full precision (migration `039`); round only for display. The budget trigger ignores kWh jumps no 10 kW load could make in the elapsed time.
- Demo units are simulated by `public.simulate_demo_units()` on a 10-second pg_cron job (migration `039`), not by an Edge Function. Every explicit Start must set `is_active = true` and `live_since = null` together; the next simulator tick begins a fresh 4-hour window. Preserve `energy_kwh` and `last_generated_at` on Start so existing gaps can be backfilled (up to 14 days). A brand-new or reset meter begins with live readings, without seeded history.

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
- Use Tailwind utility classes and shared theme tokens such as `bg-canvas`, `bg-surface`, `text-fg`, `text-accent`, `bg-mint`, `text-bida`, `text-naku`, and `text-danger`. The WattWise owl is `components/ui/BrandMark.tsx` (it takes the text colour); use it for the assistant and brand spots instead of a generic robot icon.
- Use `text-ink` for dark text on mint/bright fills (it stays dark in both themes). Never name a color token after a Tailwind size keyword (`base`, `sm`, `lg`, ...): `--color-base` once turned every `text-base` into a color instead of 16px.
- Avoid hardcoding new hex colors in JSX when a theme token should be used instead.
- Icons are Solar (Iconify), imported from `@/components/ui/icons` (`Home`, `Check`, `Zap`, ...). To add one, map a component name to a Solar icon in `scripts/build-icons.mjs` and run `npm run icons`; never edit `components/ui/icons.tsx` by hand or add another icon library. Size with `h-*`/`w-*`; `strokeWidth` adjusts line weight.
- Reserve danger red for destructive or safety-critical states only.
- Reuse shared feedback primitives: `components/ui/LoadingIndicator.tsx` for pending states, `SubmitButton` (idle, processing, success) and `FormAlert` (form-level errors) for form submits.
- Use `components/ui/PageHeader.tsx` (with `pt-[84px]` on the body) for mobile page headers, `useConfirmDialog` from `components/ui/ConfirmDialog.tsx` instead of `window.confirm`/`alert`, and `app/error.tsx` as the route error boundary.
- Desktop (Tailwind `lg`, 1024px+) is laid out by `components/ui/AppFrame.tsx` in the root layout: app routes (`APP_SHELL_PREFIXES` in `components/ui/app-nav.ts`) get `AppSidebar` (groups from `APP_DESKTOP_SECTIONS`) and pages sit on the rounded `DESKTOP_PANEL`; sign-in pages get `AuthBrandPanel` beside the form. Below `lg`, everything stays in the phone column with the bottom bar: 430px, widened to `md:max-w-2xl` on tablets; the sidebar is `w-56` (`xl:w-64`) and the content panel caps at `lg:max-w-6xl` / `2xl:max-w-7xl`. On desktop `PageHeader` is an in-page title block (pass `description`; no back button), so page bodies use `pt-[84px] lg:pt-0` and loading screens start with `PageTitleSkeleton`. Cards use `CARD` / `CardHeader` from `components/ui/Card.tsx`. Pages use `lg:grid lg:grid-cols-12` with `lg:col-span-*`, and `lg:order-*` only to move secondary cards down.
- Shapes: buttons, inputs, selects, and segmented controls are pills (`rounded-full`); cards stay `rounded-2xl`/`CARD`. Use `components/ui/Switch.tsx` for on/off toggles (`pending` spinner, `tone="warning"` for safety switches) and an in-app picker (such as the billing day grid in `BillingCycleSection`) instead of a native `<select>`.
- Settings sections are built from `SettingsGroup`, `SettingsRow`, and `SETTINGS_ACTION_ROW` (`components/settings/SettingsGroup.tsx`). Log out lives only in Settings → Account (phones) and the desktop sidebar; `PageHeader` has no logout button. Sign out through `useLogout()` from `components/ui/LogoutButton.tsx` (`logout("global")` ends every session and falls back to local on error), always behind `useConfirmDialog`.
- Colors are theme tokens (`app/globals.css`), never hard-coded white: `text-fg/60`, `border-fg/[0.06]`, `bg-fg/[0.04]` for foreground, `text-accent` for mint text and icons (darker in light mode for contrast), `bg-mint`/`border-mint` for fills, `bg-shade/10` for inset wells. Literal `text-white`/`bg-white` only on surfaces that stay coloured in both themes (red buttons, toggle knobs, print). The saved theme is applied before paint by the script in `app/layout.tsx`.
- Motion: use the `ease-out`, `ease-in-out`, and `ease-drawer` tokens from `app/globals.css`. Name transitioned properties as `translate`/`scale`/`opacity` (Tailwind 4 sets those properties, not `transform`). Use `starting:` for mount entrances; page bodies use `ww-stagger` and title blocks `lg:ww-enter` (both `backwards`-filled so no transform lingers to trap fixed children). The theme color fade is in `@layer base` so `transition-*` utilities win; keep it there.
- Light theme comes from the tokens above switching values under `[data-theme="light"]`; there are no per-class overrides, so any opacity step works. Keep tap targets at least 40px (`h-10 w-10`) and readable copy at `text-fg/50` or stronger.

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
5. Keep `profiles.monthly_budget_php` editable only from the Home Dashboard wallet flow (`HomeBudgetEditor`) and the customer assistant's user-confirmed actions (`app/api/customer-assistant/actions/[messageId]/confirm`). Do not add other writers.
6. Run `npm run lint` and `npm run build` before handoff when the change is substantial enough to justify validation.

## Known Project Conventions

- App Router pages exist for `/` (splash that redirects to `/onboarding` or the signed-in home), `/onboarding` (public landing page), `/privacy` and `/terms` (public legal pages), `/login`, `/register`, `/forgot-password`, `/reset-password`, `/update-password`, `/dashboard`, `/dashboard/[deviceId]`, `/dashboard/calendar`, `/analytics` (Burn), `/reports`, `/rates`, `/settings`, `/manager/*`, `/admin/*`, and `/pitch-deck`.
- The landing page's 3D unit (`components/landing/device/`) is ported from the owner's gsap-portfolio repo; it loads client-side only, pauses rendering off screen, and falls back to an SVG drawing without WebGL. The pitch deck keeps its own fixed dark styling.
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
- `smart-control-architecture-blueprint.instructions.md`: telemetry, budget, relay, and Smart Control surfaces

Also keep these current when the work touches them:

- `README.md` (features, stack, structure, environment variables) and `TESTING.md` (manual checklist; update its date)
- `.github/copilot-instructions.md`, the Copilot counterpart of this file
- `NOTIFICATION_SETUP.md` for notification providers, secrets, and webhooks
- `docs/` for longer notes and plans, such as `docs/light-mode-plan.md` (theme tokens and open work)

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
- Per-device budget shutoff compares variable Meralco spend for the owner's custom billing cycle (`profiles.billing_cycle_start_day`, Asia/Manila) against `devices.user_approved_limit_php`; fixed charges remain home-level context and are excluded from relay cutoff decisions.
- `devices.require_approval_on_expiry = true` records an approval-required event instead of automatically setting `relay_state = false`.
- Keep `energy_logs` and `devices` in the `supabase_realtime` publication. The dashboard patches live W/V/A from `energy_logs` INSERTs and follows `devices` UPDATEs, but triggers update `devices` on every reading (`last_seen_at`, `budget_status = 'ok'`), so only react when `relay_state` or `budget_status` actually changes. Do not call `router.refresh()` per reading; it re-renders the whole page and its background prefetches.
- A device is LIVE/online when its latest reading or `devices.last_seen_at` is within `ACTIVE_READING_WINDOW_MS` (20 s). `devices.is_online` is set on every reading but never cleared, so do not use it for status.
- `update_device_last_seen()` must stay SECURITY DEFINER: hardware inserts as `anon`, which cannot update `devices` (migration `036`).
- Anon may read only `devices.mac_address` and `devices.relay_state` (migration `040`), which is all the firmware's relay poll needs. Never grant anon more columns, and keep every function on the anon `energy_logs` insert path SECURITY DEFINER.
- Relay changes from the app are commands; the unit applies them on its next 5 s poll. Confirm before turning a device off and word results as "sent".
- Scheduled turn-offs (`device_automations`, migration `041`) turn a device OFF at a Manila time, or after it spends PHP X / uses X kWh more from when the rule was made, until an end time. They are created only through `create_device_automation()` (owner role, after confirming a customer-assistant proposal) and cancelled with `cancel_device_automation()` (Device page card). `run_device_automations()` runs every 15 s from pg_cron, outside the `energy_logs` insert path, reads spend from `device_month_usage` deltas, and never turns a device on. Time and threshold parsing lives in `lib/device-automations.ts` (tested in `tests/device-automations.test.ts`).
- Stateless chat panels (landing chatbot, manager assistant) use `components/ui/FloatingChat.tsx` (owl button plus bottom-sheet/corner panel; the caller supplies `send`). The manager assistant is `ManagerAssistantFab`, mounted in `ManagerShell` on every manager page; there is no AI tab (`/manager/ai` redirects to `/manager`, and its priority cards are `ManagerPriorityCards` on the Fleet page). Its chat route refuses clearly off-topic requests with `isClearlyOffTopic`.
- Managers can reissue a tenant's temporary password while `must_update_password` is true (`POST /api/manager/tenants/[tenantId]/temporary-password`, which checks `manager_id` and replaces the old password; passwords are only stored hashed, so the original can't be shown again). Generate passwords with `lib/temp-password.ts`.
- The landing page has a signed-out chatbot (`components/landing/LandingAssistant.tsx` → `POST /api/public-assistant`). It only explains WattWise: no account data, no tools, nothing stored. Keep its guardrails: same-origin `Origin` check; `parsePublicChatBody` (400-character messages, last 6 turns, user/assistant roles only); `take_public_chat_slot()` limits (migration `042`, 5/minute and 30/day per hashed IP, 1500/day overall) checked before any OpenAI call and failing closed; `publicGuardReply` for off-topic and prompt-injection messages (no OpenAI call); `max_tokens` 300. Facts it may state live in `PUBLIC_ASSISTANT_SYSTEM_PROMPT` (`lib/public-assistant-policy.ts`); never let it quote prices, stock, or contact details, and update the prompt when a feature changes. Tests: `tests/public-assistant.test.ts`.
- Registration requires ticking the Terms and Privacy Policy checkbox; sign-up saves `terms_version` (`LEGAL_VERSION` in `lib/legal.ts`) and `terms_accepted_at` in the user metadata as proof of consent. When `/privacy` or `/terms` changes in substance, update `LEGAL_VERSION` and `LEGAL_UPDATED`, and update `/privacy` whenever a feature collects new data or adds a provider (contact: `LEGAL_CONTACT_EMAIL`). Tenant accounts created by a manager do not tick the box yet.
