# Wattwise Platform — AI Agent Instructions

## Project Overview

**Wattwise** is a modern SaaS platform for energy management and monitoring. The platform is built with a Next.js 16 frontend using React 19 and TypeScript 5, with a Supabase backend for data persistence and authentication.

**Repository:** `wattwise_platform`  
**Status:** Active development  
**Deployment:** Vercel-ready  

---

## Platform Features & Architecture Overview

### Part 1: Core Web App Features (The User PWA)

#### 1. Unbundled Meralco Billing Engine
- **Description:** Translates raw kWh into exact Philippine Pesos using unbundled Meralco formulas (Generation, Transmission, System Loss) plus the 12% VAT.
- **User Value:** Users see exactly how much their appliance is costing them right now, eliminating "bill shock" at the end of the month.

#### 2. Taglish AI "Tipid" Advisor (OpenAI Powered)
- **Description:** Analyzes aggregated daily usage and delivers hyper-personalized, casual Taglish insights (e.g., Budget "Naku!" Alerts and Weekly "Bida" Recaps).
- **User Value:** Transforms raw data into actionable financial advice that feels like a text message from a friend, increasing user engagement.

#### 3. Live Power Gauge & Analytics Dashboard
- **Description:** Displays real-time telemetry (Watts, Volts, Amps) pulled via Supabase Realtime, alongside historical bar charts for daily and weekly consumption.
- **User Value:** Gives users a visual understanding of their appliance's power draw and historical usage trends.

#### 4. Remote 30A "Kill Switch" (Optimistic UI)
- **Description:** A secure, high-priority toggle on the dashboard that sends an MQTT command to the ESP32-S3 to physically cut power to the plugged-in appliance.
- **User Value:** Allows users to turn off forgotten appliances remotely (e.g., an iron or aircon) from anywhere with an internet connection.

#### 5. Mobile-First Progressive Web App (PWA)
- **Description:** Powered by Serwist, the web app can be installed directly to a user's phone home screen (iOS/Android) without going through the App Store, featuring caching for fast load times even on slow networks.
- **User Value:** Feels exactly like a native mobile app without the overhead of app store deployment.

### Part 2: System-Wide & Hardware Features (The IoT Architecture)

#### 1. Over-Current "Safety Trip" Protection
- **Description:** The hardware autonomously monitors current spikes. If an appliance draws dangerous levels of current, the ESP32-S3 cuts the 30A relay instantly, bypassing the web app entirely, and logs the event to the cloud.
- **System Value:** Prevents electrical fires and protects the hardware, satisfying strict engineering safety standards for the thesis.

#### 2. Aggregated Data Throttling
- **Description:** Instead of hammering the database every second, the system averages telemetry data (e.g., every 1 minute or 1 hour) before inserting it into Supabase.
- **System Value:** Ensures the platform remains fully operational and highly scalable within the 500MB Supabase Free Tier limit.

### Part 3: Super Admin "Mission Control" (Owner Dashboard)

#### 1. Meralco Rate Editor (Global System Variable)
- **Function:** A single form to update the unbundled Meralco rates (Generation, Transmission, System Loss, etc.).
- **Mechanism:** Updates the active row in the `meralco_rates` table. This acts as the single source of truth for all users' cost calculations across the platform.

#### 2. Revenue & Growth (Sales & Adoption)
- **Function:** Tracks total registered users, active devices, and hypothetical MRR (Monthly Recurring Revenue).
- **Mechanism:** Counts rows in the `profiles` and `devices` tables grouped by account creation date to generate a 30-day growth chart.

#### 3. OpenAI Usage & Cost Tracker
- **Function:** Monitors the exact token usage and estimated USD cost of your Taglish AI advisor.
- **Mechanism:** Every time an insight is generated, the backend saves the `prompt_tokens` and `completion_tokens` into the `ai_insights` table. The dashboard aggregates these to calculate real-time API costs.

