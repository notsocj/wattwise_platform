import assert from "node:assert/strict";
import test from "node:test";
import {
  computeFixedChargesWithVat,
  computeMeralcoBill,
  computeVariableRatePerKwh,
  type MeralcoRateComponents,
} from "../lib/meralco-bill.ts";

// Meralco Summary Schedule of Rates, October 2026, residential 101-200 kWh,
// non-lifeline. VAT table: Generation 8.33%, Transmission 11.99%,
// Ancillary Service 9.09%, Other Charges 12.00%.
const october2026: MeralcoRateComponents = {
  generation: 10.2005,
  transmission: 0.5422,
  ancillaryService: 0.602,
  systemLoss: 0.9301,
  distribution: 0.9803,
  supplyRate: 0.4979,
  meteringRate: 0.335,
  universalCharges: 0.385, // 0.3296 + 0.0101 + 0.0025 + 0.0428
  fitAll: 0.3359,
  awatAdjustment: -1.0139, // (0.4278) + (0.5861)
  regulatoryResetAdjustment: -0.0023,
  lifelineRateAdjustment: 0,
  seniorCitizenSubsidy: 0.0001,
  rptCharge: 0.0082, // 0.0067 + 0.0015
  geaAll: 0,
  lifelineSubsidy: 0.01,
  vatGeneration: 0.0833,
  vatTransmission: 0.1199,
  vatAncillary: 0.0909,
};

test("applies Meralco's per-component VAT and adjustments (October 2026)", () => {
  // 10.2005*1.0833 + 0.5422*1.1199 + 0.602*1.0909
  // + (0.9803 + 0.4979 + 0.335 - 1.0139 - 0.0023 + 0.0001)*1.12
  // + (0.9301 + 0.385 + 0.3359 + 0.0082 + 0.01) with no VAT
  assert.equal(Number(computeVariableRatePerKwh(october2026, 0.12).toFixed(4)), 14.8761);
});

test("bills fixed customer charges at the general VAT rate", () => {
  assert.equal(Number(computeFixedChargesWithVat(21.38, 0.12).toFixed(4)), 23.9456);
  assert.equal(
    Number(computeMeralcoBill(150, october2026, 0.12, { fixedChargesPhp: 21.38 }).toFixed(2)),
    Number((150 * computeVariableRatePerKwh(october2026, 0.12) + 23.9456).toFixed(2))
  );
});

test("falls back to the general VAT rate when component VAT is unknown", () => {
  const legacy: MeralcoRateComponents = {
    ...october2026,
    awatAdjustment: 0,
    regulatoryResetAdjustment: 0,
    seniorCitizenSubsidy: 0,
    rptCharge: 0,
    lifelineSubsidy: 0,
    vatGeneration: null,
    vatTransmission: null,
    vatAncillary: null,
  };
  const expected =
    (10.2005 + 0.5422 + 0.602 + 0.9803 + 0.4979 + 0.335) * 1.12 + (0.9301 + 0.385 + 0.3359);
  assert.equal(
    Number(computeVariableRatePerKwh(legacy, 0.12).toFixed(6)),
    Number(expected.toFixed(6))
  );
});
