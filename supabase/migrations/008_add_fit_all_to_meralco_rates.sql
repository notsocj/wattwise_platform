-- ============================================================
-- 008_add_fit_all_to_meralco_rates.sql
-- Adds the FIT-All (Feed-In Tariff Allowance) per-kWh component
-- to meralco_rates as a first-class billing column.
-- Uses ADD COLUMN IF NOT EXISTS for idempotency.
-- ============================================================

ALTER TABLE meralco_rates
  ADD COLUMN IF NOT EXISTS fit_all NUMERIC(10, 4) NOT NULL DEFAULT 0.0000;

-- Back-fill any existing rows where fit_all was not set (0.0000 default).
-- The March 2026 seed row will be updated here if it exists.
UPDATE meralco_rates
SET fit_all = 0.0838
WHERE effective_month = '2026-03-01'
  AND fit_all = 0.0000;
