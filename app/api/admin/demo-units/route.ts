import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, writeAdminAudit } from "@/lib/admin-auth";

function demoMac() {
  const hex = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `02:DE:${hex.slice(0, 2)}:${hex.slice(2, 4)}:${hex.slice(4, 6)}:${hex.slice(6, 8)}`;
}

function numberInRange(value: unknown, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

export async function GET() {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;

  const [{ data: simulations, error: simulationError }, { data: people, error: peopleError }] = await Promise.all([
    auth.admin
      .from("demo_device_simulations")
      .select("device_id,is_active,simulated_watts,simulated_voltage_v,energy_kwh,last_generated_at,created_at,devices(id,device_name,mac_address,owner_id,user_id,tenant_id,appliance_type,relay_state,is_online,last_seen_at)")
      .order("created_at", { ascending: false }),
    auth.admin.from("profiles").select("id,full_name,email,role").order("full_name"),
  ]);

  if (simulationError || peopleError) {
    return NextResponse.json({ error: simulationError?.message ?? peopleError?.message }, { status: 500 });
  }

  return NextResponse.json({ data: simulations ?? [], people: people ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => ({}));
  const deviceName = typeof body.device_name === "string" ? body.device_name.trim() : "";
  const ownerId = typeof body.owner_id === "string" && body.owner_id ? body.owner_id : null;
  const tenantId = typeof body.tenant_id === "string" && body.tenant_id ? body.tenant_id : null;
  const watts = numberInRange(body.simulated_watts, 0, 5000);
  const voltage = numberInRange(body.simulated_voltage_v, 180, 260);

  if (!deviceName || !ownerId || watts === null || voltage === null) {
    return NextResponse.json({ error: "Provide a device name, owner, 0–5,000 watts, and 180–260 volts." }, { status: 400 });
  }

  const { data: owner } = await auth.admin.from("profiles").select("id").eq("id", ownerId).single();
  if (!owner) return NextResponse.json({ error: "Choose a valid owner." }, { status: 400 });
  if (tenantId) {
    const { data: tenant } = await auth.admin.from("profiles").select("id,role").eq("id", tenantId).single();
    if (!tenant || tenant.role !== "tenant") return NextResponse.json({ error: "Choose a valid tenant." }, { status: 400 });
  }

  const { data: device, error: deviceError } = await auth.admin
    .from("devices")
    .insert({
      device_name: deviceName,
      mac_address: demoMac(),
      owner_id: ownerId,
      user_id: ownerId,
      tenant_id: tenantId,
      appliance_type: typeof body.appliance_type === "string" ? body.appliance_type.trim() || "other" : "other",
      relay_state: true,
      is_online: false,
      budget_status: "ok",
    })
    .select("*")
    .single();

  if (deviceError || !device) return NextResponse.json({ error: deviceError?.message ?? "Unable to create demo device." }, { status: 400 });

  const { data: simulation, error: simulationError } = await auth.admin
    .from("demo_device_simulations")
    .insert({
      device_id: device.id,
      created_by: auth.user.id,
      simulated_watts: watts,
      simulated_voltage_v: voltage,
      is_active: false,
    })
    .select("*")
    .single();

  if (simulationError) {
    await auth.admin.from("devices").delete().eq("id", device.id);
    return NextResponse.json({ error: simulationError.message }, { status: 400 });
  }

  await writeAdminAudit(auth.admin, {
    actorId: auth.user.id,
    action: "demo_device_create",
    targetType: "device",
    targetId: device.id,
    reason: typeof body.reason === "string" ? body.reason : "Created virtual demo unit",
    afterState: { device, simulation },
  });

  return NextResponse.json({ data: { ...simulation, devices: device } }, { status: 201 });
}
