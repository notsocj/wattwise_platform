import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  getManagerFleetSnapshot,
  getManagerSession,
  type ManagerDevice,
  type ManagerFleetSnapshot,
} from "@/lib/manager-data";

const MANAGER_INSIGHT_TYPES = [
  "manager_fleet_alert",
  "manager_room_anomaly",
  "manager_cutoff_forecast",
  "manager_cost_optimizer",
] as const;

type ManagerInsightType = (typeof MANAGER_INSIGHT_TYPES)[number];

type ManagerInsightCard = {
  type: ManagerInsightType;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "danger";
};

function formatPeso(value: number): string {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getRiskRooms(devices: ManagerDevice[]): ManagerDevice[] {
  return devices
    .filter((device) => device.user_approved_limit_php > 0)
    .sort((first, second) => second.progress_percent - first.progress_percent);
}

function buildFallbackCards(snapshot: ManagerFleetSnapshot): ManagerInsightCard[] {
  const riskRooms = getRiskRooms(snapshot.devices);
  const highestRisk = riskRooms[0] ?? null;
  const topSpend = [...snapshot.devices].sort(
    (first, second) => second.spend_php - first.spend_php
  )[0] ?? null;
  const staleRooms = snapshot.devices.filter((device) => device.is_stale);

  return [
    {
      type: "manager_fleet_alert",
      title: "Fleet Priority",
      severity: snapshot.totals.rooms_at_risk > 0 ? "warning" : "success",
      message:
        snapshot.totals.rooms_at_risk > 0 && highestRisk
          ? `${highestRisk.device_name} ang bantayan ngayon: ${highestRisk.progress_percent.toFixed(0)}% na siya ng ${formatPeso(highestRisk.user_approved_limit_php)} hard limit. I-check si ${highestRisk.tenant_label} bago umabot sa relay cutoff.`
          : `Bida, walang room na nasa 80% hard-limit risk ngayon. Active spend is ${formatPeso(snapshot.totals.spend_php)} across ${snapshot.devices.length} room(s).`,
    },
    {
      type: "manager_room_anomaly",
      title: "Room Anomaly",
      severity: staleRooms.length > 0 ? "warning" : "info",
      message:
        staleRooms.length > 0
          ? `${staleRooms[0].device_name} has stale telemetry, so verify power/Wi-Fi before trusting cutoff decisions for that room.`
          : topSpend
            ? `${topSpend.device_name} has the highest cycle spend at ${formatPeso(topSpend.spend_php)}. Compare it with tenant occupancy and appliance use.`
            : "No room-level anomaly yet because there is not enough paired telemetry.",
    },
    {
      type: "manager_cutoff_forecast",
      title: "Cutoff Forecast",
      severity: highestRisk && highestRisk.progress_percent >= 100 ? "danger" : "warning",
      message:
        highestRisk && highestRisk.progress_percent >= 100
          ? `${highestRisk.device_name} already reached its manager hard limit. Relay state should be reviewed for cutoff or approval handling.`
          : highestRisk
            ? `${highestRisk.device_name} is closest to cutoff at ${highestRisk.progress_percent.toFixed(0)}%. Consider tenant coaching before the next high-use day.`
            : "Set per-room hard limits so WattWise can forecast cutoff risk.",
    },
    {
      type: "manager_cost_optimizer",
      title: "Cost Optimizer",
      severity: "info",
      message:
        topSpend && topSpend.spend_php > 0
          ? `Tipid move: message ${topSpend.tenant_label} about ${topSpend.device_name}. Even small runtime cuts can help keep the room under ${formatPeso(topSpend.user_approved_limit_php)}.`
          : "Pair rooms and assign tenants first so AI can generate room-specific savings moves.",
    },
  ];
}

function parseCards(content: string | null | undefined): ManagerInsightCard[] | null {
  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as { cards?: unknown };
    if (!Array.isArray(parsed.cards)) {
      return null;
    }

    const cards = parsed.cards
      .map((value): ManagerInsightCard | null => {
        if (!value || typeof value !== "object") {
          return null;
        }

        const record = value as Record<string, unknown>;
        if (
          !MANAGER_INSIGHT_TYPES.includes(record.type as ManagerInsightType) ||
          typeof record.title !== "string" ||
          typeof record.message !== "string"
        ) {
          return null;
        }

        const severity =
          record.severity === "success" ||
          record.severity === "warning" ||
          record.severity === "danger"
            ? record.severity
            : "info";

        return {
          type: record.type as ManagerInsightType,
          title: record.title.trim(),
          message: record.message.trim(),
          severity,
        };
      })
      .filter((card): card is ManagerInsightCard => card !== null);

    return cards.length ? cards.slice(0, 4) : null;
  } catch {
    return null;
  }
}

