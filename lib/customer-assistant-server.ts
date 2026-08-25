import "server-only";

import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentBillingCycle, getManilaDayKey } from "@/lib/date-utils";
import {
  computeHistoricalVariableSpendByDeviceFromDayRows,
  getMeralcoRatesForRange,
} from "@/lib/meralco-rates";
import {
  CUSTOMER_ASSISTANT_PROPOSAL_TTL_MS,
  MAX_PESO_VALUE,
  validatePesoValue,
} from "@/lib/customer-assistant-policy";
import type {
  CustomerAssistantProposal,
  CustomerRole,
} from "@/lib/customer-assistant-types";
import {
  buildDeviceDisplay,
  type CustomerAssistantDisplay,
} from "@/lib/customer-assistant-grounding";

type ProfileRow = {
  role: string | null;
  monthly_budget_php: number | string | null;
  billing_cycle_start_day: number | null;
};

type DeviceRow = {
  id: string;
  device_name: string;
  owner_id: string | null;
  user_id: string | null;
  tenant_id: string | null;
  user_approved_limit_php: number | string | null;
  require_approval_on_expiry: boolean | null;
  budget_status: string | null;
};

type UsageRow = { device_id: string; variable_spend_php: number | string | null };
type UsageByDayRow = {
  device_id: string;
  day_key: string;
  usage_kwh: number | string;
};
type ReadingRow = {
  device_id: string;
  average_watts: number | string | null;
  voltage_v: number | string | null;
  recorded_at: string | null;
};

export type CustomerAssistantContext = {
  role: CustomerRole;
  home_budget_php: number;
  billing_cycle: { start: string; end: string };
  calendar_month_label: string;
  calendar_month_data_available: boolean;
  preferences: { push: boolean; email: boolean };
  devices: Array<{
    ref: string;
    id: string;
    name: string;
    manageable: boolean;
    limit_php: number;
    spend_php: number;
    calendar_month_spend_php: number;
    progress_percent: number;
    auto_cutoff_enabled: boolean;
    budget_status: string;
    current_watts: number;
    telemetry_state: "fresh" | "stale";
  }>;
};

