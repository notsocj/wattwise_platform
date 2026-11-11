import type {
  CustomerAssistantAction,
  CustomerAssistantProposal,
  CustomerRole,
} from "@/lib/customer-assistant-types";
import { isAutomationRule } from "./device-automations.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const CUSTOMER_ASSISTANT_MESSAGE_LIMIT = 1000;
export const CUSTOMER_ASSISTANT_HISTORY_LIMIT = 10;
export const CUSTOMER_ASSISTANT_RATE_LIMIT = 20;
export const CUSTOMER_ASSISTANT_RATE_WINDOW_MS = 5 * 60 * 1000;
export const CUSTOMER_ASSISTANT_PROPOSAL_TTL_MS = 15 * 60 * 1000;
export const MAX_PESO_VALUE = 9_999_999.99;
/** Units one on/off card may switch at once. */
export const MAX_POWER_DEVICES = 8;

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
      typeof action.enabled === "boolean") ||
    (action.type === "set_power" &&
      Array.isArray(action.device_ids) &&
      action.device_ids.length >= 1 &&
      action.device_ids.length <= MAX_POWER_DEVICES &&
      action.device_ids.every((id) => typeof id === "string" && UUID_PATTERN.test(id)) &&
      typeof action.on === "boolean") ||
    (action.type === "schedule_turn_off" &&
      typeof action.device_id === "string" &&
      UUID_PATTERN.test(action.device_id) &&
      isAutomationRule(action));
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

// Words that tie a message to energy or WattWise. A message containing any of
// them always goes to the assistant, even if it also mentions code.
const ON_TOPIC_PATTERN =
  /\b(bills?|kwh|watts?|meralco|kuryente|koryente|aircon|ref|fridge|tv|fan|devices?|units?|appliances?|budgets?|limits?|energy|power|electric(?:ity)?|rates?|spend|gastos|singil|bayarin|wattwise|turn\s+(?:it\s+)?off|patay(?:in)?|schedule|cutoff|relay|notifications?|alerts?|usage|consumption|save|tipid)\b/i;

// Requests that are clearly outside WattWise: writing code, homework, essays.
const OFF_TOPIC_PATTERN =
  /(```|#include|\bint\s+main\b|\bprintf\s*\(|\bconsole\.log\b|\bdef\s+\w+\s*\(|\bpublic\s+static\s+void\b|\b(?:c\+\+|c#|c|python|java(?:script)?|typescript|php|ruby|golang|rust|kotlin|swift|sql|html|css)\s+(?:code|codes|program|programs|programming|script|function|tutorial|homework|assignment)\b|\b(?:write|gawa(?:n|in)?|create|make)\s+(?:me\s+)?(?:a\s+|an\s+|ng\s+)?(?:program|code|script|essay|poem|story|song|letter)\b|\b(?:homework|assignment|essay)\b)/i;

export const OFF_TOPIC_REPLY =
  "Pasensya na, pang-WattWise lang ako: kuryente, bill, budget, at devices mo. Subukan mo: \"Bakit mataas ang bill ko?\" o \"Turn off my aircon at 1 AM.\"";

/**
 * A canned refusal for requests that are clearly not about energy or WattWise
 * (code, homework, essays), so they never reach OpenAI. Anything borderline
 * returns null and is left to the model, whose instructions also refuse
 * off-topic requests.
 */
export function offTopicReply(message: string): string | null {
  return isClearlyOffTopic(message) ? OFF_TOPIC_REPLY : null;
}

/** True for requests that are clearly not about energy or WattWise (code, homework, essays). */
export function isClearlyOffTopic(message: string): boolean {
  return !ON_TOPIC_PATTERN.test(message) && OFF_TOPIC_PATTERN.test(message);
}