#### 4. Database & System Health (Free Tier Monitor)
- **Function:** Tracks the volume of telemetry data being ingested to ensure you do not hit the Supabase 500MB limit.
- **Mechanism:** Monitors the total row count in the `energy_logs` table and tracks how many ESP32-S3 devices are currently "Online" based on their last ping.

#### 5. Global Energy Analytics (The "Big Picture")
- **Function:** Calculates the total kWh monitored by the entire WattWise platform and the total estimated Pesos saved by all users.
- **Mechanism:** Runs an aggregated sum of all `energy_logs` across the entire database to prove the macro-level impact of your thesis.

---

## Technology Stack

### Frontend
- **Next.js 16.1.7** — App Router (file-based routing in `app/` directory)
- **React 19.2.3** — UI library with React Compiler enabled for optimization
- **TypeScript 5** — Strict mode enabled; project uses path aliases (`@/*` → project root)
- **Tailwind CSS 4** — Utility-first styling with `@tailwindcss/postcss`
- **Lucide React** — Icon library for UI components
- **Recharts 3.8.0** — Charts and data visualization library

### Backend & Services
- **Supabase** — PostgreSQL database, authentication, and real-time API (`@supabase/supabase-js`)
- **Environment Variables** — Configured in `.env.local` (contains Supabase credentials, API keys)

### DevOps & PWA
- **Serwist 9.5.7** — Service Worker integration for offline-first PWA features
- **ESLint 9** — Linting with Next.js web vitals and TypeScript config
- **PostCSS 4** — CSS preprocessing for Tailwind

---

## Essential Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start local dev server (http://localhost:3000) with hot reload |
| `npm run build` | Production build; validates TypeScript and runs ESLint |
| `npm run start` | Run production build locally |
| `npm run lint` | Run ESLint checks; fix issues with `npm run lint -- --fix` |

---

## Design System (Neo-Utility — 2026)

### Typography
All UI uses **Space Grotesk** for its technical, modern personality and stable number rendering.

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Heading 1 | 32px | Bold | Household overview values |
| Heading 2 | 24px | Semi-Bold | Section headers |
| Body Text | 16px | Regular | Device names, descriptions |
| Technical/Mono | 14px | Medium | Voltage readings, amperage thresholds |

### Color Palette (High-Contrast Dark Mode)

#### Core Foundation
| Token | Hex | Purpose |
|-------|-----|---------|
| Background Base | `#121212` | True dark — reduces eye strain, optimizes OLED battery |
| Surface / Cards | `#1E1E1E` | Soft charcoal — subtle depth for interactive elements |

#### Action & Status Colors
| Token | Hex | Purpose |
|-------|-----|---------|
| Primary Action (Neon Mint) | `#00E66F` | Active states, primary buttons, electricity logo glow |
| Bida (Success Green) | `#10B981` | Savings celebrations, "Under Budget" states |
| Naku! (Warning Amber) | `#F59E0B` | Usage spikes, approaching budget limits |
| Danger (High-Alert Red) | `#EF4444` | Safety cutoffs, over-current trips, "Global Off" controls |

### Visual Effects
- **Glow:** `box-shadow` with 20–40px blur using `#00E66F` at 40–60% opacity — applied to the electricity logo and active Neon Mint elements.
- **Glassmorphism:** Device Detail sub-cards use a slightly transparent surface (`bg-white/5` + `backdrop-blur`) to create a "Liquid Glass" layered effect.
- **Roundness:** `border-radius: 8px` (Round Eight) — standard for all buttons and container cards.

### Implementation Notes for AI Agent
- Load **Space Grotesk** via `next/font/google` in `app/layout.tsx` and apply it to `<html>` as the default sans font via Tailwind's `fontFamily` config.
- Define all palette tokens as Tailwind CSS custom colors in `tailwind.config.ts` (e.g., `mint: '#00E66F'`, `surface: '#1E1E1E'`) so they are available as utility classes across the codebase.
- Never hard-code hex values in component JSX — always use the Tailwind token (e.g., `bg-surface`, `text-mint`, `shadow-mint-glow`).
- The `#EF4444` Danger color must **only** appear on destructive or safety-critical actions. Do not use it for decorative purposes.

