import assert from "node:assert/strict";
import test from "node:test";
import {
  getBudgetProgressPercent,
  getBudgetSeverity,
  isAutoCutoffEnabled,
} from "../lib/budget-policy.ts";

test("uses 50, 80, and 100 percent severity boundaries", () => {
  assert.equal(getBudgetSeverity(49.99), "normal");
  assert.equal(getBudgetSeverity(50), "info");
  assert.equal(getBudgetSeverity(79.99), "info");
  assert.equal(getBudgetSeverity(80), "warning");
  assert.equal(getBudgetSeverity(99.99), "warning");
  assert.equal(getBudgetSeverity(100), "critical");
});

test("computes control progress from variable spend and the approved limit", () => {
  assert.equal(getBudgetProgressPercent(500, 1_000), 50);
  assert.equal(getBudgetProgressPercent(1_250, 1_000), 125);
  assert.equal(getBudgetProgressPercent(100, 0), 0);
});

test("maps the legacy approval flag to the public automatic-cutoff setting", () => {
  assert.equal(isAutoCutoffEnabled(false), true);
  assert.equal(isAutoCutoffEnabled(true), false);
  assert.equal(isAutoCutoffEnabled(null), true);
});