function buildFleetContext(snapshot: ManagerFleetSnapshot) {
  return {
    billing_cycle: {
      start_date: snapshot.billingCycle.startKey,
      end_date: snapshot.billingCycle.endKey,
      elapsed_days: snapshot.billingCycle.elapsedDays,
      total_days: snapshot.billingCycle.totalDays,
    },
    totals: {
      spend_php: Number(snapshot.totals.spend_php.toFixed(2)),
      limit_php: Number(snapshot.totals.limit_php.toFixed(2)),
      rooms_at_risk: snapshot.totals.rooms_at_risk,
      offline_rooms: snapshot.totals.offline_rooms,
      assigned_rooms: snapshot.totals.assigned_rooms,
      vacant_rooms: snapshot.totals.vacant_rooms,
    },
    rooms: snapshot.devices.slice(0, 30).map((device) => ({
      room: device.device_name,
      tenant: device.tenant_label,
      hard_limit_php: Number(device.user_approved_limit_php.toFixed(2)),
      spend_php: Number(device.spend_php.toFixed(2)),
      progress_percent: Number(device.progress_percent.toFixed(1)),
      relay_state: device.relay_state ? "on" : "off",
      budget_status: device.budget_status ?? "ok",
      watts: Math.round(device.watts),
      telemetry_state: device.is_stale ? "stale" : "fresh",
    })),
  };
}

export async function GET() {
  try {
    const session = await getManagerSession();
    if (!session) {
      return NextResponse.json({ error: "Manager access required." }, { status: 403 });
    }

    const { supabase, user, profile } = session;
    const snapshot = await getManagerFleetSnapshot(
      supabase,
      user.id,
      profile.billing_cycle_start_day ?? 1
    );
    const cacheStart = new Date();
    cacheStart.setDate(cacheStart.getDate() - 1);

    const { data: cachedRows } = await supabase
      .from("ai_insights")
      .select("insight_type, message")
      .eq("user_id", user.id)
      .in("insight_type", MANAGER_INSIGHT_TYPES)
      .gte("created_at", cacheStart.toISOString())
      .order("created_at", { ascending: false });

    const cachedCards = new Map<ManagerInsightType, ManagerInsightCard>();
    for (const row of (cachedRows ?? []) as { insight_type: string; message: string }[]) {
      if (cachedCards.has(row.insight_type as ManagerInsightType)) {
        continue;
      }

      const parsed = parseCards(row.message);
      const card = parsed?.find((item) => item.type === row.insight_type);
      if (card) {
        cachedCards.set(card.type, card);
      }
    }

    if (cachedCards.size === MANAGER_INSIGHT_TYPES.length) {
      return NextResponse.json({
        cards: MANAGER_INSIGHT_TYPES.map((type) => cachedCards.get(type)).filter(Boolean),
        cached: true,
      });
    }

    const fallbackCards = buildFallbackCards(snapshot);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        cards: fallbackCards,
        cached: false,
        fallback: true,
      });
    }

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content:
            "You are WattWise Manager Assistant for Filipino boarding-house managers. Write practical Taglish fleet advice using exact room names, tenant labels, peso amounts, hard limits, relay state, and cutoff risk. Respond only as JSON: {\"cards\":[{\"type\":\"manager_fleet_alert|manager_room_anomaly|manager_cutoff_forecast|manager_cost_optimizer\",\"title\":\"string\",\"message\":\"string\",\"severity\":\"info|success|warning|danger\"}]}. Produce exactly one card for each type. Do not suggest direct mutation; tell the manager to use WattWise controls.",
        },
        {
          role: "user",
          content: JSON.stringify(buildFleetContext(snapshot)),
        },
      ],
    });

    const cards = parseCards(completion.choices[0]?.message?.content) ?? fallbackCards;
    const promptTokens = completion.usage?.prompt_tokens ?? 0;
    const completionTokens = completion.usage?.completion_tokens ?? 0;

    await supabase.from("ai_insights").insert(
      cards.map((card) => ({
        user_id: user.id,
        insight_type: card.type,
        message: JSON.stringify({ cards: [card] }),
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
      }))
    );

    return NextResponse.json({ cards, cached: false });
  } catch (error) {
    console.error("manager ai insights error", error);
    return NextResponse.json(
      { error: "Failed to generate manager AI insights." },
      { status: 500 }
    );
  }
}
