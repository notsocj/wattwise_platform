---
description: Wattwise platform coding constraints — Meralco billing precision, hardware safety handshake, data ingestion throttling, and OpenAI integration architecture. Apply when writing API routes, energy calculations, UI controls, Supabase queries, or AI insight features.
applyTo: "**"
---

# Wattwise Platform — AI Agent Workflow & Constraints

## 1. Meralco Billing Precision (The "No Flat Rate" Rule)

**Hard constraint:** Never calculate energy cost with a single flat rate multiplier (e.g., `totalKWh * 10`). This is incorrect and academically indefensible.

**Required pattern:** Always unbundle the Meralco billing components, add fixed monthly charges, then apply VAT last:

```ts
// CORRECT — DB-driven unbundled Meralco rate structure
const activeRate = await getActiveMeralcoRates(supabase); // includes vat_rate + fixed monthly charges

function computeMeralcoBill(
  kWh: number,
  rates: MeralcoRateComponents,
  vatRate: number,
  fixedChargesPhp: number
): number {
  const subtotalPerKWh =
    rates.generation +
    rates.transmission +
    rates.systemLoss +
    rates.distribution +
    rates.universalCharges +
    rates.fitAll;

  const variableSubtotal = subtotalPerKWh * kWh;
  const preVatTotal = variableSubtotal + fixedChargesPhp;

  return preVatTotal * (1 + vatRate); // VAT applied at the final step only
}

// WRONG — never do this
// const cost = kWh * 10;
```

- In app/runtime code, fetch the active row from `meralco_rates` (`effective_month <= current_date`, ordered descending, `limit 1`) and map DB fields (`vat_rate`, `system_loss`, `universal_charges`, `fit_all`, `metering_charge`, `supply_charge`) to the billing component object before calling `computeMeralcoBill`.
- When `energy_logs.energy_kwh` stores cumulative meter readings, never sum all rows directly for a billing period. Compute usage from **sequential deltas** (`current - previous`) per device after minute-bucket dedupe; treat tiny negative drift as jitter (`0`) and only treat large drops as meter reset. Prefer DB RPC aggregation over client-side row scans for monthly/weekly totals.
- The application must be DB-only: do not use in-code default rate constants, including VAT.
- If the table query returns no rows or the query fails, surface a clear, actionable admin-visible error or warning (server-side) instructing the admin to add a `meralco_rates` entry. Do not silently fall back to hardcoded constants.
- All cost values displayed in the UI must be derived from this calculation, never hardcoded.

---

## 2. Data Ingestion Throttling (Free Tier Guardrail)

**Hard constraint:** Never query the `energy_logs` table (or any high-volume table) without a hard row limit or a time-range filter. Fetching unbounded rows will crash the browser and time out the Supabase API.

**Required pattern — always scope queries:**

```ts
// CORRECT — time-range filter with a limit guard
const { data } = await supabase
  .from('energy_logs')
  .select('*')
  .gte('created_at', startOfDay.toISOString())
  .lte('created_at', endOfDay.toISOString())
  .order('created_at', { ascending: false })
  .limit(100);

// CORRECT — aggregated query using date_trunc (prefer this for charts)
const { data } = await supabase.rpc('get_hourly_averages', {
  p_user_id: userId,
  p_date: targetDate,
});

// WRONG — never do this
// const { data } = await supabase.from('energy_logs').select('*');
```

- Default to `.limit(100)` when the exact row count is unknown.
- For chart data, prefer server-side aggregation via Supabase RPC functions over client-side array processing.
- For billing-grade totals, use RPCs that aggregate by minute and sum cumulative deltas (`get_usage_kwh_by_device`, `get_usage_kwh_by_device_day`) instead of raw row loops.
- Cache fetched data using SWR or TanStack Query to avoid re-fetching on re-renders.
- When correlating `energy_logs.device_id` to devices, normalize and support both key formats (`devices.id` and legacy `devices.mac_address`) to avoid zeroed dashboard totals during schema transition.
- For "active appliance" status in UI cards, never rely on the latest row alone. Use `recorded_at` freshness (for example, last 5 minutes) before showing live/active wattage; stale readings must render as offline or idle to avoid false-active states when a unit is unplugged.
- For Device Detail metrology gauges, query only the latest row with scoped filters and read `average_watts`, `voltage_v`, and `current_a`; if `voltage_v`/`current_a` are null on legacy rows, fall back safely without removing the freshness gate.
- For Home Dashboard device cards, derive online/offline from telemetry freshness and expose live `average_watts`, `voltage_v`, and `current_a` (with safe voltage/current fallback for legacy rows) so W/V/A stays coherent with live status.
- For server-rendered dashboard/device pages that must feel live, use a small client-side Supabase Realtime listener (filtered by owned `device_id` keys) to trigger a throttled `router.refresh()`; pair it with a lightweight periodic refresh fallback so freshness-based online/offline state can still transition to offline when telemetry stops. This preserves RPC-based accuracy for billing while removing manual refresh requirements.

