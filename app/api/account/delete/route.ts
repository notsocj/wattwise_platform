import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type DeviceKeyRow = {
  id: string;
  mac_address: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const confirmation =
    typeof body?.confirm === "string" ? body.confirm.trim().toUpperCase() : "";

  if (confirmation !== "DELETE") {
    return NextResponse.json(
      { error: "Deletion confirmation is required." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: devices, error: devicesError } = await admin
    .from("devices")
    .select("id, mac_address")
    .eq("user_id", user.id);

  if (devicesError) {
    return NextResponse.json(
      { error: "Unable to load devices for deletion." },
      { status: 500 }
    );
  }

  const deviceKeys = new Set<string>();
  for (const device of (devices ?? []) as DeviceKeyRow[]) {
    if (device.id) {
      deviceKeys.add(device.id);
    }
    if (device.mac_address) {
      deviceKeys.add(device.mac_address);
    }
  }

  if (deviceKeys.size > 0) {
    const { error: energyDeleteError } = await admin
      .from("energy_logs")
      .delete()
      .in("device_id", Array.from(deviceKeys));

    if (energyDeleteError) {
      return NextResponse.json(
        { error: "Unable to delete energy history." },
        { status: 500 }
      );
    }
  }

  const { error: profileDeleteError } = await admin
    .from("profiles")
    .delete()
    .eq("id", user.id);

  if (profileDeleteError) {
    return NextResponse.json(
      { error: "Unable to delete profile data." },
      { status: 500 }
    );
  }

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id);

  if (authDeleteError) {
    return NextResponse.json(
      { error: "Unable to delete authentication account." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
