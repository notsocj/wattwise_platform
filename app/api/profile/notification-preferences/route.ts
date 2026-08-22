import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PreferenceRow = {
  onesignal_external_id: string;
  budget_push_enabled: boolean;
  budget_email_enabled: boolean;
};

const allowedKeys = new Set(["budget_push_enabled", "budget_email_enabled"]);

function responsePayload(preferences: PreferenceRow) {
  return {
    preferences: {
      budget_push_enabled: preferences.budget_push_enabled,
      budget_email_enabled: preferences.budget_email_enabled,
    },
    identity: {
      onesignal_external_id: preferences.onesignal_external_id,
    },
    availability: {
      push: Boolean(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID),
      email: "edge_function_configuration_required" as const,
    },
  };
}

async function authenticatedPreferences() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "unauthorized" as const };

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("onesignal_external_id,budget_push_enabled,budget_email_enabled")
    .eq("user_id", user.id)
    .maybeSingle<PreferenceRow>();

  if (error || !data) return { error: "not_ready" as const };
  return { supabase, user, preferences: data };
}

export async function GET() {
  const result = await authenticatedPreferences();

  if (result.error === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (result.error === "not_ready" || !result.preferences) {
    return NextResponse.json(
      { error: "Notification settings are not ready. Apply the latest database migration first." },
      { status: 503 }
    );
  }

  return NextResponse.json(responsePayload(result.preferences));
}

export async function PATCH(request: NextRequest) {
  const result = await authenticatedPreferences();

  if (result.error === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (result.error === "not_ready" || !result.preferences || !result.supabase || !result.user) {
    return NextResponse.json(
      { error: "Notification settings are not ready. Apply the latest database migration first." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "A JSON settings object is required." }, { status: 400 });
  }

  const entries = Object.entries(body);
  if (entries.length === 0 || entries.some(([key]) => !allowedKeys.has(key))) {
    return NextResponse.json(
      { error: "Only budget push and critical email preferences can be changed." },
      { status: 400 }
    );
  }

  if (entries.some(([, value]) => typeof value !== "boolean")) {
    return NextResponse.json(
      { error: "Notification preference values must be boolean." },
      { status: 400 }
    );
  }

  const updates: Partial<Pick<PreferenceRow, "budget_push_enabled" | "budget_email_enabled">> = {};
  if ("budget_push_enabled" in body) {
    updates.budget_push_enabled = (body as { budget_push_enabled: boolean })
      .budget_push_enabled;
  }
  if ("budget_email_enabled" in body) {
    updates.budget_email_enabled = (body as { budget_email_enabled: boolean })
      .budget_email_enabled;
  }

  const { data, error } = await result.supabase
    .from("notification_preferences")
    .update(updates)
    .eq("user_id", result.user.id)
    .select("onesignal_external_id,budget_push_enabled,budget_email_enabled")
    .single<PreferenceRow>();

  if (error || !data) {
    return NextResponse.json(
      { error: "We could not save your notification settings right now." },
      { status: 500 }
    );
  }

  return NextResponse.json(responsePayload(data));
}

