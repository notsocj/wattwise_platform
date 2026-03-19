-- ============================================================
-- WattWise Platform — Initial Schema Migration
-- Run this in the Supabase SQL Editor to bootstrap the database
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES (Extends Supabase Auth)
-- ============================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role VARCHAR(20) DEFAULT 'user', -- 'user' or 'super_admin'
  monthly_budget_php NUMERIC(10, 2) DEFAULT 2000.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auto-create profile row on new user sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. MERALCO RATES (Global Pricing Engine)
-- ============================================================
CREATE TABLE meralco_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  effective_month DATE NOT NULL UNIQUE,
  generation NUMERIC(10, 4) NOT NULL,
  transmission NUMERIC(10, 4) NOT NULL,
  system_loss NUMERIC(10, 4) NOT NULL,
  distribution NUMERIC(10, 4) NOT NULL,
  subsidies NUMERIC(10, 4) NOT NULL,
  government_taxes NUMERIC(10, 4) NOT NULL,
  universal_charges NUMERIC(10, 4) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed March 2026 rates
INSERT INTO meralco_rates (
  effective_month, generation, transmission, system_loss,
  distribution, subsidies, government_taxes, universal_charges
) VALUES (
  '2026-03-01', 5.3727, 0.8468, 0.5012,
  1.4798, -0.0682, 0.2563, 0.1754
);

-- ============================================================
-- 3. DEVICES (ESP32-S3 Fleet Management)
-- ============================================================
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  mac_address TEXT UNIQUE NOT NULL,
  is_online BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 4. ENERGY LOGS (Optimized for Free Tier Throttling)
-- ============================================================
CREATE TABLE energy_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  energy_kwh NUMERIC(10, 4) NOT NULL,
  average_watts NUMERIC(10, 2),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_energy_logs_device_time ON energy_logs(device_id, recorded_at DESC);

-- ============================================================
-- 5. RELAY COMMANDS & SAFETY EVENTS
-- ============================================================
CREATE TABLE relay_commands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  command VARCHAR(10) NOT NULL, -- 'ON', 'OFF', or 'TRIP'
  origin VARCHAR(20) DEFAULT 'user', -- 'user' or 'system'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- 6. AI INSIGHTS (Trigger & Cache + Token Cost Tracking)
-- ============================================================
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL, -- 'budget_alert' or 'weekly_recap'
  message TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_insights_user_type_date
  ON ai_insights (user_id, insight_type, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE relay_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE meralco_rates ENABLE ROW LEVEL SECURITY;

-- profiles: users can only read/update their own row
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- devices: users can only access their own devices
CREATE POLICY "Users can view own devices"
  ON devices FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devices"
  ON devices FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devices"
  ON devices FOR UPDATE USING (auth.uid() = user_id);

-- energy_logs: users can access logs for their own devices
CREATE POLICY "Users can view own energy logs"
  ON energy_logs FOR SELECT
  USING (device_id IN (SELECT id FROM devices WHERE user_id = auth.uid()));

-- relay_commands: users can access commands for their own devices
CREATE POLICY "Users can view own relay commands"
  ON relay_commands FOR SELECT
  USING (device_id IN (SELECT id FROM devices WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own relay commands"
  ON relay_commands FOR INSERT
  WITH CHECK (device_id IN (SELECT id FROM devices WHERE user_id = auth.uid()));

-- ai_insights: users can only access their own insights
CREATE POLICY "Users can view own insights"
  ON ai_insights FOR SELECT USING (auth.uid() = user_id);

-- meralco_rates: all authenticated users can read (admin-managed via service role)
CREATE POLICY "Authenticated users can view rates"
  ON meralco_rates FOR SELECT USING (auth.role() = 'authenticated');
