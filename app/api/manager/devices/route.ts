import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/;

function normalizeMac(value: string): string {
  return value.trim().replace(/-/g, ":").toUpperCase();
}

export async function POST(request: NextRequest) {
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

  if (profile?.role !== "manager") {
    return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    device_name?: unknown;
    mac_address?: unknown;
  };
  const deviceName = typeof body.device_name === "string" ? body.device_name.trim() : "";
  const macAddress =
    typeof body.mac_address === "string" ? normalizeMac(body.mac_address) : "";

  if (!deviceName) {
    return NextResponse.json({ error: "Device name is required." }, { status: 400 });
  }

  if (!MAC_REGEX.test(macAddress)) {
    return NextResponse.json({ error: "Enter a valid MAC address." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("devices")
    .insert({
      owner_id: user.id,
      user_id: user.id,
      device_name: deviceName,
      mac_address: macAddress,
      relay_state: true,
      budget_status: "ok",
      require_approval_on_expiry: true,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    const duplicate = error?.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "This MAC address is already registered." : "Failed to pair device." },
      { status: duplicate ? 409 : 500 }
    );
  }

  return NextResponse.json({ id: data.id });
}
