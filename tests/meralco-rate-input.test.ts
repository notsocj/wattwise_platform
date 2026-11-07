import assert from "node:assert/strict";
import test from "node:test";
import { parseRateInput, RATE_FIELDS } from "../lib/meralco-rate-input.ts";

function validBody(): Record<string, unknown> {
  const body: Record<string, unknown> = { effective_month: "2026-12", reason: "Sync missed December" };
  for (const field of RATE_FIELDS) {
    body[field.key] = field.optional ? "" : field.kind === "vat" ? 0.12 : field.kind === "fixed" ? 15 : field.kind === "adjustment" ? -0.05 : 1.2345;
  }
  return body;
}

test("a complete submission becomes a first-of-month row; blank optional fields are null", () => {
  const parsed = parseRateInput(validBody());
  assert.ok("row" in parsed);
  assert.equal(parsed.row.effective_month, "2026-12-01");
  assert.equal(parsed.row.values.generation, 1.2345);
  assert.equal(parsed.row.values.awat_adjustment, -0.05);
  assert.equal(parsed.row.values.distribution_201_300, null);
  assert.equal(parsed.reason, "Sync missed December");
});

test("bad month, missing reason, and out-of-range values are rejected per field", () => {
  const body = validBody();
  body.effective_month = "2026-13";
  body.reason = "";
  body.generation = "abc";
  body.vat_rate = 12; // percent sent instead of a fraction
  body.awat_adjustment = -50;
  body.supply_charge = "";
  const parsed = parseRateInput(body);
  assert.ok("errors" in parsed);
  for (const key of ["effective_month", "reason", "generation", "vat_rate", "awat_adjustment", "supply_charge"]) {
    assert.ok(parsed.errors[key], key);
  }
  assert.equal(parsed.errors.distribution, undefined);
});