function numberValue(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function buildCustomerAssistantContext(
  supabase: SupabaseClient,
  userId: string,
  profile: ProfileRow & { role: CustomerRole }
): Promise<CustomerAssistantContext> {
  const { data: deviceData } = await supabase
    .from("devices")
    .select("id,device_name,owner_id,user_id,tenant_id,user_approved_limit_php,require_approval_on_expiry,budget_status")
    .or(`owner_id.eq.${userId},user_id.eq.${userId},tenant_id.eq.${userId}`)
    .order("created_at", { ascending: true })
    .limit(30);
  const devices = (deviceData ?? []) as DeviceRow[];
  let billingStartDay = profile.billing_cycle_start_day ?? 1;
  if (profile.role === "tenant") {
    const ownerId = devices[0]?.owner_id ?? devices[0]?.user_id;
    if (ownerId) {
      const { data: owner } = await supabase
        .from("profiles")
        .select("billing_cycle_start_day")
        .eq("id", ownerId)
        .maybeSingle<{ billing_cycle_start_day: number | null }>();
      billingStartDay = owner?.billing_cycle_start_day ?? billingStartDay;
    }
  }
  const cycle = getCurrentBillingCycle(billingStartDay);
  const cycleStart = getManilaDayKey(cycle.startDate);
  const nowKey = getManilaDayKey(new Date());
  const [year, month] = nowKey.split("-");
  const calendarMonthStart = new Date(`${year}-${month}-01T00:00:00+08:00`);
  const calendarMonthEnd = new Date();
  const [usageResult, readingsResult, preferencesResult, calendarUsageResult, calendarRates] = await Promise.all([
    supabase
      .from("device_month_usage")
      .select("device_id,variable_spend_php")
      .eq("month_start", cycleStart),
    devices.length
      ? supabase.rpc("get_latest_device_readings", { p_user_id: userId })
      : Promise.resolve({ data: [] }),
    supabase
      .from("notification_preferences")
      .select("budget_push_enabled,budget_email_enabled")
      .eq("user_id", userId)
      .maybeSingle<{ budget_push_enabled: boolean; budget_email_enabled: boolean }>(),
    devices.length
      ? supabase.rpc("get_usage_kwh_by_device_day", {
          p_user_id: userId,
          p_start: calendarMonthStart.toISOString(),
          p_end: calendarMonthEnd.toISOString(),
        })
      : Promise.resolve({ data: [] }),
    devices.length
      ? getMeralcoRatesForRange(supabase, calendarMonthStart, calendarMonthEnd)
      : Promise.resolve([]),
  ]);
  const spendByDevice = new Map(
    ((usageResult.data ?? []) as UsageRow[]).map((row) => [row.device_id, numberValue(row.variable_spend_php)])
  );
  const readingsByDevice = new Map(
    ((readingsResult.data ?? []) as ReadingRow[]).map((row) => [row.device_id, row])
  );
  const calendarUsageRows = (calendarUsageResult.data ?? []) as UsageByDayRow[];
  // Match Calendar Analytics exactly: use the applicable Meralco rate for every day,
  // not a single current rate. An unavailable/empty RPC result is kept distinct from
  // a genuine zero-spend month so the assistant never invents a "no usage" answer.
  const calendarSpendByDevice = computeHistoricalVariableSpendByDeviceFromDayRows(
    calendarUsageRows,
    calendarRates
  );
  const now = Date.now();

  return {
    role: profile.role,
    home_budget_php: numberValue(profile.monthly_budget_php),
    billing_cycle: { start: cycleStart, end: getManilaDayKey(cycle.endDate) },
    calendar_month_label: new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" }).format(new Date()),
    calendar_month_data_available: calendarUsageRows.length > 0,
    preferences: {
      push: preferencesResult.data?.budget_push_enabled === true,
      email: preferencesResult.data?.budget_email_enabled !== false,
    },
    devices: devices.map((device, index) => {
      const limit = numberValue(device.user_approved_limit_php);
      const spend = spendByDevice.get(device.id) ?? 0;
      const reading = readingsByDevice.get(device.id);
      const readingTime = reading?.recorded_at ? new Date(reading.recorded_at).getTime() : 0;
      return {
        ref: `device_${index + 1}`,
        id: device.id,
        name: device.device_name,
        manageable: profile.role === "user" && (device.owner_id === userId || device.user_id === userId),
        limit_php: Number(limit.toFixed(2)),
        spend_php: Number(spend.toFixed(2)),
        calendar_month_spend_php: Number((calendarSpendByDevice.get(device.id) ?? 0).toFixed(2)),
        progress_percent: limit > 0 ? Number(Math.min(999, (spend / limit) * 100).toFixed(1)) : 0,
        auto_cutoff_enabled: device.require_approval_on_expiry === false,
        budget_status: device.budget_status ?? "ok",
        current_watts: Math.max(0, Math.round(numberValue(reading?.average_watts))),
        telemetry_state: readingTime > 0 && now - readingTime <= 20_000 ? "fresh" : "stale",
      };
    }),
  };
}

type ModelAction = {
  type?: unknown;
  value?: unknown;
  device_ref?: unknown;
  channel?: unknown;
  enabled?: unknown;
};

function peso(value: number): string {
  return `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function resolveModelProposal(
  rawAction: unknown,
  context: CustomerAssistantContext,
  now = new Date()
): { proposal: CustomerAssistantProposal | null; refusal?: string } {
  if (!rawAction || typeof rawAction !== "object") return { proposal: null };
  const action = rawAction as ModelAction;
  const expires_at = new Date(now.getTime() + CUSTOMER_ASSISTANT_PROPOSAL_TTL_MS).toISOString();
  if (action.type === "set_notification_preference") {
    if ((action.channel !== "push" && action.channel !== "email") || typeof action.enabled !== "boolean") {
      return { proposal: null };
    }
    const before = context.preferences[action.channel];
    const channelName = action.channel === "push" ? "Push alerts" : "Critical email";
    return {
      proposal: {
        action: { type: action.type, channel: action.channel, enabled: action.enabled },
        title: `Turn ${action.enabled ? "on" : "off"} ${channelName.toLowerCase()}`,
        subject: channelName,
        current_value: before ? "Enabled" : "Disabled",
        proposed_value: action.enabled ? "Enabled" : "Disabled",
        consequence: action.enabled
          ? `WattWise may send ${action.channel === "push" ? "80% and 100% alerts" : "critical 100% alerts"} through this channel.`
          : `You will no longer receive ${action.channel === "push" ? "budget push alerts" : "critical budget emails"} through this channel.`,
        expires_at,
      },
    };
  }

  if (context.role === "tenant") {
    return { proposal: null, refusal: "Tenant account ito, kaya advisory lang ang home budget, device limit, at automatic cutoff changes. Your own notification preferences lang ang puwedeng baguhin dito." };
  }

  if (action.type === "update_home_budget") {
    const value = validatePesoValue(action.value);
    if (value === null) return { proposal: null };
    return {
      proposal: {
        action: { type: action.type, value },
        title: "Update home budget",
        subject: "Monthly home budget",
        current_value: peso(context.home_budget_php),
        proposed_value: peso(value),
        consequence: "This changes your dashboard budget target. It does not directly change device limits or relay power.",
        expires_at,
      },
    };
  }

  if (action.type === "update_device_limit" || action.type === "set_auto_cutoff") {
    if (typeof action.device_ref !== "string") return { proposal: null };
    const device = context.devices.find((item) => item.ref === action.device_ref);
    if (!device) return { proposal: null, refusal: "Hindi ko matukoy kung aling device. Sabihin ang exact device name bago tayo gumawa ng change." };
    if (!device.manageable) return { proposal: null, refusal: `Advisory-only ang controls mo para sa ${device.name}; the device owner must confirm safety-setting changes.` };
    if (action.type === "update_device_limit") {
      const value = validatePesoValue(action.value);
      if (value === null) return { proposal: null };
      return {
        proposal: {
          action: { type: action.type, device_id: device.id, value },
          title: "Update device limit",
          subject: device.name,
          current_value: peso(device.limit_php),
          proposed_value: peso(value),
          consequence: device.auto_cutoff_enabled && device.spend_php >= value
            ? "Important: current spend already meets this limit, so confirmation may automatically turn the device off."
            : "Future 50%, 80%, and 100% budget thresholds will use this new device limit.",
          expires_at,
        },
      };
    }
    if (typeof action.enabled !== "boolean") return { proposal: null };
    return {
      proposal: {
        action: { type: action.type, device_id: device.id, enabled: action.enabled },
        title: `${action.enabled ? "Enable" : "Disable"} automatic cutoff`,
        subject: device.name,
        current_value: device.auto_cutoff_enabled ? "Enabled" : "Approval required",
        proposed_value: action.enabled ? "Enabled" : "Approval required",
        consequence: action.enabled
          ? "At 100%, WattWise may turn this device off automatically. If it is already over limit, confirmation may turn it off now."
          : "At 100%, WattWise will request approval and keep power on instead of automatically cutting off.",
        expires_at,
      },
    };
  }
  return { proposal: null };
}

export function resolveModelDisplay(
  value: unknown,
  context: CustomerAssistantContext
): CustomerAssistantDisplay | null {
  if (!value || typeof value !== "object") return null;
  const display = value as { type?: unknown; device_refs?: unknown; title?: unknown };
  if (display.type !== "device_list" || !Array.isArray(display.device_refs)) return null;
  const refs = display.device_refs.filter((ref): ref is string => typeof ref === "string").slice(0, 8);
  const title = typeof display.title === "string" && display.title.trim()
    ? display.title.trim().slice(0, 80)
    : "Relevant devices";
  return buildDeviceDisplay(context.devices, title, refs);
}

export function buildFallbackReply(message: string, context: CustomerAssistantContext): string {
  const highest = [...context.devices].sort((a, b) => b.progress_percent - a.progress_percent)[0];
  if (!highest) return "Wala pang device data sa account mo. Add or assign a device first, then matutulungan kitang mag-check ng usage at budget.";
  const normalized = message.toLowerCase();
  if (normalized.includes("budget") || normalized.includes("bill")) {
    return `${highest.name} ang pinakamalapit sa limit: ${peso(highest.spend_php)} spent of ${peso(highest.limit_php)} (${highest.progress_percent.toFixed(0)}%). ${highest.telemetry_state === "stale" ? "Stale ang latest live reading, so check kung online ang device." : `Latest draw is about ${highest.current_watts} W.`}`;
  }
  return `${highest.name} is currently at ${highest.progress_percent.toFixed(0)}% of its device limit. For savings, check high-wattage appliances and reduce unnecessary runtime. AI is temporarily unavailable, but this answer uses your current WattWise data.`;
}

export async function generateCustomerAssistantReply(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  context: CustomerAssistantContext
): Promise<{ reply: string; rawAction: unknown; rawDisplay: unknown; fallback: boolean }> {
  if (!process.env.OPENAI_API_KEY) {
    return { reply: buildFallbackReply(message, context), rawAction: null, rawDisplay: null, fallback: true };
  }
  const safeContext = {
    role: context.role,
    home_budget_php: context.home_budget_php,
    billing_cycle: context.billing_cycle,
    calendar_month_label: context.calendar_month_label,
    preferences: context.preferences,
    devices: context.devices.map((device) => ({
      ref: device.ref,
      name: device.name,
      manageable: device.manageable,
      limit_php: device.limit_php,
      spend_php: device.spend_php,
      calendar_month_spend_php: device.calendar_month_spend_php,
      progress_percent: device.progress_percent,
      auto_cutoff_enabled: device.auto_cutoff_enabled,
      budget_status: device.budget_status,
      current_watts: device.current_watts,
      telemetry_state: device.telemetry_state,
    })),
  };
  try {
    const completion = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are WattWise Customer Assistant. Speak concise, casual, practical Taglish. Use only the supplied account context. When the answer concerns usage, bills, budgets, or devices, cite exact device names and current numbers instead of asking the user to guess. Return strict JSON with all three keys: {"reply":"...","action":null,"display":null}. To show device cards, use "display":{"type":"device_list","title":"...","device_refs":["device_1"]}. Use cards when listing, comparing, or discussing specific devices. Action may be null or one of: {"type":"update_home_budget","value":number}, {"type":"update_device_limit","device_ref":"device_1","value":number}, {"type":"set_auto_cutoff","device_ref":"device_1","enabled":boolean}, {"type":"set_notification_preference","channel":"push|email","enabled":boolean}. Never guess a device or peso amount; ask a clarifying question only when the requested target is genuinely absent or ambiguous. A proposal is only a review request, never claim it was applied. Tenants may only propose notification preference changes. Never propose relay control, account/password changes, billing-cycle changes, Wi-Fi/pairing, deletion, or power restoration. Peso values must be > 0 and <= ${MAX_PESO_VALUE}.`,
        },
        { role: "user", content: `Current account context:\n${JSON.stringify(safeContext)}` },
        ...history.slice(-6).map((item) => ({ role: item.role, content: item.content.slice(0, 1000) })),
        { role: "user", content: message.slice(0, 1000) },
      ],
    });
    const text = completion.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(text) as { reply?: unknown; action?: unknown; display?: unknown };
    if (typeof parsed.reply !== "string" || !parsed.reply.trim()) throw new Error("Invalid AI response");
    return { reply: parsed.reply.trim(), rawAction: parsed.action ?? null, rawDisplay: parsed.display ?? null, fallback: false };
  } catch (error) {
    console.error("customer assistant generation error", error);
    return { reply: buildFallbackReply(message, context), rawAction: null, rawDisplay: null, fallback: true };
  }
}

export type { ProfileRow };
