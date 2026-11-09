import assert from "node:assert/strict";
import test from "node:test";
import { detectPowerCommand, replyForProposal } from "../lib/customer-assistant-power.ts";
import type { CustomerAssistantProposal } from "../lib/customer-assistant-types.ts";

const devices = [
  { ref: "device_1", name: "Aircon", appliance_type: "aircon" },
  { ref: "device_2", name: "test", appliance_type: "tv" },
  { ref: "device_3", name: "Test fan", appliance_type: "other", appliance_detail: "Desk fan" },
  { ref: "device_4", name: "Efan Home", appliance_type: "other", appliance_detail: "Electric Fan" },
];

test("turns a named device on or off now", () => {
  assert.deepEqual(detectPowerCommand("can you turn on my wattwise unit named test", devices), { device_ref: "device_2", on: true });
  assert.deepEqual(detectPowerCommand("Patayin mo na ang aircon", devices), { device_ref: "device_1", on: false });
  assert.deepEqual(detectPowerCommand("switch the aircon off please", devices), { device_ref: "device_1", on: false });
  assert.deepEqual(detectPowerCommand("buksan ang Test Fan", devices), { device_ref: "device_3", on: true });
  assert.equal(detectPowerCommand("turn on the latest one", devices), null, "test is not matched inside latest");
});

test("finds a device by what it is when the name isn't used", () => {
  assert.deepEqual(detectPowerCommand("paki turn off yung electric fan ko sa bahay", devices), { device_ref: "device_4", on: false });
  assert.deepEqual(detectPowerCommand("paki-off yung tv", devices), { device_ref: "device_2", on: false });
});

test("follow-ups reuse the device from the last card", () => {
  assert.deepEqual(detectPowerCommand("paki on ulit mainit e", devices, "device_4"), { device_ref: "device_4", on: true });
  assert.deepEqual(detectPowerCommand("turn it on", devices, "device_1"), { device_ref: "device_1", on: true });
  assert.equal(detectPowerCommand("turn it on", devices), null, "no earlier card and several devices");
  assert.deepEqual(detectPowerCommand("i-off mo", [devices[0]]), { device_ref: "device_1", on: false });
});

test("leaves scheduled, ambiguous, and state questions to the model", () => {
  assert.equal(detectPowerCommand("turn off the aircon at 1 am", devices), null);
  assert.equal(detectPowerCommand("patayin mo ang aircon ng 11:30 pm", devices), null);
  assert.equal(detectPowerCommand("turn off the aircon after it spends 50 pesos", devices), null);
  assert.equal(detectPowerCommand("how much did the aircon use?", devices), null);
  assert.equal(detectPowerCommand("turn on and off the aircon", devices), null);
  assert.equal(detectPowerCommand("naka-on pa ba ang aircon?", devices), null);
  assert.equal(detectPowerCommand("turn off the fan", devices), null, "two fans: let the model ask which");
});

const card = (action: CustomerAssistantProposal["action"]): CustomerAssistantProposal => ({
  action,
  title: "Turn on now",
  subject: "Efan Home",
  current_value: "Off",
  proposed_value: "On",
  consequence: "",
  expires_at: "2026-11-09T12:00:00.000Z",
});

test("the text above a card never contradicts it", () => {
  const power = card({ type: "set_power", device_id: "x", on: true });
  assert.equal(
    replyForProposal(power, "Sorry, pero hindi ko ma-turn on ang Efan Home mo dahil naka-off ito."),
    "Sige, i-o-on natin ang Efan Home. I-confirm mo lang sa card para ma-send ang command."
  );
  const budget = { ...card({ type: "update_home_budget", value: 2500 }), title: "Update home budget", subject: "Monthly home budget" };
  assert.equal(replyForProposal(budget, "Sige, gawin nating ₱2,500 ang budget."), "Sige, gawin nating ₱2,500 ang budget.");
  assert.match(replyForProposal(budget, "Sorry, I can't do that."), /Update home budget/);
});
