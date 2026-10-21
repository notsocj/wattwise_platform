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
