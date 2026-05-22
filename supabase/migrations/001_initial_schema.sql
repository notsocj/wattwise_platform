-- ============================================================
-- 001_initial_schema.sql
-- Creates the five core tables, required indexes, and the
-- trigger that auto-provisions a profiles row on sign-up.
-- Idempotent: all CREATE statements use IF NOT EXISTS.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. PROFILES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                  UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email               TEXT UNIQUE NOT NULL,
  full_name           TEXT,
  role                VARCHAR(20) DEFAULT 'user', -- 'user' | 'super_admin'
  monthly_budget_php  NUMERIC(10, 2) DEFAULT 2000.00,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 2. MERALCO RATES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meralco_rates (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  effective_month     DATE NOT NULL UNIQUE,   -- e.g. '2026-03-01'
  vat_rate            NUMERIC(6, 4) NOT NULL,
  generation          NUMERIC(10, 4) NOT NULL,
  transmission        NUMERIC(10, 4) NOT NULL,
  system_loss         NUMERIC(10, 4) NOT NULL,
  distribution        NUMERIC(10, 4) NOT NULL,
  universal_charges   NUMERIC(10, 4) NOT NULL,
  fit_all             NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
  metering_charge     NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
  supply_charge       NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 3. DEVICES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  device_name     TEXT NOT NULL,
  mac_address     TEXT UNIQUE NOT NULL,   -- always stored uppercase with colons
  is_online       BOOLEAN DEFAULT false,
  last_seen_at    TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 4. ENERGY LOGS ──────────────────────────────────────────
-- device_id is TEXT (not FK) to accept both UUID text and MAC address
-- during the transitional key migration period.
CREATE TABLE IF NOT EXISTS energy_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id     TEXT NOT NULL,
  energy_kwh    NUMERIC(10, 4) NOT NULL,
  average_watts NUMERIC(10, 2),
  voltage_v     NUMERIC(10, 2),
  current_a     NUMERIC(10, 2),
  recorded_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Composite index — critical for fast time-range queries and Realtime filters
CREATE INDEX IF NOT EXISTS idx_energy_logs_device_time
  ON energy_logs(device_id, recorded_at DESC);

-- ── 5. AI INSIGHTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_insights (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
  insight_type     VARCHAR(50) NOT NULL, -- see InsightType enum in lib/constants.ts
  message          TEXT NOT NULL,
  prompt_tokens    INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast cache-hit lookups (Trigger & Cache pattern)
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_type_date
  ON ai_insights(user_id, insight_type, created_at DESC);

-- ── TRIGGER: auto-create profiles row on auth.users INSERT ──
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger first to allow re-running this migration safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Enable Row Level Security on all tables ──────────────────
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE meralco_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
