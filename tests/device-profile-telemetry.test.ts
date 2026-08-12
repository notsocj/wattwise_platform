import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyProfileTelemetry,
  PROFILE_TELEMETRY_FRESHNESS_MS,
} from "../lib/device-profile-telemetry.ts";

const NOW = Date.parse("2026-08-12T14:22:10.000Z");

test("accepts a positive reading from the hardware startup window", () => {
  const result = classifyProfileTelemetry(
    {
      average_watts: "53.25",
      voltage_v: "238",
      current_a: "0.25",
      recorded_at: new Date(NOW - 90_000).toISOString(),
    },
    NOW
  );

  assert.equal(PROFILE_TELEMETRY_FRESHNESS_MS, 120_000);
  assert.deepEqual(result, {
    state: "ready",
    baselineWatts: 53.25,
    voltageV: 238,
    currentA: 0.25,
  });
});

test("distinguishes an online meter with zero load from missing telemetry", () => {
  assert.equal(
    classifyProfileTelemetry(
      {
        average_watts: 0,
        voltage_v: 239.2,
        current_a: 0,
        recorded_at: new Date(NOW - 5_000).toISOString(),
      },
      NOW
    ).state,
    "load_not_detected"
  );

  assert.equal(classifyProfileTelemetry(null, NOW).state, "pending");
});