---

## Screen Specifications (2026 Fleet-Scale Edition)

### 1. Onboarding Flow (The Entry)

#### Splash Screen
- **Core Branding:** Centralized WattWise electricity bolt logo with the signature circular green glow on a true dark background.
- **Visuals:** Minimalist and high-impact to establish the energy-saving aesthetic immediately.
- **Function:** Initial load and brand establishment.

#### Welcome Screen
- **Value Proposition:** "Smart Energy. Real Savings."
- **Branding:** Unified logo and glow matching the Splash screen for visual continuity.
- **Actions:** Dual high-contrast buttons — *Login* (Solid Neon Mint fill) and *Register* (Outlined variant).
- **Footnote:** "Optimized for sustainable living."

#### Login Screen
- **Branding:** Consistent glow-logo at the top.
- **Inputs:** Email and Password fields with internal iconography and "Forgot Password?" link.
- **Action:** Primary tactile "Login" button with the signature neon mint glow.
- **Navigation:** "Register" link for new users.

#### Registration Screen
- **Branding:** Consistent glow-logo at the top.
- **Inputs:**
  - *Home Name:* (e.g., "Santos Residence") to personalize the multi-device hub.
  - *Email Address:* Primary account identifier.
  - *Password:* Secure entry with visibility toggle.
- **Action:** Primary "Sign Up" button.
- **Navigation:** "Log In" link for existing users.

---

### 2. Multi-Device Command Center

#### Home Dashboard (The Fleet View)
- **Unified Branding:** "WattWise" header with the electricity icon.
- **Household Pulse:**
  - *Total Live Wattage:* Real-time aggregate power draw across all devices.
  - *Total Daily Cost (₱):* Live financial conversion using Meralco unbundled rates.
- **Device Grid:**
  - *Active Device Cards:* Solid surface cards for units like "Aircon" or "Fridge."
  - *Live Metrology:* Shows individual wattage per card.
  - *30A Relay Toggle:* Neon Mint switch for immediate remote power control.
- **Expansion:** "Add Appliance" tile (dashed border) with a large "+" icon.
- **Safety Layer:** "Slide to Power Off All" emergency disconnect button at the bottom.
- **Mascot Tip:** Sticky AI tip banner (e.g., "Overall usage is 10% lower today. Bida!").

#### Device Detail (The Hardware Inspector)
- **Focus Mode:** No bottom navigation to keep the user focused on the specific hardware unit.
- **Metrology Gauges:** Three "Liquid Glass" circular progress rings for Power (W), Voltage (V), and Current (A).
- **Device Wallet:**
  - *Monthly Budget:* Interactive slider to set a PHP limit.
  - *Burn Rate:* Progress bar visualizing consumption against the budget.
- **Hardware Controls:**
  - *Massive Relay Toggle:* Large, central tactile button for physical power switching.
  - *Auto-Trip Slider:* Safety configuration for over-current thresholds.
- **Diagnostics:** Wi-Fi RSSI and Board Temp readings at the bottom.

---

### 3. The Strategy Center

#### Insights Dashboard (The Analytics Hub)
- **Device Performance Leaderboard:** Ranked list from "Expensive" to "Efficient."
- **Coaching Feed (Bento Layout):**
  - *Naku! Alert (Orange/Red):* High-priority cards for spikes (e.g., "Critical Spike!").
  - *Bida Recap (Green):* Positive reinforcement for staying under budget.
  - *Strategy Tip:* Actionable advice (e.g., "Shift laundry to off-peak hours").
- **Trend Comparison:** Interactive weekly bar charts comparing "This Wk" vs. "Last Wk."
- **Financial Forecast:** Bold readout showing predicted bill and projected savings percentage.

