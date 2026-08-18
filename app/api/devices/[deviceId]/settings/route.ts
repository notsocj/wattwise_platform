import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();

  if (profile?.role === "tenant") {
    return NextResponse.json(
      { error: "Tenants cannot edit device safety settings." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const autoCutoffEnabled = (body as { auto_cutoff_enabled?: unknown })
    .auto_cutoff_enabled;

  if (typeof autoCutoffEnabled !== "boolean") {
    return NextResponse.json(
      { error: "auto_cutoff_enabled must be a boolean." },
      { status: 400 }
    );
  }

  const { data: device, error: fetchError } = await supabase
    .from("devices")
    .select("id, user_approved_limit_php")
    .eq("id", deviceId)
    .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`)
    .maybeSingle();

  if (fetchError || !device) {
    return NextResponse.json(
      { error: "Device not found or not owned by you." },
      { status: 404 }
    );
  }

  const limit = Number(device.user_approved_limit_php ?? 0);
  if (!Number.isFinite(limit) || limit <= 0) {
    return NextResponse.json(
      { error: "Set a positive approved limit before configuring automatic shutoff." },
      { status: 409 }
    );
  }

  const { data: result, error: updateError } = await supabase.rpc(
    "apply_device_budget_settings",
    {
      p_device_id: deviceId,
      p_limit_php: limit,
      p_auto_cutoff_enabled: autoCutoffEnabled,
    }
  );

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to save device safety setting." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    auto_cutoff_enabled: autoCutoffEnabled,
    device: Array.isArray(result) ? result[0] ?? null : result,
  });
}
