import assert from "node:assert/strict";
import test from "node:test";
import { APPLIANCE_DETAIL_MAX_LENGTH, applianceLabel, DEVICE_NAME_MAX_LENGTH, parseDeviceEdit } from "../lib/device-edit.ts";

test("trims and collapses whitespace in the name; type is optional", () => {
  assert.deepEqual(parseDeviceEdit({ device_name: "  Kitchen   fridge " }), { edit: { device_name: "Kitchen fridge" } });
  assert.deepEqual(parseDeviceEdit({ device_name: "Sala TV", appliance_type: "tv", appliance_detail: "ignored" }), {
    edit: { device_name: "Sala TV", appliance_type: "tv", appliance_detail: null },
  });
});

test("rejects blank, too-long, and non-string names", () => {
  for (const device_name of ["", "   ", undefined, 42, "x".repeat(DEVICE_NAME_MAX_LENGTH + 1)]) {
    assert.ok("error" in parseDeviceEdit({ device_name }), String(device_name));
  }
  assert.ok("edit" in parseDeviceEdit({ device_name: "x".repeat(DEVICE_NAME_MAX_LENGTH) }));
  assert.ok("error" in parseDeviceEdit(null));
});

test("rejects appliance types outside the database check", () => {
  for (const appliance_type of ["washer", "", null, "TV"]) {
    assert.ok("error" in parseDeviceEdit({ device_name: "Unit", appliance_type }), String(appliance_type));
  }
});

test("Other needs a short description of the appliance", () => {
  assert.deepEqual(parseDeviceEdit({ device_name: "Bedroom", appliance_type: "other", appliance_detail: "  Electric   fan " }), {
    edit: { device_name: "Bedroom", appliance_type: "other", appliance_detail: "Electric fan" },
  });
  for (const appliance_detail of [undefined, "", "  ", "x".repeat(APPLIANCE_DETAIL_MAX_LENGTH + 1)]) {
    assert.ok("error" in parseDeviceEdit({ device_name: "Bedroom", appliance_type: "other", appliance_detail }), String(appliance_detail));
  }
});

test("labels show the description only for Other", () => {
  assert.equal(applianceLabel("other", "Rice cooker"), "Rice cooker");
  assert.equal(applianceLabel("other", null), "other");
  assert.equal(applianceLabel("tv", "stale"), "tv");
  assert.equal(applianceLabel(null, null), "other");
});
