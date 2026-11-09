import type { CustomerAssistantProposal } from "./customer-assistant-types.ts";

/**
 * Recognises a plain "turn <device> on/off now" request without the model.
 * The model tends to copy its own earlier refusals from chat history, so these
 * commands are resolved in code; anything with a time or an amount is left to
 * the model, which turns it into a scheduled turn-off.
 */

const ON = /\b(?:turn|switch|power)\s+on\b|\b(?:turn|switch)\s+[\p{L}\p{N}\s'-]{1,40}?\s+on\b|\b(?:buksan|buhayin|paandarin|i-?on|paki-?\s?on|pa-?on|on\s+(?:mo|ulit|uli))\b/iu;
const OFF = /\b(?:turn|switch|power)\s+off\b|\b(?:turn|switch)\s+[\p{L}\p{N}\s'-]{1,40}?\s+off\b|\b(?:patayin|isara|i-?off|paki-?\s?off|pa-?off|off\s+(?:mo|ulit|uli))\b/iu;
const SCHEDULE = /\b(?:at|ng|by|after|pag|kapag|when|until|hanggang|tonight|mamaya|tomorrow|bukas|later)\b|\d\s*(?:am|pm)\b|\d{1,2}:\d{2}|₱|\bphp\b|\bpesos?\b|\bkwh\b/i;
// "Naka-on ba?" asks about the state; it is not a command.
const STATE_QUESTION = /\bnaka-?\s?(?:on|off)\b/i;

const TYPE_WORDS: Record<string, string[]> = {
  refrigerator: ["ref", "fridge", "refrigerator", "ref ko"],
  aircon: ["aircon", "air con", "ac", "aircondition", "air conditioner"],
  tv: ["tv", "television", "telebisyon"],
};

export type PowerDevice = { ref: string; name: string; appliance_type?: string | null; appliance_detail?: string | null };

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Whole-word (not substring) match, so "test" does not match "latest". */
function mentions(text: string, phrase: string): boolean {
  const needle = normalize(phrase);
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, "u").test(text);
}

/**
 * Which device the message means: its name (longest match wins), else a unique
 * match on what it is ("electric fan", "aircon"), else the device the last
 * proposal was about ("paki on ulit"), else the only device.
 */
function resolveDevice(text: string, devices: ReadonlyArray<PowerDevice>, lastDeviceRef: string | null): string | null {
  const named = devices.filter((device) => mentions(text, device.name)).sort((a, b) => b.name.length - a.name.length);
  if (named.length) return named[0].ref;

  const byKind = devices.filter((device) =>
    [device.appliance_detail ?? "", ...(TYPE_WORDS[device.appliance_type ?? ""] ?? [])].some((word) => mentions(text, word))
  );
  if (byKind.length === 1) return byKind[0].ref;
  if (byKind.length > 1) return null;

  if (lastDeviceRef && devices.some((device) => device.ref === lastDeviceRef)) return lastDeviceRef;
  return devices.length === 1 ? devices[0].ref : null;
}

export function detectPowerCommand(
  message: string,
  devices: ReadonlyArray<PowerDevice>,
  lastDeviceRef: string | null = null
): { device_ref: string; on: boolean } | null {
  const text = normalize(message);
  const on = ON.test(text);
  const off = OFF.test(text);
  if (on === off || SCHEDULE.test(text) || STATE_QUESTION.test(text)) return null;
  const device_ref = resolveDevice(text, devices, lastDeviceRef);
  return device_ref ? { device_ref, on } : null;
}

const REFUSAL = /\b(?:sorry|hindi ko|di ko|can't|cannot|can not|unable|not able)\b/i;

/**
 * The text shown above a proposal card. Power cards always get a fixed line;
 * other cards keep the model's explanation unless it contradicts the card
 * (the model sometimes refuses in words while proposing the change).
 */
export function replyForProposal(proposal: CustomerAssistantProposal, modelReply: string): string {
  if (proposal.action.type === "set_power") {
    return `Sige, ${proposal.action.on ? "i-o-on" : "i-o-off"} natin ang ${proposal.subject}. I-confirm mo lang sa card para ma-send ang command.`;
  }
  if (!modelReply.trim() || REFUSAL.test(modelReply)) {
    return `Handa na ang "${proposal.title}" para sa ${proposal.subject}. I-review at i-confirm mo lang sa card.`;
  }
  return modelReply;
}
