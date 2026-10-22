import assert from "node:assert/strict";
import test from "node:test";
import { parseRatesFromText } from "../supabase/functions/sync-meralco-rates/parser.ts";

test("maps the August 2026 non-lifeline residential row to the matching Meralco columns", () => {
  const extractedText = `
    VAT rate 12%
    FOR NON-LIFELINE CUSTOMERS
    101 TO 200 KWH
    9.2800 0.5125 1.0685 0.9218 0.9803 0.4979 16.38 0.3350 5.00
    (0.4278) (0.5861) (0.0023) (0.0001) (0.0004) 0.0067 0.0015
    0.0640 (0.0002) 1.3709 0.0000 0.3216 0.3359 0.0000 0.0000 0.0100 14.9035
  `;

  assert.deepEqual(parseRatesFromText(extractedText), {
    generation: 9.28,
    transmission: 0.5125,
    ancillary_service: 1.0685,
    system_loss: 0.9218,
    distribution: 0.9803,
    supply_rate: 0.4979,
    metering_rate: 0.335,
    universal_charges: 0.3216,
    fit_all: 0.3359,
    vat_rate: 0.12,
    metering_charge: 5,
    supply_charge: 16.38,
  });
});

test("parses the 100 kWh non-lifeline row from Meralco's residential-bills PDF text layout", () => {
  const extractedText = `
    RESIDENTIAL BILLS AT TYPICAL CONSUMPTION LEVELS August 2026
    Rate per kWh (PhP/kWh)
    For Non-Lifeline Customers
    50 9.2800 0 .5125 1 .0685 0.9218 0.9803 0.4979 0.3276 0.3350 0.1000
    70 9.2800 0 .5125 1 .0685 0.9218 0.9803 0.4979 0.2340 0.3350 0.0714
    100 9.2800 0 .5125 1 .0685 0.9218 0.9803 0.4979 0.1638 0.3350 0.0500
    (0.4278) (0.5861) ( 0.0023) ( 0.0001) (0.0004) 0 .0067 0 .0015 0.0640
    (0.0002) 1.3709 - 0.3216 0.3359 - - 0.0100 14.9035
  `;

  assert.deepEqual(parseRatesFromText(extractedText), {
    generation: 9.28,
    transmission: 0.5125,
    ancillary_service: 1.0685,
    system_loss: 0.9218,
    distribution: 0.9803,
    supply_rate: 0.4979,
    metering_rate: 0.335,
    universal_charges: 0.3216,
    fit_all: 0.3359,
    vat_rate: null,
    metering_charge: 5,
    supply_charge: 16.38,
  });
});

// Text as extracted from Meralco's current Summary Schedule of Rates, where
// Universal Charge is split into four UC columns and GEA-All follows FIT-All.
function currentScheduleText(row101To200: string): string {
  return `
    SUMMARY SCHEDULE OF RATES* EFFECTIVE BILLING
    Generation Charge1 Transmission Charge2 Ancillary Service Charge3 System Loss Charge4
    Distribution Charge5 Supply Charge5 Metering Charge5 AWAT (Refund)/Collect 1 6
    Universal Charge UC-ME for (NPC-SPUG)12 UC-ME for (RED-CI)12 UC-EC13 UC-SD14
    FIT-All (Renewable)15 GEA-All (Renewable)16
    Residential
    ${row101To200}
    201 TO 300 KWH 9.7032 0.5485 0.7341 0.8898 1.2908 0.4979 16.38 0.3350 5.00 (0.4278) (0.5861) (0.0023) (0.0001) 0.0001 0.0067 0.0015 0.2662 0.0101 0.0025 0.0428 0.3359 0.0000 0.0100
    General Service A
    VAT RATES Generation 8.33% Transmission 11.99% Ancillary Service 9.09% Other Charges 12.00%
  `;
}

test("reads FIT-All, not the GEA-All column after it, from the September 2026 schedule", () => {
  const text = currentScheduleText(
    "101 TO 200 KWH 9.7032 0.5485 0.7341 0.8898 0.9803 0.4979 16.38 0.3350 5.00 (0.4278) (0.5861) (0.0023) (0.0001) 0.0001 0.0067 0.0015 0.2662 0.0101 0.0025 0.0428 0.3359 0.0000 0.0100"
  );

  assert.deepEqual(parseRatesFromText(text), {
    generation: 9.7032,
    transmission: 0.5485,
    ancillary_service: 0.7341,
    system_loss: 0.8898,
    distribution: 0.9803,
    supply_rate: 0.4979,
    metering_rate: 0.335,
    universal_charges: 0.3216,
    fit_all: 0.3359,
    vat_rate: 0.12,
    metering_charge: 5,
    supply_charge: 16.38,
  });
});

test("sums the four Universal Charge columns in the October 2026 schedule", () => {
  const text = currentScheduleText(
    "101 TO 200 KWH 10.2005 0.5422 0.602 0.9301 0.9803 0.4979 16.38 0.3350 5.00 (0.4278) (0.5861) (0.0023) 0.0000 0.0001 0.0067 0.0015 0.3296 0.0101 0.0025 0.0428 0.3359 0.0000 0.0100"
  );
  const parsed = parseRatesFromText(text);

  assert.equal(parsed.generation, 10.2005);
  assert.equal(parsed.universal_charges, 0.385);
  assert.equal(parsed.fit_all, 0.3359);
  assert.equal(parsed.supply_charge, 16.38);
  assert.equal(parsed.metering_charge, 5);
  assert.equal(parsed.vat_rate, 0.12);
});
