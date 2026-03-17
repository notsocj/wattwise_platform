---
description: Wattwise platform coding constraints — Meralco billing precision, hardware safety handshake, data ingestion throttling, and OpenAI integration architecture. Apply when writing API routes, energy calculations, UI controls, Supabase queries, or AI insight features.
applyTo: "**"
---

# Wattwise Platform — AI Agent Workflow & Constraints

## 1. Meralco Billing Precision (The "No Flat Rate" Rule)

**Hard constraint:** Never calculate energy cost with a single flat rate multiplier (e.g., `totalKWh * 10`). This is incorrect and academically indefensible.

**Required pattern:** Always unbundle the Meralco billing components and apply VAT last:

```ts
// CORRECT — Unbundled Meralco rate structure
const RATES = {
  generation: 5.3727,       // PhP/kWh
  transmission: 0.8468,     // PhP/kWh
  systemLoss: 0.5012,       // PhP/kWh
  distribution: 1.4798,     // PhP/kWh
  subsidies: -0.0682,       // PhP/kWh (negative = credit)
  governmentTaxes: 0.2563,  // PhP/kWh
  universalCharges: 0.1754, // PhP/kWh
};
const VAT_RATE = 0.12;

function computeMeralcoBill(kWh: number): number {
  const subtotal = Object.values(RATES).reduce((sum, r) => sum + r, 0) * kWh;
  return subtotal * (1 + VAT_RATE); // VAT applied at the final step only
}

// WRONG — never do this
// const cost = kWh * 10;
```

- Store rate constants in a single module (e.g., `lib/meralco-rates.ts`) so they can be promoted to a Supabase Edge Function without restructuring.
- All cost values displayed in the UI must be derived from this calculation, never hardcoded.

---

## 2. Hardware Safety Handshake (The "Safety First" Rule)

**Hard constraint:** Remote relay Off commands from the Web UI must be treated as high-priority operations. Never block the UI waiting for hardware acknowledgement before showing feedback.

**Required pattern — Optimistic UI with MQTT confirmation:**

```ts
// 1. Immediately update local UI state (optimistic)
setRelayState('off');

// 2. Record the pending command in Supabase
await supabase.from('relay_commands').insert({
  device_id: deviceId,
  command: 'OFF',
  status: 'pending',
  sent_at: new Date().toISOString(),
});

// 3. Publish MQTT command (fire-and-forget from client or via API route)
await publishRelayCommand(deviceId, 'OFF');

// 4. Listen for ESP32-S3 acknowledgement (MQTT callback / Supabase realtime)
//    On ACK → update relay_commands row to status: 'confirmed'
//    On timeout (>5s) → show warning toast, revert optimistic state
```

- The UI button must reflect `off` immediately. Do not leave it in a loading spinner indefinitely.
- If no MQTT ACK arrives within 5 seconds, revert the optimistic state and surface a warning to the user.
- Always log the command to Supabase (`relay_commands` table) for audit purposes.

---

## 3. Data Ingestion Throttling (Free Tier Guardrail)

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
- Cache fetched data using SWR or TanStack Query to avoid re-fetching on re-renders.

---

## 4. OpenAI Integration Architecture (Trigger & Cache)

These rules apply when implementing any AI-powered insight feature (e.g., Budget Alerts, Weekly Recaps).

### 4a. Persona & Tone

The OpenAI system prompt **must** define the assistant as:
- **Role:** Friendly Filipino financial and energy advisor.
- **Language:** Casual conversational Taglish (Tagalog-English mix).
- **Tone:** Encouraging, practical, and hyper-specific to the user's data.
- **Data binding:** Always reference exact PHP amounts, appliance names, and timeframes. Never give generic advice.

Example phrasing to steer toward:
> *"Naku boss, Day 15 pa lang pero nasa PHP 1,500 na tayo sa PHP 2,000 budget mo. Medyo dahan-dahan tayo sa washing machine this week para di tayo ma-over budget."*

### 4b. The Two Supported Insight Types

| `insight_type` | Purpose | Required input data |
|---|---|---|
| `budget_alert` | Warns if spend trajectory will exceed monthly budget | `currentSpend`, `monthlyBudget`, `daysElapsed` |
| `weekly_recap` | Positive reinforcement comparing week-over-week consumption | `thisWeekKWh`, `lastWeekKWh`, `thisWeekPHP`, `lastWeekPHP` |

### 4c. Trigger & Cache — Mandatory Flow

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

### 4d. Required Supabase Schema

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

### 4e. OpenAI API Key Security

- Store the key in `.env.local` as `OPENAI_API_KEY` (no `NEXT_PUBLIC_` prefix — server-only).
- The API call must only ever occur inside a Next.js API Route or Server Action; never in a client component or directly in a page file.

---

## Quick Reference — What NOT to Do

| Situation | Forbidden | Required instead |
|---|---|---|
| Computing energy cost | `kWh * 10` | Unbundled rates + 12% VAT |
| Turning off a relay | Wait for MQTT ACK before updating UI | Optimistic UI update first, then confirm |
| Fetching energy data | `.from('energy_logs').select('*')` | Add `.limit(100)` or date filter |
| Generating AI insights | Call OpenAI from client on page load | Check `ai_insights` cache first via API route |
| OpenAI API key | `NEXT_PUBLIC_OPENAI_API_KEY` | `OPENAI_API_KEY` (server-only) |