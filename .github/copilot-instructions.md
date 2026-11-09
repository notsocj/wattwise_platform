# Wattwise Platform — AI Agent Instructions

This is the GitHub Copilot version of `AGENTS.md` at the repo root. `AGENTS.md` is the source of truth for conventions; if the two disagree, follow `AGENTS.md` and fix this file. Deeper references live in `.github/instructions/`:

- `ai-workflow.instructions.md`: coding constraints for billing, hardware safety, ingestion, and OpenAI
- `supabase-schema-context.instructions.md`: tables, RPCs, indexes, and query patterns (migrations `001`-`043`)
- `smart-control-architecture-blueprint.instructions.md`: realtime telemetry, AI profiling, budgets, relay shutoff
- `phases-and-roadmap-plan.instructions.md`: roadmap and what is done

---

## Project Overview

WattWise is a mobile-first energy monitoring app for Philippine households. A WattWise unit (ESP32-S3 smart plug) sits between the outlet and an appliance and posts watts, volts, and amps to Supabase every few seconds. The app prices that usage exactly like a Meralco bill, sets per-appliance peso budgets, can switch the appliance off through the unit's relay, and gives casual Taglish tips written by OpenAI.

Deployment: pushing to `main` deploys production on Vercel (functions pinned to Seoul, `icn1`, next to the Supabase project). OpenNext Cloudflare scripts also exist.

---

## Features (what exists today)

