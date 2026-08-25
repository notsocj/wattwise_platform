import type {
  CustomerAssistantAction,
  CustomerAssistantProposal,
  CustomerRole,
} from "@/lib/customer-assistant-types";

export const CUSTOMER_ASSISTANT_MESSAGE_LIMIT = 1000;
export const CUSTOMER_ASSISTANT_HISTORY_LIMIT = 10;
export const CUSTOMER_ASSISTANT_RATE_LIMIT = 5;
export const CUSTOMER_ASSISTANT_RATE_WINDOW_MS = 5 * 60 * 1000;
export const CUSTOMER_ASSISTANT_PROPOSAL_TTL_MS = 15 * 60 * 1000;
export const MAX_PESO_VALUE = 9_999_999.99;

export function isCustomerRole(role: string | null | undefined): role is CustomerRole {
  return role === "user" || role === "tenant";
}

export function isExpiredProposal(createdAt: string, now = new Date()): boolean {
  const createdTime = new Date(createdAt).getTime();
  return !Number.isFinite(createdTime) || now.getTime() - createdTime > CUSTOMER_ASSISTANT_PROPOSAL_TTL_MS;
}

export function validatePesoValue(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > MAX_PESO_VALUE) {
    return null;
  }
  return Number(value.toFixed(2));
}

export function canRoleConfirmAction(role: CustomerRole, action: CustomerAssistantAction): boolean {
  if (action.type === "set_notification_preference") return true;
  return role === "user";
}

export function isCustomerAssistantProposal(value: unknown): value is CustomerAssistantProposal {
  if (!value || typeof value !== "object") return false;
  const proposal = value as Record<string, unknown>;
  if (!proposal.action || typeof proposal.action !== "object") return false;
  const action = proposal.action as Record<string, unknown>;
  const validAction =
    (action.type === "update_home_budget" && validatePesoValue(action.value) !== null) ||
    (action.type === "update_device_limit" &&
      typeof action.device_id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(action.device_id) &&
      validatePesoValue(action.value) !== null) ||
    (action.type === "set_auto_cutoff" &&
      typeof action.device_id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(action.device_id) &&
      typeof action.enabled === "boolean") ||
    (action.type === "set_notification_preference" &&
      (action.channel === "push" || action.channel === "email") &&
      typeof action.enabled === "boolean");
  return (
    validAction &&
    typeof proposal.title === "string" &&
    typeof proposal.subject === "string" &&
    typeof proposal.current_value === "string" &&
    typeof proposal.proposed_value === "string" &&
    typeof proposal.consequence === "string" &&
    typeof proposal.expires_at === "string" &&
    Number.isFinite(new Date(proposal.expires_at).getTime())
  );
}
