-- Add provenance metadata for automatic monthly Meralco rate updates.
ALTER TABLE meralco_rates
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS auto_updated BOOLEAN NOT NULL DEFAULT FALSE;

-- Track every automation run for observability and failure triage.
CREATE TABLE IF NOT EXISTS meralco_rate_sync_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'dry_run')),
  message TEXT NOT NULL,
  source_url TEXT,
  pdf_url TEXT,
  effective_month DATE,
  raw_rates JSONB,
  warnings TEXT[] DEFAULT '{}',
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meralco_rate_sync_runs_ran_at
  ON meralco_rate_sync_runs (ran_at DESC);

CREATE INDEX IF NOT EXISTS idx_meralco_rate_sync_runs_status
  ON meralco_rate_sync_runs (status);

ALTER TABLE meralco_rate_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admin_select_meralco_rate_sync_runs ON meralco_rate_sync_runs;
CREATE POLICY super_admin_select_meralco_rate_sync_runs
ON meralco_rate_sync_runs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
  )
);
