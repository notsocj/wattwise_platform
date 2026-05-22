-- ============================================================
-- 004_seed_march_2026_meralco_rates.sql
-- Seeds the March 2026 Meralco unbundled base residential rate.
-- Source: Meralco Summary Schedule of Rates, March 2026.
-- Overall rate: ₱13.8161/kWh (non-lifeline residential, before fixed charges).
-- ON CONFLICT DO NOTHING makes this idempotent.
-- ============================================================

INSERT INTO meralco_rates (
  effective_month,
  vat_rate,
  generation,
  transmission,
  system_loss,
  distribution,
  universal_charges,
  fit_all,
  metering_charge,
  supply_charge
)
VALUES (
  '2026-03-01',
  0.12,      -- 12% VAT applied at the final step only
  5.3727,    -- Generation charge (₱/kWh)
  0.8468,    -- Transmission charge (₱/kWh)
  0.5012,    -- System loss charge (₱/kWh)
  1.4798,    -- Distribution charge (₱/kWh)
  0.1754,    -- Universal charges (₱/kWh)
  0.0838,    -- FIT-All (Feed-In Tariff Allowance) (₱/kWh)
  5.00,      -- Metering charge fixed monthly (₱)
  15.00      -- Supply charge fixed monthly (₱)
)
ON CONFLICT (effective_month) DO NOTHING;
