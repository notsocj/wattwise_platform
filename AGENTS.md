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
- `public/fonts/`: local Space Grotesk font files
- `supabase/migrations/`: canonical database schema and RPC history
- `supabase/functions/`: Edge Functions, including Meralco rate sync automation
- `.github/instructions/`: roadmap, workflow, and schema reference docs that must stay in sync with meaningful implementation changes

## Essential Commands

- `npm run dev`: start local development server
- `npm run build`: production build validation
- `npm run start`: run the production build locally
- `npm run lint`: run ESLint
- `npm run preview`: OpenNext Cloudflare preview build
- `npm run deploy`: OpenNext Cloudflare deploy build
- `npm run cf-typegen`: refresh Cloudflare env typings

Default local URL is `http://localhost:3000`. If you need to avoid a port conflict with related Wattwise projects, prefer port `3001`.

## Architecture Rules

### Meralco billing

- Never compute cost with a flat multiplier like `kWh * 10`.
- Always fetch the active row from `meralco_rates` and compute cost from unbundled components plus fixed charges, then apply VAT last.
- Do not fall back to hardcoded runtime defaults if the database rate row is missing.

### Supabase and data access

- Treat Supabase as the system of record for auth, rates, telemetry, and cached AI insights.
- Never expose server secrets in client code. `SUPABASE_SECRET_KEY` and `OPENAI_API_KEY` stay server-only.
- Do not query `energy_logs` without a hard limit or a bounded time range.
- Prefer RPCs and server-side aggregation for billing-grade totals and charts.
- During the `energy_logs.device_id` transition, support both `devices.id` and legacy `devices.mac_address`.

### OpenAI usage

- All OpenAI calls must happen server-side only.
- Use the trigger-and-cache flow through `app/api/insights/route.ts`.
- Check `ai_insights` for a recent cached row before generating a new response.
- Insight tone must stay casual, practical, and Taglish, grounded in exact user data.

### UI and design system

- Use the existing Space Grotesk typography from `public/fonts` and `app/globals.css`.
- Use Tailwind utility classes and shared theme tokens such as `bg-base`, `bg-surface`, `text-mint`, `text-bida`, `text-naku`, and `text-danger`.
- Avoid hardcoding new hex colors in JSX when a theme token should be used instead.
- Reserve danger red for destructive or safety-critical states only.
- Reuse shared feedback primitives like `components/ui/LoadingIndicator.tsx` for pending states.

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
- `SUPABASE_SECRET_KEY` (service role key, server-only, used for self-service account deletion)

Document any newly required variables when adding features.

## Smart Control Notes

- Add Appliance registers a device before AI profiling so the ESP32-S3 can post MAC-address telemetry under the existing anon RLS guard.
- Per-device budget shutoff compares calendar-month variable Meralco spend against `devices.user_approved_limit_php`; fixed charges remain home-level context and are excluded from relay cutoff decisions.
- `devices.require_approval_on_expiry = true` records an approval-required event instead of automatically setting `relay_state = false`.
- Keep Supabase Realtime enabled for `energy_logs` in the Supabase dashboard; the browser listens for INSERT payloads for live W/V/A updates.
