import assert from "node:assert/strict";
import test from "node:test";
import {
  toCalendarAutomations,
  describeAutomation,
  isAutomationRule,
  nextManilaTime,
  resolveAutomationRequest,
} from "../lib/device-automations.ts";
import { canRoleConfirmAction, isCustomerAssistantProposal } from "../lib/customer-assistant-policy.ts";

// 9:14 PM Saturday, Nov 7, 2026 in Manila (UTC+8).
const NOW = new Date("2026-11-07T13:14:00Z");

test("1 AM means tonight's 1 AM, the next time it comes around in Manila", () => {
  assert.equal(nextManilaTime("01:00", NOW)?.toISOString(), "2026-11-07T17:00:00.000Z");
  assert.equal(nextManilaTime("1:00", NOW)?.toISOString(), "2026-11-07T17:00:00.000Z");
  // A time later today stays today; a time already passed rolls to tomorrow.
  assert.equal(nextManilaTime("23:30", NOW)?.toISOString(), "2026-11-07T15:30:00.000Z");
  assert.equal(nextManilaTime("21:14", NOW)?.toISOString(), "2026-11-08T13:14:00.000Z");
  assert.equal(nextManilaTime("24:00", NOW), null);
  assert.equal(nextManilaTime("1am", NOW), null);
  assert.equal(nextManilaTime(1, NOW), null);
});

test("time rules get a one-hour grace window; the model never supplies timestamps", () => {
  const rule = resolveAutomationRequest({ trigger: "time", time: "01:00" }, NOW);
  assert.deepEqual(rule, {
    trigger: "time",
    run_at: "2026-11-07T17:00:00.000Z",
    threshold: null,
    ends_at: "2026-11-07T18:00:00.000Z",
  });
  assert.match(describeAutomation(rule!), /^Turn off at 1:00\sAM, Sun.*Nov 8$/);
});

test("spend and usage rules count from now and end at 'until' or after 24 hours", () => {
  const tonight = resolveAutomationRequest({ trigger: "spend", php: 50, until: "06:00" }, NOW);
  assert.deepEqual(tonight, { trigger: "spend", run_at: null, threshold: 50, ends_at: "2026-11-07T22:00:00.000Z" });
  assert.match(describeAutomation(tonight!), /^Turn off after ₱50\.00 more \(until 6:00\sAM, /);

  const usage = resolveAutomationRequest({ trigger: "usage", kwh: 1.5, until: null }, NOW);
  assert.deepEqual(usage, { trigger: "usage", run_at: null, threshold: 1.5, ends_at: "2026-11-08T13:14:00.000Z" });

  assert.equal(resolveAutomationRequest({ trigger: "spend", php: 0 }, NOW), null);
  assert.equal(resolveAutomationRequest({ trigger: "spend", php: "50" }, NOW), null);
  assert.equal(resolveAutomationRequest({ trigger: "usage", kwh: 0.0001 }, NOW), null);
  assert.equal(resolveAutomationRequest({ trigger: "spend", php: 50, until: "tonight" }, NOW), null);
  assert.equal(resolveAutomationRequest({ trigger: "turn_on", time: "01:00" }, NOW), null);
});

test("stored rules are validated before a proposal can be confirmed", () => {
  const rule = resolveAutomationRequest({ trigger: "time", time: "01:00" }, NOW)!;
  assert.equal(isAutomationRule(rule), true);
  assert.equal(isAutomationRule({ ...rule, threshold: 5 }), false);
  assert.equal(isAutomationRule({ trigger: "spend", run_at: null, threshold: -1, ends_at: rule.ends_at }), false);

  const base = {
    title: "Schedule a turn-off",
    subject: "Aircon",
    current_value: "Nothing scheduled",
    proposed_value: "Turn off at 1:00 AM",
    consequence: "WattWise will switch the relay off.",
    expires_at: "2026-11-07T13:29:00.000Z",
  };
  const action = { type: "schedule_turn_off" as const, device_id: "6f1c2a4e-1b2c-4d3e-8f90-123456789abc", ...rule };
  assert.equal(isCustomerAssistantProposal({ ...base, action }), true);
  assert.equal(isCustomerAssistantProposal({ ...base, action: { ...action, device_id: "aircon" } }), false);
  // Only owners confirm scheduled turn-offs; tenants cannot.
  assert.equal(canRoleConfirmAction("user", action), true);
  assert.equal(canRoleConfirmAction("tenant", action), false);
});

test("calendar places rules on the Manila day they ran or will run", () => {
  const base = { threshold: null, ends_at: "2026-11-12T06:00:00.000Z", device_name: "Efan Home" };
  const items = toCalendarAutomations(
    [
      // Done: executed 6:17 PM Manila on Nov 11.
      { ...base, id: "a", trigger_type: "time", run_at: "2026-11-11T10:17:00.000Z", status: "done", executed_at: "2026-11-11T10:17:05.000Z", created_at: "2026-11-11T09:00:00.000Z" },
      // Active time rule: 1:00 PM Manila on Nov 12.
      { ...base, id: "b", trigger_type: "time", run_at: "2026-11-12T05:00:00.000Z", status: "active", executed_at: null, created_at: "2026-11-11T12:00:00.000Z" },
      // Spend rule made at 1:00 AM Manila on Dec 1: not in November.
      { ...base, id: "c", trigger_type: "spend", run_at: null, threshold: "50", status: "active", executed_at: null, created_at: "2026-11-30T17:00:00.000Z" },
      // Cancelled rules stay off the calendar.
      { ...base, id: "d", trigger_type: "time", run_at: "2026-11-13T05:00:00.000Z", status: "cancelled", executed_at: null, created_at: "2026-11-11T12:00:00.000Z" },
    ],
    "2026-11"
  );
  assert.deepEqual(items.map((item) => [item.id, item.dayKey, item.doneAt !== null]), [
    ["a", "2026-11-11", true],
    ["b", "2026-11-12", false],
  ]);
  assert.match(items[1].label, /^Turn off at 1:00 PM/);
});