---

### 4. Navigation Architecture
- **Standardized 2-Tab Navbar:** Persistent navigation on Home and Insights screens:
  - *Home Tab:* Fleet View & Device Grid.
  - *Insights Tab:* Analytics, Mascot Feed, and Leaderboards.
- **Visual State:** Active tab is highlighted with a green glow indicator.

---

### App Directory (Next.js App Router)
- **`app/layout.tsx`** — Root layout; wraps all pages with global providers (Supabase client, theme, etc.)
- **`app/page.tsx`** — Homepage (`/` route); start editing here for UI changes
- **`app/globals.css`** — Global styles (imported in layout); Tailwind directives go here
- **New pages/routes:** Create folders/files in `app/` following Next.js conventions:
  - `app/dashboard/page.tsx` → `/dashboard` route
  - `app/api/route.ts` → `/api` endpoint
  - `app/(auth)/login/page.tsx` → `/login` route with optional layout grouping

### Code Organization
- **Components:** Place reusable React components in a `components/` directory (create if needed)
- **Utilities:** Helper functions, constants, and services in `lib/` or `utils/` directories
- **API Routes:** Backend logic in `app/api/route.ts` files (Next.js server functions)
- **Styling:** Use Tailwind CSS classes directly in JSX; avoid inline styles unless necessary

### Naming Conventions
- **Page components:** `PascalCase` (e.g., `Dashboard.tsx`)
- **Utility files:** `camelCase` (e.g., `authService.ts`, `formatDate.ts`)
- **Component files:** `PascalCase` (e.g., `Button.tsx`, `DataTable.tsx`)
- **CSS files:** `kebab-case` if custom; prefer Tailwind classes in JSX

---

## Architecture & Key Patterns

### React Compiler Mode
- **Enabled in `next.config.ts`** — Automatically optimizes component re-renders
- **Benefit:** Reduces need for manual `useMemo`/`useCallback` optimization
- **Best Practice:** Write components naturally; the compiler handles memoization

### Supabase Integration
- Client initializes in `layout.tsx` or a dedicated auth provider
- Use Supabase client for:
  - Real-time subscriptions (`on('*')` listeners)
  - Query data with `.from('table').select()` syntax
  - Handle authentication via `auth.signInWithPassword()`, etc.
- **Security:** Never expose `SUPABASE_SECRET_KEY` in client code; server-only use in API routes

### Data Visualization
- Use **Recharts** for charts; components are lightweight and responsive
- Common patterns: `LineChart`, `BarChart`, `PieChart` with responsive container

### PWA & Service Workers (via Serwist)
- Configured in `next.config.ts`; provides offline caching and background sync
- Impact on development: Service Workers cache assets aggressively; hard-refresh in dev if needed

### Resource Optimization (Supabase Free Tier)
- **Database Throttling:** Prioritize logic that aggregates hardware data. Avoid frequent, high-volume inserts; prefer batched updates or averaged data points (e.g., 1-minute intervals).
- **Query Efficiency:** Always include `limit()` on fetch requests to prevent over-fetching.
- **Edge Function Usage:** Use Edge Functions for heavy Meralco calculations to keep the database size lean (storing only final results, not raw calculation steps).

---

## Development Practices

### TypeScript Standards
- **Strict Mode:** All files must pass TypeScript strict checks
- **Type Safety:** Avoid `any` types; use proper interfaces/generics
- **Imports:** Use path aliases (`import { ... } from '@/components/...'`)

### Linting & Code Quality
- Run **ESLint** before committing: `npm run lint`
- Fix auto-fixable issues: `npm run lint -- --fix`
- Linter checks: Next.js web vitals, TypeScript safety, best practices

### Git Workflow
- Feature branches: `feature/feature-name`
- Development branch: `dev` (main integration branch)
- Production branch: `main` (stable releases)
- Commit messages: Descriptive, present tense (e.g., "Add user authentication flow")

