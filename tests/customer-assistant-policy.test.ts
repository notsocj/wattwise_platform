import assert from "node:assert/strict";
import test from "node:test";
import {
  canRoleConfirmAction,
  isExpiredProposal,
  isCustomerAssistantProposal,
  validatePesoValue,
} from "../lib/customer-assistant-policy.ts";

test("only customer owners can confirm budget and device safety changes", () => {
  assert.equal(canRoleConfirmAction("user", { type: "update_home_budget", value: 2500 }), true);
  assert.equal(canRoleConfirmAction("tenant", { type: "update_home_budget", value: 2500 }), false);
  assert.equal(
    canRoleConfirmAction("tenant", {
      type: "set_notification_preference",
      channel: "push",
      enabled: true,
    }),
    true
  );
});

test("rejects malformed or unsupported stored proposals", () => {
  const base = {
    title: "Update",
    subject: "Budget",
    current_value: "PHP 100.00",
    proposed_value: "PHP 200.00",
    consequence: "Changes the target.",
    expires_at: "2026-08-25T12:15:00.000Z",
  };
  assert.equal(isCustomerAssistantProposal({ ...base, action: { type: "update_home_budget", value: 200 } }), true);
  assert.equal(isCustomerAssistantProposal({ ...base, action: { type: "control_relay", enabled: false } }), false);
  assert.equal(isCustomerAssistantProposal({ ...base, action: { type: "update_device_limit", device_id: "not-a-uuid", value: 200 } }), false);
});

test("validates bounded positive peso values and rounds cents", () => {
  assert.equal(validatePesoValue(1250.456), 1250.46);
  assert.equal(validatePesoValue(0), null);
  assert.equal(validatePesoValue(Number.NaN), null);
  assert.equal(validatePesoValue(10_000_000), null);
});

test("customer proposals expire after fifteen minutes", () => {
  const now = new Date("2026-08-25T12:15:01.000Z");
  assert.equal(isExpiredProposal("2026-08-25T12:00:00.000Z", now), true);
  assert.equal(isExpiredProposal("2026-08-25T12:00:02.000Z", now), false);
  assert.equal(isExpiredProposal("invalid", now), true);
});
