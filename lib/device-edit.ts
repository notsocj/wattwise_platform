import type { ApplianceType } from "./constants.ts";

export const DEVICE_NAME_MAX_LENGTH = 60;
// Matches devices_appliance_detail_check (migration 044).
export const APPLIANCE_DETAIL_MAX_LENGTH = 40;

// Mirrors devices_appliance_type_check; `satisfies` keeps it in step with the enum.
const APPLIANCE_TYPES = ["refrigerator", "aircon", "tv", "other"] as const satisfies readonly `${ApplianceType}`[];

export type DeviceEdit = {
  device_name: string;
  appliance_type?: (typeof APPLIANCE_TYPES)[number];
  appliance_detail?: string | null;
};

/** Trims and collapses whitespace in a free-text field. */
function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/**
 * The "Other" description: required for type other (what is it?), dropped for
 * every other type. Returns the stored value or an error.
 */
export function parseApplianceDetail(type: string, value: unknown): { detail: string | null } | { error: string } {
  if (type !== "other") return { detail: null };
  const detail = cleanText(value);
  if (!detail) return { error: "Tell us what this appliance is, for example Electric fan." };
  if (detail.length > APPLIANCE_DETAIL_MAX_LENGTH) {
    return { error: `Keep the appliance description to ${APPLIANCE_DETAIL_MAX_LENGTH} characters or fewer.` };
  }
  return { detail };
}

/** "Electric fan" for an Other unit with a description, otherwise the category key. */
export function applianceLabel(type: string | null, detail: string | null | undefined): string {
  return type === "other" && detail ? detail : type ?? "other";
}

/** Validates a rename/edit request body for PATCH /api/devices/[deviceId]. */
export function parseDeviceEdit(body: unknown): { edit: DeviceEdit } | { error: string } {
  const input = (body ?? {}) as Record<string, unknown>;
  const name = cleanText(input.device_name);
  if (!name) return { error: "Give this unit a name." };
  if (name.length > DEVICE_NAME_MAX_LENGTH) {
    return { error: `Keep the name to ${DEVICE_NAME_MAX_LENGTH} characters or fewer.` };
  }

  const edit: DeviceEdit = { device_name: name };
  if (input.appliance_type !== undefined) {
    const type = APPLIANCE_TYPES.find((value) => value === input.appliance_type);
    if (!type) return { error: "Choose a valid appliance type." };
    const detail = parseApplianceDetail(type, input.appliance_detail);
    if ("error" in detail) return detail;
    edit.appliance_type = type;
    edit.appliance_detail = detail.detail;
  }
  return { edit };
}
