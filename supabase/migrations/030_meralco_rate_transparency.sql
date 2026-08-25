-- Keep customer-facing Meralco rate provenance alongside the rate row.
-- The sync Edge Function already writes these fields when they are available.

ALTER TABLE public.meralco_rates
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_updated BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.meralco_rates.source_url IS
  'Meralco archive or official source page used by the latest sync.';
COMMENT ON COLUMN public.meralco_rates.source_pdf_url IS
  'Exact Meralco monthly bill summary PDF, when available.';
COMMENT ON COLUMN public.meralco_rates.fetched_at IS
  'Timestamp when WattWise last fetched and verified this rate row.';
COMMENT ON COLUMN public.meralco_rates.auto_updated IS
  'True when the row was written by sync-meralco-rates rather than a manual admin entry.';
