import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoSimulationUpdate } from "../lib/demo-units.ts";

const now = new Date("2026-11-04T12:00:00.000Z");
const previousRun = {
  is_active: false,
  live_since: "2026-11-03T04:00:00.000Z",
  energy_kwh: 12.345678,
  last_generated_at: "2026-11-03T08:00:00.000Z",
};

function updateFor(changes: Parameters<typeof buildDemoSimulationUpdate>[0]) {
  const result = buildDemoSimulationUpdate(changes, now);
  assert.ok("update" in result);
  return result.update;
}

test("starting an expired demo run clears its deadline and preserves history for backfill", () => {
  const restarted = { ...previousRun, ...updateFor({ is_active: true }) };

  assert.equal(restarted.is_active, true);
  // The existing simulator assigns a fresh DB timestamp when live_since is null.
  assert.equal(restarted.live_since, null);
  assert.equal(restarted.energy_kwh, previousRun.energy_kwh);
  assert.equal(restarted.last_generated_at, previousRun.last_generated_at);
});

test("a quick pause and restart requests a fresh window without resetting the meter", () => {
  const running = { ...previousRun, is_active: true, live_since: "2026-11-04T11:00:00.000Z" };
  const paused = { ...running, ...updateFor({ is_active: false }) };
  assert.equal(paused.is_active, false);
  assert.equal(paused.live_since, running.live_since);

  const restarted = { ...paused, ...updateFor({ is_active: true }) };
  assert.equal(restarted.is_active, true);
  assert.equal(restarted.live_since, null);
  assert.equal(restarted.energy_kwh, running.energy_kwh);
  assert.equal(restarted.last_generated_at, running.last_generated_at);
});

test("Start renews the window even when the caller last saw the unit running", () => {
  const restarted = { ...previousRun, is_active: true, ...updateFor({ is_active: true }) };
  assert.equal(restarted.live_since, null);
  assert.equal(restarted.last_generated_at, previousRun.last_generated_at);
});

test("editing demo output does not alter the run window or meter baseline", () => {
  const update = updateFor({ simulated_watts: "125.5", simulated_voltage_v: 240 });
  assert.deepEqual(update, { simulated_watts: 125.5, simulated_voltage_v: 240, updated_at: now.toISOString() });
});

test("resetting the meter does not restart or renew a demo run", () => {
  const reset = { ...previousRun, ...updateFor({ reset_energy: true }) };
  assert.equal(reset.energy_kwh, 0);
  assert.equal(reset.last_generated_at, null);
  assert.equal(reset.is_active, false);
  assert.equal(reset.live_since, previousRun.live_since);
});

test("invalid output settings reject a combined Start update", () => {
  for (const simulated_watts of [-1, 5001, "invalid"]) {
    const result = buildDemoSimulationUpdate({ is_active: true, simulated_watts }, now);
    assert.ok("error" in result);
    assert.match(result.error, /Watts/);
  }
  for (const simulated_voltage_v of [179, 261, "invalid"]) {
    const result = buildDemoSimulationUpdate({ is_active: true, simulated_voltage_v }, now);
    assert.ok("error" in result);
    assert.match(result.error, /Voltage/);
  }
});

test("unrelated edits and non-boolean start values leave the simulation untouched", () => {
  assert.deepEqual(updateFor({}), {});
  assert.deepEqual(updateFor({ is_active: "true" }), {});
});
