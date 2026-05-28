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
  const requireApproval = (body as { require_approval_on_expiry?: unknown })
    .require_approval_on_expiry;

  if (typeof requireApproval !== "boolean") {
    return NextResponse.json(
      { error: "require_approval_on_expiry must be a boolean." },
      { status: 400 }
    );
  }

  const { data: device, error: fetchError } = await supabase
    .from("devices")
    .select("id")
    .eq("id", deviceId)
    .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`)
    .maybeSingle();

  if (fetchError || !device) {
    return NextResponse.json(
      { error: "Device not found or not owned by you." },
      { status: 404 }
    );
  }

  const { error: updateError } = await supabase
    .from("devices")
    .update({ require_approval_on_expiry: requireApproval })
    .eq("id", deviceId)
    .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to save device safety setting." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    require_approval_on_expiry: requireApproval,
  });
}
