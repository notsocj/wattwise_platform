import assert from "node:assert/strict";
import test from "node:test";
import { buildGroundedCustomerResponse } from "../lib/customer-assistant-grounding.ts";

const context = {
  devices: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Fridge",
      limit_php: 1000,
      spend_php: 620,
      progress_percent: 62,
      current_watts: 140,
      telemetry_state: "fresh" as const,
      budget_status: "ok",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Aircon",
      limit_php: 500,
      spend_php: 410,
      progress_percent: 82,
      current_watts: 900,
      telemetry_state: "fresh" as const,
      budget_status: "warning_80",
    },
  ],
};

test("bill-high questions cite actual current-cycle data instead of asking the user to guess", () => {
  const response = buildGroundedCustomerResponse("Why is my bill high?", context);
  assert.ok(response);
  assert.match(response.reply, /Fridge/);
  assert.match(response.reply, /PHP 620\.00/);
  assert.doesNotMatch(response.reply, /Mahirap sabihin|Anong device ang tingin mo/i);
  assert.equal(response.display?.type, "device_list");
  assert.equal(response.display?.devices[0]?.name, "Fridge");
});

test("device-list questions return structured device cards instead of a numbered text list", () => {
  const response = buildGroundedCustomerResponse("Can you list my devices?", context);
  assert.ok(response);
  assert.equal(response.display?.devices.length, 2);
  assert.equal(response.reply.includes("1."), false);
});

test("bill-high answers prefer calendar-month evidence and disclose the smaller fresh billing-cycle total", () => {
  const response = buildGroundedCustomerResponse("Why is my bill high?", {
    devices: [
      {
        ...context.devices[0],
        spend_php: 2.21,
        calendar_month_spend_php: 950.42,
      },
      {
        ...context.devices[1],
        spend_php: 0.13,
        calendar_month_spend_php: 102.78,
      },
    ],
    calendar_month_label: "August 2026",
  });
  assert.ok(response);
  assert.match(response.reply, /August 2026/);
  assert.match(response.reply, /PHP 1,053\.20/);
  assert.match(response.reply, /current billing cycle/i);
  assert.equal(response.display?.devices[0]?.calendar_month_spend_php, 950.42);
});

test("bill-high answers do not claim zero usage when calendar-month telemetry is unavailable", () => {
  const response = buildGroundedCustomerResponse("Why is my bill high?", {
    devices: [
      {
        ...context.devices[0],
        spend_php: 620,
        calendar_month_spend_php: 0,
      },
    ],
    calendar_month_label: "August 2026",
    calendar_month_data_available: false,
  });
  assert.ok(response);
  assert.match(response.reply, /PHP 620\.00/);
  assert.doesNotMatch(response.reply, /Wala pang recorded usage spend/i);
  assert.equal(response.display?.title, "Current billing-cycle contributors");
});
