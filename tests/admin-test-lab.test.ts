import assert from "node:assert/strict";
import test from "node:test";
import { getCycleStartDate, targetCumulativeEnergy, thresholdEventType, validatePhysicalDeviceConfirmation } from "../lib/admin-test-lab.ts";

const rates = { generation: 5, transmission: 1, systemLoss: 0.5, distribution: 1, universalCharges: 0.2, fitAll: 0.1 };

test("uses the selected profile billing cycle in Manila", () => {
  assert.equal(getCycleStartDate(15, new Date("2026-08-14T16:00:00Z")), "2026-08-15");
  assert.equal(getCycleStartDate(15, new Date("2026-08-13T16:00:00Z")), "2026-07-15");
});

test("calculates a cumulative energy value that crosses the requested spend", () => {
  const cumulative = targetCumulativeEnergy({ currentSpendPhp: 30, currentEnergyKwh: 4, targetSpendPhp: 100, rates, vatRate: 0.12 });
  assert.ok(cumulative > 4);
  assert.equal(Number(cumulative.toFixed(4)), cumulative);
});

test("maps 50/80 warnings and terminal behavior correctly", () => {
  assert.equal(thresholdEventType(50, true), "budget_warning");
  assert.equal(thresholdEventType(80, false), "budget_warning");
  assert.equal(thresholdEventType(100, true), "approval_required");
  assert.equal(thresholdEventType(100, false), "auto_cutoff");
});

test("requires exact confirmation and a reason for physical devices only", () => {
  assert.equal(validatePhysicalDeviceConfirmation({ isDemo: true, deviceName: "Demo", confirmedName: "", reason: "" }), null);
  assert.match(validatePhysicalDeviceConfirmation({ isDemo: false, deviceName: "Aircon", confirmedName: "aircon", reason: "test" }) ?? "", /exact/i);
  assert.match(validatePhysicalDeviceConfirmation({ isDemo: false, deviceName: "Aircon", confirmedName: "Aircon", reason: "" }) ?? "", /reason/i);
  assert.equal(validatePhysicalDeviceConfirmation({ isDemo: false, deviceName: "Aircon", confirmedName: "Aircon", reason: "Presentation test" }), null);
});
