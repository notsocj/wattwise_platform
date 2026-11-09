import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-context";
import { parseDeviceEdit } from "@/lib/device-edit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type OwnedDevice = { id: string; mac_address: string; device_name: string };

/**
 * Loads a device the signed-in homeowner or manager owns. Tenants rent units and
 * super admins use the audited admin console, so neither may edit or remove here.
 */
async function loadOwnedDevice(deviceId: string) {
  const user = await getSessionUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const supabase = await createClient();
  const role =
    user.role ??
    (await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: string | null }>()).data?.role ??
    null;
  if (role === "tenant" || role === "super_admin") {
    return {
      response: NextResponse.json(
        { error: role === "tenant" ? "Only the unit's owner can change it." : "Use the admin console to manage units." },
        { status: 403 }
      ),
    };
  }

  const { data: device } = await supabase
    .from("devices")
    .select("id, mac_address, device_name")
    .eq("id", deviceId)
    .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`)
    .maybeSingle<OwnedDevice>();
  if (!device) {
    return { response: NextResponse.json({ error: "Unit not found or not owned by you." }, { status: 404 }) };
  }
  return { supabase, user, device };
}

/** Rename a unit and optionally change its appliance type. */
export async function PATCH(request: NextRequest, props: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await props.params;
  const parsed = parseDeviceEdit(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const owned = await loadOwnedDevice(deviceId);
  if ("response" in owned) return owned.response;

  const { data, error } = await owned.supabase
    .from("devices")
    .update(parsed.edit)
    .eq("id", owned.device.id)
    .select("id, device_name, appliance_type, appliance_detail")
    .single();
  if (error) return NextResponse.json({ error: "We couldn't save the changes. Try again." }, { status: 500 });

  return NextResponse.json({ device: data });
}

/**
 * Remove a unit from the account. Its readings go too: energy_logs has no
 * foreign key and is keyed by UUID or MAC, so leftover MAC rows would show up
 * for whoever registers the same hardware next. Budget, usage, and automation
 * rows cascade with the device.
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await props.params;
  const body = await request.json().catch(() => ({}));
  if ((body as { confirmed?: unknown }).confirmed !== true) {
    return NextResponse.json({ error: "Confirm that you want to remove this unit." }, { status: 400 });
  }

  const owned = await loadOwnedDevice(deviceId);
  if ("response" in owned) return owned.response;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Removing units is not configured yet." }, { status: 500 });
  }

  const { data: demo } = await admin
    .from("demo_device_simulations")
    .select("device_id")
    .eq("device_id", owned.device.id)
    .maybeSingle();
  if (demo) {
    return NextResponse.json({ error: "This is a demo unit. Ask an admin to remove it." }, { status: 409 });
  }

  // Readings first: if the device delete then fails, a retry still finds the unit.
  const { error: logsError } = await admin
    .from("energy_logs")
    .delete()
    .in("device_id", [owned.device.id, owned.device.mac_address]);
  if (logsError) return NextResponse.json({ error: "We couldn't remove this unit's readings. Try again." }, { status: 500 });

  const { error: deviceError } = await owned.supabase.from("devices").delete().eq("id", owned.device.id);
  if (deviceError) return NextResponse.json({ error: "We couldn't remove this unit. Try again." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
