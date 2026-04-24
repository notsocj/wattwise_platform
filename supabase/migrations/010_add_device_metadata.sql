-- Migration: Add device metadata columns for AI onboarding and relay control
-- Phase 0 foundation — all columns nullable so existing rows are unaffected

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS appliance_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS daily_usage_hours NUMERIC(4, 1),
  ADD COLUMN IF NOT EXISTS relay_state BOOLEAN DEFAULT true;

-- RLS: allow device owners to UPDATE their own devices (relay_state, appliance_type, daily_usage_hours)
-- Drop existing policy first to be idempotent
DROP POLICY IF EXISTS "Users can update own devices" ON devices;
CREATE POLICY "Users can update own devices"
  ON devices
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
