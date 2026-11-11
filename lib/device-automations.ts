// Scheduled turn-offs ("device automations"). Pure helpers shared by the
// customer assistant, the confirm route, and the device page; the scheduler
// itself is public.run_device_automations() (migration 041).

export type AutomationTrigger = "time" | "spend" | "usage";

/** A rule as the assistant proposes it and the confirm route creates it. */
export type AutomationRule = {
  trigger: AutomationTrigger;
  /** ISO time to turn off (time rules). */
  run_at: string | null;
  /** PHP (spend) or kWh (usage) counted from creation. */
  threshold: number | null;
  /** ISO end of the rule's window. Time rules: run_at + 1 hour. */
  ends_at: string;
};

export const MAX_AUTOMATION_PESO = 9_999_999.99;
export const MAX_AUTOMATION_KWH = 100_000;
/** Spend/usage rules with no end time given run for this long. */
export const DEFAULT_AUTOMATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const TIME_RULE_GRACE_MS = 60 * 60 * 1000;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000; // Asia/Manila is UTC+8 all year.

/**
 * The next moment it is `hhmm` (24-hour, "01:00") in Manila, strictly after
 * `now`. Returns null for anything that is not a valid HH:MM.
 */
export function nextManilaTime(hhmm: unknown, now = new Date()): Date | null {
  if (typeof hhmm !== "string") return null;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  const manilaNow = new Date(now.getTime() + MANILA_OFFSET_MS);
  const midnightManila = Date.UTC(manilaNow.getUTCFullYear(), manilaNow.getUTCMonth(), manilaNow.getUTCDate());
  let candidate = midnightManila + minutes * 60_000 - MANILA_OFFSET_MS;
  if (candidate <= now.getTime()) candidate += 24 * 60 * 60 * 1000;
  return new Date(candidate);
}

function positive(value: unknown, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > max) return null;
  const rounded = Number(value.toFixed(value < 10 ? 3 : 2));
  return rounded > 0 ? rounded : null;
}

/**
 * Turns the assistant's loose request ({trigger, time} or {trigger, php|kwh,
 * until}) into a concrete rule with server-computed timestamps. The model never
 * supplies raw timestamps. Returns null when the request is incomplete.
 */
export function resolveAutomationRequest(
  raw: { trigger?: unknown; time?: unknown; php?: unknown; kwh?: unknown; until?: unknown },
  now = new Date()
): AutomationRule | null {
  if (raw.trigger === "time") {
    const runAt = nextManilaTime(raw.time, now);
    if (!runAt) return null;
    return {
      trigger: "time",
      run_at: runAt.toISOString(),
      threshold: null,
      ends_at: new Date(runAt.getTime() + TIME_RULE_GRACE_MS).toISOString(),
    };
  }
  if (raw.trigger === "spend" || raw.trigger === "usage") {
    const threshold = raw.trigger === "spend" ? positive(raw.php, MAX_AUTOMATION_PESO) : positive(raw.kwh, MAX_AUTOMATION_KWH);
    if (threshold === null) return null;
    const until = raw.until == null ? null : nextManilaTime(raw.until, now);
    if (raw.until != null && !until) return null;
    const endsAt = until ?? new Date(now.getTime() + DEFAULT_AUTOMATION_WINDOW_MS);
    return { trigger: raw.trigger, run_at: null, threshold, ends_at: endsAt.toISOString() };
  }
  return null;
}

/** "1:00 AM, Sun Nov 8" in Manila time. */
export function formatManilaMoment(iso: string): string {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(date);
  const day = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" }).format(date);
  return `${time}, ${day}`;
}

export function formatPeso(value: number): string {
  return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatKwh(value: number): string {
  return `${value.toLocaleString("en-PH", { maximumFractionDigits: 3 })} kWh`;
}

/** One-line description: "Turn off at 1:00 AM, Sun Nov 8". */
export function describeAutomation(rule: Pick<AutomationRule, "trigger" | "run_at" | "threshold" | "ends_at">): string {
  if (rule.trigger === "time" && rule.run_at) return `Turn off at ${formatManilaMoment(rule.run_at)}`;
  const amount = rule.trigger === "spend" ? formatPeso(rule.threshold ?? 0) : formatKwh(rule.threshold ?? 0);
  return `Turn off after ${amount} more (until ${formatManilaMoment(rule.ends_at)})`;
}

export function isAutomationRule(value: unknown): value is AutomationRule {
  if (!value || typeof value !== "object") return false;
  const rule = value as Record<string, unknown>;
  const validDate = (input: unknown) => typeof input === "string" && Number.isFinite(new Date(input).getTime());
  if (!validDate(rule.ends_at)) return false;
  if (rule.trigger === "time") return validDate(rule.run_at) && rule.threshold === null;
  if (rule.trigger === "spend") return rule.run_at === null && positive(rule.threshold, MAX_AUTOMATION_PESO) !== null;
  if (rule.trigger === "usage") return rule.run_at === null && positive(rule.threshold, MAX_AUTOMATION_KWH) !== null;
  return false;
}

/** A device_automations row as the calendar reads it (device name joined in). */
export type AutomationCalendarRow = {
  id: string;
  trigger_type: AutomationTrigger;
  run_at: string | null;
  threshold: number | string | null;
  ends_at: string;
  status: string;
  executed_at: string | null;
  created_at: string;
  device_name: string;
};

export type CalendarAutomation = {
  id: string;
  /** Manila day, YYYY-MM-DD. */
  dayKey: string;
  deviceName: string;
  /** "Turn off at 1:00 PM, Thu, Nov 12" or "Turn off after ₱50.00 more (...)". */
  label: string;
  /** Set once the rule turned the device off. */
  doneAt: string | null;
};

/**
 * Places active and finished rules on the Manila day they ran, or will run
 * (time rules), or were made (spend/usage rules), keeping only `monthPrefix`
 * ("2026-11"). Cancelled and expired rules are left off the calendar.
 */
export function toCalendarAutomations(rows: AutomationCalendarRow[], monthPrefix: string): CalendarAutomation[] {
  const at = (row: AutomationCalendarRow) => row.executed_at ?? row.run_at ?? row.created_at;
  return rows
    .filter((row) => row.status === "active" || row.status === "done")
    .sort((a, b) => new Date(at(a)).getTime() - new Date(at(b)).getTime())
    .map((row) => ({
      id: row.id,
      dayKey: new Date(new Date(at(row)).getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10),
      deviceName: row.device_name,
      label: describeAutomation({
        trigger: row.trigger_type,
        run_at: row.run_at,
        threshold: row.threshold == null ? null : Number(row.threshold),
        ends_at: row.ends_at,
      }),
      doneAt: row.status === "done" ? row.executed_at : null,
    }))
    .filter((item) => item.dayKey.startsWith(`${monthPrefix}-`));
}
