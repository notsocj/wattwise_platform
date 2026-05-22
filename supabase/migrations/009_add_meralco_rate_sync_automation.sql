-- ============================================================
-- 009_add_meralco_rate_sync_automation.sql
-- Creates the meralco_rate_sync_runs table used by the
-- sync-meralco-rates Supabase Edge Function to log every
-- run attempt (success or failure) for observability.
-- ============================================================

CREATE TABLE IF NOT EXISTS meralco_rate_sync_runs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status           TEXT NOT NULL,        -- 'success' | 'skipped' | 'failed'
  message          TEXT NOT NULL,
  source_url       TEXT NOT NULL,
  pdf_url          TEXT,
  effective_month  DATE,
  raw_rates        JSONB,                -- full parsed rate components
  warnings         TEXT[] DEFAULT '{}',
  ran_at           TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast recent-run queries in admin health page
CREATE INDEX IF NOT EXISTS idx_meralco_sync_runs_ran_at
  ON meralco_rate_sync_runs(ran_at DESC);

-- Enable RLS — only super_admin may read sync run logs
ALTER TABLE meralco_rate_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_select_sync_runs" ON meralco_rate_sync_runs;
CREATE POLICY "super_admin_select_sync_runs" ON meralco_rate_sync_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- The Edge Function writes rows using the service_role key (bypasses RLS),
-- so no INSERT policy for authenticated users is required.
