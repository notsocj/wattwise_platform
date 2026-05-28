import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  getManagerFleetSnapshot,
  getManagerSession,
  type ManagerFleetSnapshot,
} from "@/lib/manager-data";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    (record.role === "user" || record.role === "assistant") &&
    typeof record.content === "string" &&
    record.content.trim().length > 0
  );
}

function buildContext(snapshot: ManagerFleetSnapshot) {
  return {
    billing_cycle: {
      start_date: snapshot.billingCycle.startKey,
      end_date: snapshot.billingCycle.endKey,
      elapsed_days: snapshot.billingCycle.elapsedDays,
      total_days: snapshot.billingCycle.totalDays,
    },
    fleet_totals: {
      spend_php: Number(snapshot.totals.spend_php.toFixed(2)),
      limit_php: Number(snapshot.totals.limit_php.toFixed(2)),
      rooms_at_risk: snapshot.totals.rooms_at_risk,
      offline_rooms: snapshot.totals.offline_rooms,
      assigned_rooms: snapshot.totals.assigned_rooms,
      vacant_rooms: snapshot.totals.vacant_rooms,
    },
    rooms: snapshot.devices.slice(0, 30).map((device) => ({
      id: device.id,
      room: device.device_name,
      mac_address: device.mac_address,
      tenant: device.tenant_label,
      tenant_email: device.tenant_email,
      hard_limit_php: Number(device.user_approved_limit_php.toFixed(2)),
      spend_php: Number(device.spend_php.toFixed(2)),
      progress_percent: Number(device.progress_percent.toFixed(1)),
      relay_state: device.relay_state ? "on" : "off",
      budget_status: device.budget_status ?? "ok",
      current_watts: Math.round(device.watts),
      voltage_v: Math.round(device.volts),
      current_a: Number(device.amps.toFixed(2)),
      telemetry_state: device.is_stale ? "stale" : "fresh",
    })),
  };
}

function buildFallbackReply(snapshot: ManagerFleetSnapshot): string {
  const riskRoom = [...snapshot.devices]
    .filter((device) => device.user_approved_limit_php > 0)
    .sort((first, second) => second.progress_percent - first.progress_percent)[0];

  if (riskRoom) {
    return `${riskRoom.device_name} ang pinaka-priority ngayon: ${riskRoom.progress_percent.toFixed(0)}% na ng hard limit at ${riskRoom.relay_state ? "ON" : "OFF"} ang relay. I-review muna sa Rooms tab bago mag-adjust ng limit or relay.`;
  }

  return "Wala pang strong room risk signal. Pair rooms, assign tenants, and set hard limits para makapagbigay ako ng mas specific na manager advice.";
}

export async function POST(request: NextRequest) {
  try {
    const session = await getManagerSession();
    if (!session) {
      return NextResponse.json({ error: "Manager access required." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      messages?: unknown;
      message?: unknown;
    };
    const messages = Array.isArray(body.messages)
      ? body.messages.filter(isChatMessage).slice(-8)
      : typeof body.message === "string"
        ? [{ role: "user" as const, content: body.message }]
        : [];

    if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
      return NextResponse.json({ error: "A user message is required." }, { status: 400 });
    }

    const { supabase, user, profile } = session;
    const snapshot = await getManagerFleetSnapshot(
      supabase,
      user.id,
      profile.billing_cycle_start_day ?? 1
    );
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        message: buildFallbackReply(snapshot),
        fallback: true,
      });
    }

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      max_tokens: 420,
      messages: [
        {
          role: "system",
          content:
            "You are WattWise Manager Assistant. Speak practical Taglish for a Filipino boarding-house/property manager. You can explain fleet usage, tenant room spend, hard limits, cutoff risk, stale telemetry, and relay status. You are advisory-only: never claim you changed limits, assignments, tenants, or relays. If asked to perform a mutation, tell the manager to use the proper WattWise control and summarize the safest action. Never expose data outside the provided manager-owned fleet context.",
        },
        {
          role: "user",
          content: `Current manager fleet context:\n${JSON.stringify(buildContext(snapshot))}`,
        },
        ...messages.map((message) => ({
          role: message.role,
          content: message.content.slice(0, 1000),
        })),
      ],
    });

    return NextResponse.json({
      message:
        completion.choices[0]?.message?.content?.trim() ||
        buildFallbackReply(snapshot),
    });
  } catch (error) {
    console.error("manager ai chat error", error);
    return NextResponse.json(
      { error: "Failed to chat with WattWise Manager Assistant." },
      { status: 500 }
    );
  }
}
