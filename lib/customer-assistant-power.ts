import type { CustomerAssistantProposal } from "./customer-assistant-types.ts";

/**
 * Recognises device commands without the model: "turn <device> on/off now"
 * (detectPowerCommand) and "turn it off at 5:32 pm / after ₱50 / after 2 kWh"
 * (detectScheduleCommand). The model tends to copy its own earlier refusals
 * from chat history, so these are resolved in code; anything else (and every
 * proposal) is still validated by resolveModelProposal and confirmed by the user.
 */

const ON = /\b(?:turn|switch|power)\s+on\b|\b(?:turn|switch)\s+[\p{L}\p{N}\s'-]{1,40}?\s+on\b|\b(?:buksan|buhayin|paandarin|i-?on|paki-?\s?on|pa-?on|on\s+(?:mo|ulit|uli))\b/iu;
const OFF = /\b(?:turn|switch|power)\s+of{1,2}\b|\b(?:turn|switch)\s+[\p{L}\p{N}\s'-]{1,40}?\s+off\b|\b(?:patayin|isara|i-?off|paki-?\s?off|pa-?off|off\s+(?:mo|ulit|uli))\b/iu;
// No bare "at"/"ng": in Taglish they also mean "and"/"of"; clock times are caught below.
const SCHEDULE = /\b(?:by|after|pag|kapag|when|until|hanggang|tonight|mamaya|tomorrow|bukas|later)\b|\d\s*(?:am|pm)\b|\d{1,2}:\d{2}|₱|\bphp\b|\bpesos?\b|\bkwh\b/i;
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

// "Patayin lahat", "turn off all my units".
const ALL_DEVICES = /\b(?:all|lahat)\b/i;

// "1 and 2", "1, 2 at 3", "1 & 2", "1/2", "1 saka 2".
const LIST_JOINER = String.raw`\s*(?:,|&|\/|\band\b|\bat\b|\bsaka\b|\btsaka\b)\s*`;
const NUMBER_LIST = new RegExp(String.raw`([\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*)*)\s+(\d+)((?:${LIST_JOINER}\d+)+)`, "gu");

/**
 * Spells out number lists so each unit's full name appears: "wattwise unit 1
 * and 2" -> "wattwise unit 1, wattwise unit 2". A plural ("units 1 and 2") is
 * also written singular.
 */
function expandNumberLists(text: string): string {
  return text.replace(NUMBER_LIST, (_match, prefix: string, first: string, rest: string) => {
    const singular = prefix.endsWith("s") ? prefix.slice(0, -1) : null;
    return [first, ...(rest.match(/\d+/g) ?? [])]
      .map((n) => (singular ? `${prefix} ${n}, ${singular} ${n}` : `${prefix} ${n}`))
      .join(", ");
  });
}

/**
 * Every device named in the message. Longer names are matched first and cut
 * out, so "Test fan" doesn't also count as "test", while "Wattwise Unit 1 and
 * 2" finds both. Then short forms of numbered names: "wattwise 2" or "unit 2"
 * for "Wattwise Unit 2", only when exactly one unit fits that number.
 */
function namedDevices(message: string, devices: ReadonlyArray<PowerDevice>): string[] {
  const text = expandNumberLists(message);
  let rest = text;
  const refs: string[] = [];
  for (const device of [...devices].sort((a, b) => b.name.length - a.name.length)) {
    if (!mentions(rest, device.name)) continue;
    refs.push(device.ref);
    rest = rest.split(normalize(device.name)).join(" ");
  }

  const byNumber = new Map<string, string[]>();
  for (const device of devices) {
    if (refs.includes(device.ref)) continue;
    const numbered = /^(.*\D)\s*(\d+)$/.exec(normalize(device.name));
    if (!numbered) continue;
    const [, prefix, n] = numbered;
    const words = prefix.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 3);
    if (words.some((word) => mentions(rest, `${word} ${n}`))) byNumber.set(n, [...(byNumber.get(n) ?? []), device.ref]);
  }
  for (const candidates of byNumber.values()) if (candidates.length === 1) refs.push(candidates[0]);
  return refs;
}

/**
 * Which devices the message means: "all", else every named device, else a
 * unique match on what it is ("electric fan", "aircon"), else the devices the
 * last card was about ("paki on ulit"), else the only device. Empty when unclear.
 */
function resolveDevices(text: string, devices: ReadonlyArray<PowerDevice>, lastDeviceRefs: readonly string[]): string[] {
  if (ALL_DEVICES.test(text) && devices.length) return devices.map((device) => device.ref);
  const named = namedDevices(text, devices);
  if (named.length) return named;

  const byKind = devices.filter((device) =>
    [device.appliance_detail ?? "", ...(TYPE_WORDS[device.appliance_type ?? ""] ?? [])].some((word) => mentions(text, word))
  );
  if (byKind.length) return byKind.length === 1 ? [byKind[0].ref] : [];

  const last = lastDeviceRefs.filter((ref) => devices.some((device) => device.ref === ref));
  if (last.length) return last;
  return devices.length === 1 ? [devices[0].ref] : [];
}

/** One device for a schedule; several or none leaves it to the model. */
function resolveDevice(text: string, devices: ReadonlyArray<PowerDevice>, lastDeviceRefs: readonly string[]): string | null {
  const refs = resolveDevices(text, devices, lastDeviceRefs);
  return refs.length === 1 ? refs[0] : null;
}

export function detectPowerCommand(
  message: string,
  devices: ReadonlyArray<PowerDevice>,
  lastDeviceRefs: readonly string[] = []
): { device_refs: string[]; on: boolean } | null {
  const text = normalize(message);
  const on = ON.test(text);
  const off = OFF.test(text);
  if (on === off || SCHEDULE.test(text) || STATE_QUESTION.test(text)) return null;
  const device_refs = resolveDevices(text, devices, lastDeviceRefs);
  return device_refs.length ? { device_refs, on } : null;
}

const REFUSAL = /\b(?:sorry|hindi ko|di ko|can't|cannot|can not|unable|not able)\b/i;

/** True for an assistant reply that declines; such replies are kept out of the model's history. */
export function isRefusal(text: string): boolean {
  return REFUSAL.test(text);
}

// "5:32 pm", "5 32 pm", "5.32pm", "11 pm", or 24-hour "17:30".
const CLOCK_12 = /\b(\d{1,2})(?:[:. ](\d{2}))?\s*([ap])\.?\s?m\b\.?/i;
const CLOCK_24 = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;
const PESOS = /(?:₱|\bphp\s?)(\d[\d,]*(?:\.\d+)?)|\b(\d[\d,]*(?:\.\d+)?)\s*(?:pesos?|php)\b/i;
const KWH = /\b(\d+(?:\.\d+)?)\s*kwh\b/i;
const TONIGHT = /\b(?:tonight|ngayong gabi|mamayang gabi)\b/i;

/** "HH:MM" in 24-hour time, or null when the message names no valid clock time. */
export function parseClockTime(text: string): string | null {
  const twelve = CLOCK_12.exec(text);
  if (twelve) {
    const hour = Number(twelve[1]);
    const minute = Number(twelve[2] ?? 0);
    if (hour < 1 || hour > 12 || minute > 59) return null;
    const hour24 = (hour % 12) + (twelve[3].toLowerCase() === "p" ? 12 : 0);
    return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  const day = CLOCK_24.exec(text);
  return day ? `${day[1].padStart(2, "0")}:${day[2]}` : null;
}

export type ScheduleCommand =
  | { type: "schedule_turn_off"; device_ref: string; trigger: "time"; time: string }
  | { type: "schedule_turn_off"; device_ref: string; trigger: "spend"; php: number; until: string | null }
  | { type: "schedule_turn_off"; device_ref: string; trigger: "usage"; kwh: number; until: string | null };

/**
 * "Turn it off at 5:32 pm", "patayin ang aircon after ₱50 more tonight",
 * "turn off the fan after 2 kWh". Turn-ON schedules are not supported, so they
 * fall through to the model, which declines.
 */
export function detectScheduleCommand(
  message: string,
  devices: ReadonlyArray<PowerDevice>,
  lastDeviceRefs: readonly string[] = []
): ScheduleCommand | null {
  const text = normalize(message);
  if (!OFF.test(text) || ON.test(text)) return null;
  const time = parseClockTime(text);
  const peso = PESOS.exec(text);
  const kwh = KWH.exec(text);
  if (peso && kwh) return null;
  if (!time && !peso && !kwh) return null;
  const device_ref = resolveDevice(text, devices, lastDeviceRefs);
  if (!device_ref) return null;

  if (peso || kwh) {
    const until = time ?? (TONIGHT.test(text) ? "06:00" : null);
    return peso
      ? { type: "schedule_turn_off", device_ref, trigger: "spend", php: Number((peso[1] ?? peso[2]).replace(/,/g, "")), until }
      : { type: "schedule_turn_off", device_ref, trigger: "usage", kwh: Number(kwh![1]), until };
  }
  return { type: "schedule_turn_off", device_ref, trigger: "time", time: time! };
}

// A change verb and the word "limit": "set/raise/lower the aircon limit to ₱500",
// "gawin mong ₱300 ang limit ng TV", "itaas ang limit ng unit 1 sa 500".
const LIMIT_WORD = /\blimit\b/i;
const CHANGE_VERB = /\b(?:set|change|raise|lower|increase|decrease|reduce|make|update|put|adjust|gawin|gawing|ilagay|lagay|itaas|taasan|ibaba|babaan|palitan|i-?set)\b/i;
const AMOUNT_AFTER_TO = /\b(?:to|sa|into|na)\s+(\d[\d,]*(?:\.\d+)?)\b/i;

/**
 * "Set the Wattwise Unit 1 limit back to ₱35.06" as a device-limit change for
 * exactly one unit, resolved in code (the model once refused this). The amount
 * is the peso figure, or the number after "to"/"sa". Questions without a
 * change verb ("is ₱500 a good limit?") stay with the model.
 */
export function detectLimitCommand(
  message: string,
  devices: ReadonlyArray<PowerDevice>,
  lastDeviceRefs: readonly string[] = []
): { type: "update_device_limit"; device_ref: string; value: number } | null {
  const text = normalize(message);
  if (!LIMIT_WORD.test(text) || !CHANGE_VERB.test(text)) return null;
  const peso = PESOS.exec(text);
  const raw = peso ? (peso[1] ?? peso[2]) : AMOUNT_AFTER_TO.exec(text)?.[1];
  const value = raw ? Number(raw.replace(/,/g, "")) : NaN;
  if (!Number.isFinite(value) || value <= 0) return null;
  const device_ref = resolveDevice(text, devices, lastDeviceRefs);
  return device_ref ? { type: "update_device_limit", device_ref, value } : null;
}

/**
 * The text shown above a proposal card. Power cards always get a fixed line;
 * other cards keep the model's explanation unless it contradicts the card
 * (the model sometimes refuses in words while proposing the change).
 */
export function replyForProposal(proposal: CustomerAssistantProposal, modelReply: string): string {
  if (proposal.action.type === "set_power") {
    return `Sige, ${proposal.action.on ? "i-o-on" : "i-o-off"} natin ang ${proposal.subject}. I-confirm mo lang sa card para ma-send ang command.`;
  }
  if (proposal.action.type === "update_device_limit" && !modelReply.trim()) {
    return `Sige, gagawin nating ${proposal.proposed_value} ang limit ng ${proposal.subject}. I-confirm mo lang sa card.`;
  }
  if (proposal.action.type === "schedule_turn_off") {
    return `Sige, ise-schedule natin ang ${proposal.subject}: ${proposal.proposed_value}. I-confirm mo lang sa card.`;
  }
  if (!modelReply.trim() || REFUSAL.test(modelReply)) {
    return `Handa na ang "${proposal.title}" para sa ${proposal.subject}. I-review at i-confirm mo lang sa card.`;
  }
  return modelReply;
}