### Homeowner app (role `user`; `tenant` sees a limited version)
- **Splash `/`**: about 3 seconds of CSS-animated intro, then redirects to `/onboarding` (guest) or `/dashboard` (signed in).
- **Landing `/onboarding`**: a full-width marketing page with a 3D WattWise unit, scroll reveals, and smooth scrolling (see "Landing page" below).
- **Sign-in pages**: `/login`, `/register`, `/forgot-password`, `/reset-password` (email reset link), `/update-password` (tenants who must change their first password are forced here by the middleware).
- **Home `/dashboard`**: household budget wallet (`HomeBudgetEditor`, the only place `profiles.monthly_budget_php` is edited), device cards with live W/V/A over Supabase Realtime, Taglish insight and budget alert cards, and Add Appliance (QR scan of the unit's MAC with `html5-qrcode`, then AI appliance profiling).
- **Device detail `/dashboard/[deviceId]`**: gauges, per-device budget limit, relay on/off, restore power, scheduled turn-offs, and Unit settings (rename, change type, remove the unit and its readings through `/api/devices/[deviceId]`).
- **Add Appliance "Other"**: picking Other asks what the appliance is; it is saved in `devices.appliance_detail` (migration `044`) and used in reports and AI profiling.
- **Burn `/analytics`**: how fast the billing cycle budget is being spent and the projection.
- **Reports `/reports`**: usage and cost by period, downloadable as PDF (`pdf-lib`) or CSV through `/api/reports`.
- **Calendar `/dashboard/calendar`**: day-by-day usage and cost with AI notes.
- **Meralco Rates `/rates`**: the current rate schedule and rate history.
- **Settings `/settings`**: grouped rows for billing cycle (in-app day picker) and household Meralco kWh, appearance (light/dark), notifications, safety (auto-shutoff), and account (change password, reset email, log out, log out of all devices, delete account).
- **Assistant**: a floating WattWise assistant (`components/customer-assistant/CustomerAssistantFab.tsx`) that answers questions and proposes actions the user must confirm, including turning a unit on or off now (`set_power`) and scheduled turn-offs.

### Manager portal `/manager` (role `manager`, e.g. landlords)
Fleet (with AI priority cards), Rooms (pair, rename, remove units), Tenants (creates tenant logins, reissues temporary passwords), Calendar, Settings; the manager assistant is a floating owl button (`ManagerAssistantFab`) on every page. Layout is `components/manager/ManagerShell.tsx`.

### Super admin console `/admin` (role `super_admin`)
Overview, Users, Devices, Demo Units, Meralco Rates (read-only history; rates come from the sync job), Growth, AI Costs (token usage from `ai_insights`), System Health, Global Analytics, Audit Log, Test Lab. It has its own layout and `components/admin/AdminSidebar.tsx`.

### Background systems
- **Meralco rate sync**: Edge Function `supabase/functions/sync-meralco-rates`, triggered daily at 03:00 UTC by `.github/workflows/sync-meralco-rates.yml`.
- **Budget notifications**: Edge Function `dispatch-budget-notifications` sends OneSignal push and Resend email from `device_budget_events` (50% in-app only, 80% push, 100% push plus email).
- **Demo units**: simulated in SQL by `public.simulate_demo_units()` on a 10-second pg_cron job.
- **Budget cutoff**: a database trigger compares variable Meralco spend for the billing cycle against each device's limit.

### Not built
- No offline mode and no app service worker. There is no Serwist or any PWA caching. The app has a web manifest (`public/site.webmanifest`) so it can be added to a home screen, and the only service worker is OneSignal's push worker under `public/push/onesignal/`. Do not describe offline/PWA caching as done.
- `/pitch-deck` is a standalone presentation page, not part of the product.

---

## Technology Stack

Versions are from `package.json`.

- **Next.js 16.1.7** App Router, **React 19.2.3** with the React Compiler (`reactCompiler: true` in `next.config.ts`), **TypeScript 5** strict, `@/*` path alias to the repo root
- **Tailwind CSS 4** via `@tailwindcss/postcss`; theme tokens in `app/globals.css`
- **Supabase**: `@supabase/supabase-js`, `@supabase/ssr` (clients in `lib/supabase/`), Postgres RPCs, RLS, Realtime, Edge Functions (Deno), pg_cron
- **OpenAI SDK** (`openai`), model `gpt-4o-mini` set once in `lib/openai.ts`; server-side only
- **UI/data**: Solar icons from Iconify, generated into `components/ui/icons.tsx` by `npm run icons` (`scripts/build-icons.mjs`), `recharts` charts, `swr` (with `lib/fetcher.ts`), `html5-qrcode`, `pdf-lib`
- **Landing only**: `three` 0.186.1, `@react-three/fiber` 9.8.1, `lenis`
- **Middleware**: `proxy.ts` (Next 16 name for middleware) calls `lib/supabase/middleware.ts`

---

## Essential Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server at http://localhost:3000 (use `-- -p 3001` to avoid clashing with other Wattwise projects) |
| `npm run build` | Production build (`next build --webpack`); type-checks the app |
| `npm run start` | Run the production build locally |
| `npm run lint` | ESLint |
| `npm test` | Unit tests in `tests/` (`node --test --experimental-strip-types`; needs Node 22.6+) |
| `npx tsc --noEmit -p .` | Type-check, including `tests/` |
| `npm run preview` / `npm run deploy` | OpenNext Cloudflare build and preview / deploy |
| `npm run cf-typegen` | Refresh Cloudflare env typings |

Database: deploys do not apply migrations. Check `supabase migration list --linked`, then `supabase db push --linked`. See `AGENTS.md` for how to verify RLS, trigger, and RPC changes first.

---

## Directory Layout

- `app/`: routes, layouts, `loading.tsx` screens, `error.tsx` (route error boundary), `not-found.tsx`, and `app/api/**/route.ts` handlers
- `components/ui/`: shared UI (frame, sidebar, header, cards, buttons, dialogs, loaders, nav config)
- `components/<area>/`: feature components (`admin`, `analytics`, `billing`, `calendar`, `customer-assistant`, `dashboard`, `insights`, `landing`, `manager`, `reports`, `settings`, `providers`, `realtime`)
- `lib/`: billing (`meralco-bill.ts`, `meralco-rates-server.ts`), auth (`auth-context.ts`, `roles.ts`), data helpers, reports, OpenAI, Supabase clients
- `supabase/migrations/`: schema and RPC history (source of truth for the database)
- `supabase/functions/`: Edge Functions
- `tests/`: unit tests

Naming: components are `PascalCase.tsx`; helpers in `lib/` are `kebab-case.ts`.

---

## Design System

### Typography
Space Grotesk, loaded with `next/font/google` in `app/layout.tsx` (self-hosted at build time) and exposed to Tailwind as `--font-sans`. There are no font files in `public/`.

### Colour tokens (`app/globals.css`)
The app has dark and light themes. Tokens switch value under `[data-theme="light"]`, so components never need per-theme classes, and `dark:` follows the app's toggle, not the OS.

| Token | Use |
|-------|-----|
| `fg` | Foreground. Use with opacity: `text-fg/60`, `border-fg/[0.06]`, `bg-fg/[0.04]`. |
| `accent` | Mint for text and icons (`text-accent`); darker in light mode for contrast. |
| `mint` | Bright brand fill in both themes: `bg-mint`, `border-mint`, `bg-mint/10`. |
| `ink` | Dark text on mint or bright fills (`text-ink`); stays dark in both themes. |
| `canvas` | Page background. |
| `surface` | Card background. |
| `shade` | Inset wells such as inputs and nested panels: `bg-shade/10`. |
| `sidebar` | Desktop sidebar rail. |
| `bida` / `naku` / `danger` | Status: good news / warning / destructive or safety-critical only. |

Rules:
- Never hard-code white (`text-white`, `border-white/5`, ...). Literal white is only for surfaces that are coloured in both themes (red buttons, toggle knobs, print).
- Do not add hex colours in JSX when a token fits.
- Never name a colour token after a Tailwind size keyword (`base`, `sm`, `lg`): `--color-base` once turned every `text-base` into a colour.
- Keep readable copy at `text-fg/50` or stronger and tap targets at least 40px (`h-10 w-10`).
- The saved theme (localStorage `wattwise-theme`) is applied before first paint by an inline script in `app/layout.tsx`; `components/providers/ThemeProvider.tsx` and `ThemeToggle` handle switching.

### Layout: phone and desktop
`components/ui/AppFrame.tsx`, mounted in the root layout, picks the frame from the path:

- **Below `lg` (under 1024px)**: the user app is a 430px phone column (widened to `md:max-w-2xl` on tablets) with a fixed bottom tab bar (`components/ui/BottomNav.tsx`: Home, Burn, Reports, Settings, plus the assistant button). The manager portal uses its own wider column and a five-tab bottom bar plus the assistant button.
- **App routes on `lg`+** (`APP_SHELL_PREFIXES` in `components/ui/app-nav.ts`: `/dashboard`, `/analytics`, `/reports`, `/settings`, `/rates`): `AppSidebar` on the left with groups from `APP_DESKTOP_SECTIONS` (Overview: Home, Burn, Reports; Billing: Calendar, Meralco Rates). Settings, the light/dark toggle, Log out, and an account card sit at the bottom. One highlight glides to the active item. Pages sit on the rounded `DESKTOP_PANEL` (content up to `lg:max-w-6xl`, `2xl:max-w-7xl`). The sidebar is `w-56`, `xl:w-64`.
- **Manager on `lg`+**: `ManagerShell` uses the same `AppSidebar` with `MANAGER_DESKTOP_SECTIONS` and the same `DESKTOP_PANEL`.
- **Sign-in pages on `lg`+** (`/login`, `/register`, `/forgot-password`): a two-column split with `components/ui/AuthBrandPanel.tsx` beside the form.
- `/admin`, `/manager`, `/onboarding`, `/pitch-deck`, `/privacy`, and `/terms` lay themselves out.

Page building blocks:
- `components/ui/PageHeader.tsx`: a fixed 64px bar on phones (body needs `pt-[84px] lg:pt-0`, exported as `PAGE_HEADER_OFFSET`); on desktop an in-page title block with no back button. Pass `description` for the desktop intro line and `desktopTitle` to replace the title on desktop. Loading screens start with `PageTitleSkeleton`. There is no logout in the header; pass `actions` only for page-specific buttons.
- `components/ui/Card.tsx`: `CARD` (the one card surface class), `CardHeader` (icon chip, title, right slot), `CardPill` (small muted pill).
- Desktop page grids use `lg:grid lg:grid-cols-12` with `lg:col-span-*`; use `lg:order-*` only to move secondary cards down.
- Forms: `components/ui/SubmitButton.tsx` (`status` is `idle` | `loading` | `success`) and `components/ui/FormAlert.tsx` for inline errors. Show friendly messages (`lib/user-form-messages.ts`), not raw provider errors.
- `useConfirmDialog` from `components/ui/ConfirmDialog.tsx` instead of `window.confirm`/`alert`; `components/ui/LoadingIndicator.tsx` for pending states; `SuccessToast` for confirmations.
- Buttons, inputs, and segmented controls are pills (`rounded-full`). `components/ui/Switch.tsx` is the on/off toggle; use in-app pickers instead of native `<select>`.
- Settings: `SettingsGroup`, `SettingsRow`, and `SETTINGS_ACTION_ROW` in `components/settings/SettingsGroup.tsx`. Log out (this device, or all devices via `useLogout().logout("global")`) is in Settings → Account and the desktop sidebar only.
- `components/ui/BrandMark.tsx`: the WattWise owl as a single-colour mark (CSS mask over `/wattwise_mascot.png`), painted in the current text colour. Use it for the AI assistant and brand spots instead of a robot icon.

### Motion
- Easing tokens: `ease-out`, `ease-in-out`, `ease-drawer` (CSS vars `--ease-out`, `--ease-in-out`, `--ease-drawer`). The default transition timing is the strong ease-out.
- Utilities in `app/globals.css`: `ww-rise` (one-time brand entrance), `ww-enter` (title blocks, used as `lg:ww-enter`), `ww-stagger` (page bodies: each child rises in, 40ms apart), and `ww-splash-*` (splash screen). Each has a `prefers-reduced-motion` fallback to a plain fade, and the theme colour fade is turned off for reduced motion.
- Transition `translate`/`scale`/`opacity` by name (Tailwind 4 sets those properties, not `transform`). Use `starting:` for mount entrances.
- `ww-enter` and `ww-stagger` use `backwards` fill so no transform lingers to trap `fixed` children (modals inside cards).
- The theme colour fade lives in `@layer base` so `transition-*` utilities override it. Keep it there.
- Client navigations show a thin mint progress bar at the top (`components/ui/RouteTransitionIndicator.tsx`, in the root layout under `<Suspense>`).

### Landing page
`app/onboarding/page.tsx` is full width. The 3D unit lives in `components/landing/device/`: `WattWiseStage` loads `WattWiseCanvas` (three.js + React Three Fiber) client-side only, after load and browser idle, and falls back to the SVG `DevicePoster` when WebGL, JavaScript, or motion is unavailable, or when WebGL is software-only (no GPU; detected by renderer name). Keep the headline's entrance transform-only (`ww-lift`) so it counts as the largest paint. `components/landing/Reveal.tsx` reveals sections on scroll; `components/landing/SmoothScroll.tsx` enables Lenis wheel smoothing on this page only (skipped for reduced motion). Keep three.js and Lenis out of app routes.

---

## Architecture and Key Patterns

Short versions of the rules in `AGENTS.md`; read it before changing billing, telemetry, auth, or notifications.

### Meralco billing
- Never use a flat multiplier like `kWh * 10`. Compute cost with `computeMeralcoBill` / `computeVariableRatePerKwh` from `lib/meralco-bill.ts` using the active `meralco_rates` row, read through `lib/meralco-rates-server.ts`.
- The SQL twin `public.meralco_variable_rate_per_kwh` (budget trigger) must change together with `lib/meralco-bill.ts` and `tests/meralco-bill.test.ts`.
- No hardcoded fallback rates. Never round money per reading; round only for display.

### Auth and data access
- Pages and route handlers get the user from `getSessionUser()` (`lib/auth-context.ts`). The middleware verifies the token locally with `getClaims()` and makes one database call (`middleware_session_profile()`, migration `045`, which also rejects signed-out sessions and disabled accounts), then forwards identity in `x-wattwise-*` headers. Keep it to that one round trip: on Vercel it runs near the visitor (Singapore), not next to the database (Seoul). Do not call `supabase.auth.getUser()` in pages or handlers, and never set or read those headers elsewhere.
- Roles (`lib/roles.ts`): `user`, `tenant`, `manager`, `super_admin`. In the middleware, non-admins on `/admin` go to `/login?error=unauthorized` and non-managers on `/manager` go to their role's home (`getHomePathForRole`); `app/admin/layout.tsx` checks the role again.
- The root layout must not read cookies or headers (that would make every public page dynamic). `SupabaseProvider` reads the session in the browser.
- Never query `energy_logs` without a limit or bounded time range (about 17,000 rows per unit per day). Use the RPCs `get_latest_device_readings`, `get_usage_kwh_by_device[_day]`, `get_average_watts_by_device`.
- Start independent queries together (`startQuery` in `lib/start-query.ts`, `Promise.all`) and put secondary server components under `<Suspense>`.
- Keep RLS on large tables cheap (see migration `033`). `SUPABASE_SECRET_KEY` and `OPENAI_API_KEY` are server-only.

### Live telemetry and Smart Control
- A device is live when its latest reading or `devices.last_seen_at` is within `ACTIVE_READING_WINDOW_MS` (20 s, `lib/device-telemetry.ts`). Do not use `devices.is_online`. Stale readings render offline or idle.
- The dashboard patches W/V/A from `energy_logs` INSERTs and reacts to `devices` UPDATEs only when `relay_state` or `budget_status` changes. Never call `router.refresh()` per reading.
- Relay changes are commands the unit picks up on its next 5 s poll: confirm before turning a device off and word the result as "sent".

### OpenAI
- Server-side only. Insights go through `app/api/insights/route.ts` and reuse a recent cached `ai_insights` row before generating. Tone: casual, practical Taglish grounded in the user's real numbers (Bida recaps, Naku alerts).

### Reports
- Built once in `lib/reports.ts` (`buildEnergyReport`); `/reports` renders it and `/api/reports` serves the same rows as JSON, CSV, or PDF.

---

## Environment Variables

Stored in `.env.local` (not committed). Restart `npm run dev` after changing them.

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (server-only)
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` (server-only): admin console, tenant creation, account deletion, the cross-request rate cache
- `NEXT_PUBLIC_ONESIGNAL_APP_ID`: web push; push is skipped without it

Document any new variable when you add one.

---

## Common Pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| A colour looks wrong in light mode | Hard-coded `white`/hex instead of a token | Use `fg`, `accent`, `shade`, `surface`, ... |
| `text-base` stops setting 16px | A colour token named after a size keyword | Rename the token |
| A transition does nothing | Transitioning `transform` in Tailwind 4 | Name `translate`/`scale`/`opacity` |
| A modal inside an animated card is mispositioned | An animation left a transform behind | Use `backwards` fill, as `ww-enter`/`ww-stagger` do |
| Public pages became dynamic | Root layout read cookies or headers | Read the session in the browser via `SupabaseProvider` |
| Dashboard re-renders constantly | `router.refresh()` or state updates on every reading | Patch values; react only to `relay_state`/`budget_status` changes |
| Device shows online when it is not | Used `devices.is_online` | Use `isFreshReading` / `ACTIVE_READING_WINDOW_MS` |
| Slow or timed-out query | Unbounded `energy_logs` read | Use the bounded RPCs |
| Schema change missing in production | Deploys do not run migrations | `supabase db push --linked` |
| `npm test` fails to parse TypeScript | Node older than 22.6 | Upgrade Node |

---

## Agent Guidelines

1. Read the route, component, helper, and migration you are changing first. Reuse existing helpers (`lib/format.ts`, `lib/device-telemetry.ts`, `lib/openai.ts`, `lib/postgrest.ts`) instead of redefining them.
2. Keep the existing patterns for billing, telemetry, caching, and auth; do not add parallel ones.
3. Write components naturally; the React Compiler handles memoization, so skip defensive `useMemo`/`useCallback`.
4. Type all props; avoid `any`; import with `@/`.
5. Keep route `loading.tsx` screens when adding slow server pages.
6. No emojis in UI text or logs.
7. Run `npm run lint` and `npm run build` (and `npm test` for logic changes) before handing off substantial work.

## Documentation Sync

After meaningful implementation work, update `.github/instructions/`:

- `phases-and-roadmap-plan.instructions.md`: tick completed items and update the progress summary
- `ai-workflow.instructions.md`: new patterns or guardrails
- `supabase-schema-context.instructions.md`: table, column, index, RPC, or query-pattern changes
- `smart-control-architecture-blueprint.instructions.md`: telemetry, budget, relay, and Smart Control surfaces

Also keep `README.md`, `TESTING.md`, `NOTIFICATION_SETUP.md`, and `docs/` (for example `docs/light-mode-plan.md`) current when the work touches them.

Skip it for trivial edits (typos, spacing). Read each file before editing and change only what is needed. If a convention changes, update `AGENTS.md` and this file too.