---

## 3. OpenAI Integration Architecture (Trigger & Cache)

These rules apply when implementing any AI-powered insight feature (e.g., Budget Alerts, Weekly Recaps).

### 3a. Persona & Tone

The OpenAI system prompt **must** define the assistant as:
- **Role:** Friendly Filipino financial and energy advisor.
- **Language:** Casual conversational Taglish (Tagalog-English mix).
- **Tone:** Encouraging, practical, and hyper-specific to the user's data.
- **Data binding:** Always reference exact PHP amounts, appliance names, and timeframes. Never give generic advice.

Example phrasing to steer toward:
> *"Naku boss, Day 15 pa lang pero nasa PHP 1,500 na tayo sa PHP 2,000 budget mo. Medyo dahan-dahan tayo sa washing machine this week para di tayo ma-over budget."*

### 3b. The Two Supported Insight Types

| `insight_type` | Purpose | Required input data |
|---|---|---|
| `budget_alert` | Warns if spend trajectory will exceed monthly budget | `currentSpend`, `monthlyBudget`, `daysElapsed` |
| `weekly_recap` | Positive reinforcement comparing week-over-week consumption | `thisWeekKWh`, `lastWeekKWh`, `thisWeekPHP`, `lastWeekPHP` |

### 3c. Trigger & Cache — Mandatory Flow

**Never call `openai.chat.completions.create` on page load or from a client component.**

The required server-side flow for every insight request:

```
Client requests insight
        │
        ▼
Next.js API Route (app/api/insights/route.ts)
        │
        ├─► Query ai_insights WHERE user_id = ? AND insight_type = ? AND created_at > week_start
        │
        ├─[Row found]──► Return cached message string → Done
        │
        └─[No row]
              │
              ▼
        Aggregate data from energy_logs (with .limit() guard)
              │
              ▼
        Call openai.chat.completions.create (server-side only)
              │
              ▼
        INSERT result into ai_insights table
              │
              ▼
        Return the new message string → Done
```

### 3d. Required Supabase Schema

```sql
CREATE TABLE ai_insights (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  insight_type  VARCHAR(50) NOT NULL, -- 'budget_alert' or 'weekly_recap'
  message       TEXT NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast cache-hit lookups
CREATE INDEX idx_ai_insights_user_type_date
  ON ai_insights (user_id, insight_type, created_at DESC);
```

### 3e. OpenAI API Key Security

- Store the key in `.env.local` as `OPENAI_API_KEY` (no `NEXT_PUBLIC_` prefix — server-only).
- The API call must only ever occur inside a Next.js API Route or Server Action; never in a client component or directly in a page file.

---

## 4. Home Budget Edit Scope (Single Control Point)

**Hard constraint:** `profiles.monthly_budget_php` must be editable only from the Home Dashboard wallet UI.

- Device Detail pages may display budget and burn-rate context, but must remain view-only.
- Use an icon-triggered editor card/popover in Home Wallet instead of a persistent budget form block.
- Save flow should update only the authenticated profile row (`WHERE id = auth user id`) and refresh the dashboard state after success.

---

## Quick Reference — What NOT to Do

| Situation | Forbidden | Required instead |
|---|---|---|
| Computing energy cost | `kWh * 10` | Unbundled rates + 12% VAT |
| Fetching energy data | `.from('energy_logs').select('*')` | Add `.limit(100)` or date filter |
| Generating AI insights | Call OpenAI from client on page load | Check `ai_insights` cache first via API route |
| OpenAI API key | `NEXT_PUBLIC_OPENAI_API_KEY` | `OPENAI_API_KEY` (server-only) |
| Editing home budget | Budget input duplicated across pages | Home-only icon-triggered editor card that updates `profiles.monthly_budget_php` |