import assert from "node:assert/strict";
import test from "node:test";
import { detectPowerCommand } from "../lib/customer-assistant-power.ts";

const devices = [
  { ref: "device_1", name: "Aircon" },
  { ref: "device_2", name: "test" },
  { ref: "device_3", name: "Test fan" },
];

test("turns a named device on or off now", () => {
  assert.deepEqual(detectPowerCommand("can you turn on my wattwise unit named test", devices), { device_ref: "device_2", on: true });
  assert.deepEqual(detectPowerCommand("Patayin mo na ang aircon", devices), { device_ref: "device_1", on: false });
  assert.deepEqual(detectPowerCommand("switch the aircon off please", devices), { device_ref: "device_1", on: false });
  assert.deepEqual(detectPowerCommand("buksan ang Test Fan", devices), { device_ref: "device_3", on: true });
});

test("leaves scheduled, ambiguous, and unnamed requests to the model", () => {
  assert.equal(detectPowerCommand("turn off the aircon at 1 am", devices), null);
  assert.equal(detectPowerCommand("patayin mo ang aircon ng 11:30 pm", devices), null);
  assert.equal(detectPowerCommand("turn off the aircon after it spends 50 pesos", devices), null);
  assert.equal(detectPowerCommand("turn it on", devices), null);
  assert.equal(detectPowerCommand("how much did the aircon use?", devices), null);
  assert.equal(detectPowerCommand("turn on and off the aircon", devices), null);
});
