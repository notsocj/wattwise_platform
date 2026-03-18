# Wattwise Platform

Initial project scaffold for the Wattwise energy management platform, built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, and Supabase.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000` to view the app.

## Folder Structure

```text
app/
  api/health/route.ts      API health check starter endpoint
  dashboard/page.tsx       Starter dashboard route
  globals.css              Global theme and utility styles
  layout.tsx               Root layout and provider boundary
  page.tsx                 Homepage entry
components/
  dashboard/               Dashboard-specific UI blocks
  home/                    Homepage composition
  layout/                  Shared shell elements
  providers/               Global client providers
lib/
  config/                  Site-level metadata
  constants/               Typed constants and navigation
  data/                    Temporary seeded data
  meralco-rates.ts         Billing computation helper
types/
  energy.ts                Shared energy domain types
  navigation.ts            Shared navigation types
```

## Available Scripts

- `npm run dev` starts the local development server.
- `npm run lint` runs the ESLint checks.
- `npm run build` creates a production build.
- `npm run start` serves the production build.

## Environment

Copy values into `.env.local` as needed:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
