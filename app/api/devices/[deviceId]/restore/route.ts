import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();
  if (profile?.role === "tenant" || profile?.role === "super_admin") {
    return NextResponse.json(
      {
        error:
          profile.role === "tenant"
            ? "Tenants cannot restore device power."
            : "Use the audited admin relay control for administrator overrides.",
      },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  if ((body as { confirmed?: unknown }).confirmed !== true) {
    return NextResponse.json(
      { error: "Confirm that you want to restore appliance power." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("restore_device_power", {
    p_device_id: deviceId,
    p_confirmed: true,
  });

  if (error) {
    const blocked = error.message
      .toLowerCase()
      .includes("disable automatic shutoff or raise");
    return NextResponse.json(
      {
        error: blocked
          ? "Disable automatic shutoff or raise the approved limit before restoring power."
          : "Power could not be restored for this device.",
      },
      { status: blocked ? 409 : 400 }
    );
  }

  return NextResponse.json({
    device: Array.isArray(data) ? data[0] ?? null : data,
  });
}