### Environment Variables
- Store in `.env.local` (not committed to git)
- Required variables:
  - `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Public API key
  - Additional keys as project grows (API endpoints, feature flags, etc.)
- **Note:** `NEXT_PUBLIC_*` prefix makes variables available to browser; other vars server-only

---

## Common Pitfalls & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Page doesn't update after env var change | `.env.local` requires dev server restart | Stop `npm run dev`, then restart |
| Service Worker caching old assets | Serwist aggressive caching in production | Hard-refresh (Cmd+Shift+R) to clear cache |
| TypeScript build fails unexpectedly | Strict mode catches unused/untyped code | Run `npm run build` locally before push |
| Form state not reactive | Missing `useState` or dependency array | Use proper React hooks; check dependency arrays |
| Supabase queries fail silently | Missing error handling or auth token expired | Add `.catch()` handlers; check console logs |
| Slow initial page load | Over-fetching data or missing route caching | Use Next.js `revalidate` for static generation (`next/cache`) |

---

## Debugging & Troubleshooting

### Dev Server Issues
- **Clear cache:** `rm -rf .next && npm run dev`
- **Hot reload not working:** Ensure file is in watched directory (`app/`, `components/`, etc.)
- **Port conflict (3000 in use):** Change port with `npm run dev -- -p 3001`

### TypeScript Errors at Build
- Run `npm run build` to catch all issues before push
- Check for implicit `any` types or missing type definitions

### Supabase Connection Issues
- Verify `.env.local` has correct `SUPABASE_URL` and `ANON_KEY`
- Check Supabase dashboard for active sessions and rate limits
- Use browser DevTools Network tab to debug API calls

---

## AI Agent Guidelines

When working on this codebase:

1. **Start with `npm run dev`** to see live changes
2. **Always run `npm run lint`** and **`npm run build`** before marking work complete
3. **Prefer component-driven development:** Extract reusable components early
4. **Use Tailwind CSS utilities** exclusively; avoid custom CSS unless necessary
5. **Type all React props** with TypeScript; use generics for reusable patterns
6. **Handle async/await properly:** Wrap Supabase calls in error boundaries or try-catch
7. **Respect the React Compiler:** Avoid patterns that defeat static analysis (e.g., inline function definitions in props where possible)
8. **Document complex logic:** Add comments for non-obvious Supabase queries or algorithms
9. **Keep env vars organized:** Document all required env vars in a `.env.example` file as project grows
10. **Optimize for Free Tier:** Every database interaction must be "lean." Avoid creating large audit logs or redundant history rows that consume the 500MB storage limit.
11. **Aggressive Caching:** Use SWR or TanStack Query patterns to cache energy data in the browser, reducing the number of direct API calls to Supabase.
12. **Meralco Logic Location:** Ensure all Philippine-specific billing logic (VAT, System Loss, etc.) is modularized so it can be easily moved to a Supabase Edge Function to maintain a single source of truth.
13. **Professional Aesthetic (No Unnecessary Emojis):** Do not use emojis in console logs, terminal output, or UI elements (buttons, labels, headers) unless specifically requested for a "Status Icon" (e.g., a green circle for 'Live'). Keep the interface and logs professional and text-based.
14. **Environment Parity:** If suggesting a port change for development (to avoid conflicts with `wattwise_web`), default to `3001` for the platform while keeping `3000` for the hardware local bridge if necessary.

---

## Useful Resources

- [Next.js 16 Docs](https://nextjs.org/docs)
- [React 19 Docs](https://react.dev)
- [Tailwind CSS 4 Docs](https://tailwindcss.com)
- [Supabase Docs](https://supabase.io/docs)
- [Recharts Docs](https://recharts.org)
- [Lucide Icons](https://lucide.dev)

---

**Last Updated:** March 18, 2026  
**Maintained By:** Wattwise Dev Team
