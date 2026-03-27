---
description: Supabase database schema reference for Wattwise platform. Required context when building features that interact with profiles, devices, energy data, Meralco rates, or AI insights. Apply when writing queries, API routes, or database migrations.
applyTo: "**"
---

# Wattwise Platform — Supabase Schema Context

## Complete Database Schema

This document defines the complete Supabase PostgreSQL schema for the Wattwise energy monitoring platform. All tables and their relationships are documented below.

### Schema Setup

```sql
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## Table Definitions

### 1. PROFILES (Extends Supabase Auth)

Stores extended user information beyond Supabase's built-in `auth.users` table.

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role VARCHAR(20) DEFAULT 'user', -- 'user' or 'super_admin'
  monthly_budget_php NUMERIC(10, 2) DEFAULT 2000.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Purpose:** User profiles linked to Supabase Authentication, with role-based access control and monthly energy budget.

---

### 2. MERALCO RATES (Global Pricing Engine for Admin to edit)

Stores unbundled Meralco billing rates that update monthly.

```sql
CREATE TABLE meralco_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  effective_month DATE NOT NULL UNIQUE, -- e.g., '2026-03-01'
  vat_rate NUMERIC(6, 4) NOT NULL,
  generation NUMERIC(10, 4) NOT NULL,
  transmission NUMERIC(10, 4) NOT NULL,
  system_loss NUMERIC(10, 4) NOT NULL,
  distribution NUMERIC(10, 4) NOT NULL,
  subsidies NUMERIC(10, 4) NOT NULL,
  government_taxes NUMERIC(10, 4) NOT NULL,
  universal_charges NUMERIC(10, 4) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Purpose:** Single source of truth for Meralco billing components and VAT. Super Admin edits this to update cost calculations across all users.

---

### 3. DEVICES (ESP32-S3 Fleet Management)

Tracks all IoT devices paired to user accounts.

```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL, -- e.g., 'Living Room Aircon'
  mac_address TEXT UNIQUE NOT NULL,
  is_online BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Purpose:** Represents each ESP32-S3 device pair-bonded to a user, tracking online status for the System Health monitor.

---

### 4. ENERGY LOGS (Optimized for Free Tier Throttling)

High-volume table storing aggregated telemetry from ESP32-S3 devices.

```sql
CREATE TABLE energy_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  energy_kwh NUMERIC(10, 4) NOT NULL,
  average_watts NUMERIC(10, 2), -- Helpful for live dashboard gauge
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index required for fast dashboard querying, charting, and data throttling
CREATE INDEX idx_energy_logs_device_time ON energy_logs(device_id, recorded_at DESC);
```

**Purpose:** Stores aggregated power consumption data. Index ensures fast time-range queries for charts and analytics without timeout or browser crash.

---

### 5. AI INSIGHTS (Trigger & Cache + Super Admin Cost Tracking)

Caches AI-generated insights to avoid redundant OpenAI API calls.

```sql
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL, -- 'budget_alert' or 'weekly_recap'
  message TEXT NOT NULL, -- The Taglish response
  prompt_tokens INTEGER NOT NULL, -- Tracked for Super Admin Dashboard
  completion_tokens INTEGER NOT NULL, -- Tracked for Super Admin Dashboard
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast cache-hit lookups to prevent unnecessary OpenAI API calls
CREATE INDEX idx_ai_insights_user_type_date ON ai_insights (user_id, insight_type, created_at DESC);
```

**Purpose:** Triggers OpenAI API only once per insight type per user per week. Stores token counts for Super Admin cost tracking.

---

## Key Design Principles

1. **Cascading Deletes:** All foreign keys use `ON DELETE CASCADE` to maintain referential integrity when users delete their profile or devices.

2. **UUID Primary Keys:** All tables use UUID for distributed system compatibility and security.

3. **Timestamps:** Every table includes `created_at` to track data lineage.

4. **Indexes for Performance:** Strategic indexes on `energy_logs` and `ai_insights` ensure queries remain fast even as data accumulates.

5. **Free Tier Optimization:** 
   - `energy_logs` data is aggregated before insertion (e.g., 1-minute or hourly averages) to stay within 500MB limit.
   - `ai_insights` caching prevents redundant API calls to OpenAI.

6. **Super Admin RLS Policies** *(migration at `supabase/migrations/002_admin_rls_policies.sql`)*:
  - Super admins (`profiles.role = 'super_admin'`) have SELECT access to all rows in: `profiles`, `devices`, `energy_logs`, `ai_insights`.
   - Super admins have INSERT and UPDATE access on `meralco_rates` for rate management.
   - Policy pattern uses `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')`.

---

## Common Query Patterns

### Fetch Today's Energy Data (with throttling)
```sql
SELECT * FROM energy_logs 
WHERE device_id = $1 
  AND recorded_at >= TODAY()
ORDER BY recorded_at DESC
LIMIT 100;
```

### Check for Cached AI Insight
```sql
SELECT message FROM ai_insights
WHERE user_id = $1 
  AND insight_type = 'budget_alert'
  AND created_at > CURRENT_DATE - INTERVAL '7 days'
LIMIT 1;
```

### Fetch Active Devices for User
```sql
SELECT * FROM devices
WHERE user_id = $1 AND is_online = true;
```

### Get Current Meralco Rates
```sql
SELECT * FROM meralco_rates
WHERE effective_month <= CURRENT_DATE
ORDER BY effective_month DESC
LIMIT 1;
```

### Upsert Monthly Meralco Rates (including VAT)
```sql
INSERT INTO meralco_rates (
  effective_month,
  vat_rate,
  generation,
  transmission,
  system_loss,
  distribution,
  subsidies,
  government_taxes,
  universal_charges
) VALUES (
  '2026-03-01',
  0.12,
  5.3727,
  0.8468,
  0.5012,
  1.4798,
  -0.0682,
  0.2563,
  0.1754
)
ON CONFLICT (effective_month) DO UPDATE
SET
  vat_rate = EXCLUDED.vat_rate,
  generation = EXCLUDED.generation,
  transmission = EXCLUDED.transmission,
  system_loss = EXCLUDED.system_loss,
  distribution = EXCLUDED.distribution,
  subsidies = EXCLUDED.subsidies,
  government_taxes = EXCLUDED.government_taxes,
  universal_charges = EXCLUDED.universal_charges;
```

### Fetch User Role for Admin Middleware
```sql
SELECT role FROM profiles
WHERE id = $1;
```

### Update Home Monthly Budget (Home Dashboard only)
```sql
UPDATE profiles
SET monthly_budget_php = $2
WHERE id = $1;
```

**Usage note:** `$1` must be the authenticated `auth.uid()` profile id. Budget edits should only be exposed in the Home Dashboard wallet editor UI.