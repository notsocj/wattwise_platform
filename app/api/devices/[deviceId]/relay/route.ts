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

  const body = await request.json();
  const { relay_state } = body as { relay_state: boolean };

  if (typeof relay_state !== "boolean") {
    return NextResponse.json(
      { error: "relay_state must be a boolean" },
      { status: 400 }
    );
  }

  // Verify device belongs to authenticated user
  const { data: device, error: fetchError } = await supabase
    .from("devices")
    .select("id")
    .eq("id", deviceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError || !device) {
    return NextResponse.json(
      { error: "Device not found or not owned by you" },
      { status: 404 }
    );
  }

  const { error: updateError } = await supabase
    .from("devices")
    .update({ relay_state })
    .eq("id", deviceId);

  if (updateError) {
    const message = updateError.message?.toLowerCase() ?? "";
    const missingRelayStateColumn =
      updateError.code === "42703" || message.includes("relay_state");

    return NextResponse.json(
      {
        error: missingRelayStateColumn
          ? "Relay control requires devices.relay_state. Run migration 010_add_device_metadata.sql."
          : "Failed to update relay state",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ relay_state });
}
