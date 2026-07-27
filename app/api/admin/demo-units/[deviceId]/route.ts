import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, writeAdminAudit } from "@/lib/admin-auth";

function numberInRange(value: unknown, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { deviceId } = await params;
  const body = await request.json().catch(() => ({}));

  const [{ data: beforeSimulation }, { data: beforeDevice }] = await Promise.all([
    auth.admin.from("demo_device_simulations").select("*").eq("device_id", deviceId).single(),
    auth.admin.from("devices").select("*").eq("id", deviceId).single(),
  ]);
  if (!beforeSimulation || !beforeDevice) return NextResponse.json({ error: "Demo unit not found." }, { status: 404 });

  const simulationUpdate: Record<string, unknown> = {};
  if (typeof body.is_active === "boolean") simulationUpdate.is_active = body.is_active;
  if (body.simulated_watts !== undefined) {
    const watts = numberInRange(body.simulated_watts, 0, 5000);
    if (watts === null) return NextResponse.json({ error: "Watts must be between 0 and 5,000." }, { status: 400 });
    simulationUpdate.simulated_watts = watts;
  }
  if (body.simulated_voltage_v !== undefined) {
    const voltage = numberInRange(body.simulated_voltage_v, 180, 260);
    if (voltage === null) return NextResponse.json({ error: "Voltage must be between 180 and 260." }, { status: 400 });
    simulationUpdate.simulated_voltage_v = voltage;
  }
  if (body.reset_energy === true) {
    simulationUpdate.energy_kwh = 0;
    simulationUpdate.last_generated_at = null;
  }
  if (Object.keys(simulationUpdate).length) simulationUpdate.updated_at = new Date().toISOString();

  const deviceUpdate: Record<string, unknown> = {};
  for (const key of ["owner_id", "tenant_id", "device_name", "appliance_type"]) {
    if (body[key] !== undefined) deviceUpdate[key] = body[key] || null;
  }
  if (deviceUpdate.owner_id !== undefined) deviceUpdate.user_id = deviceUpdate.owner_id;

  const [simulationResult, deviceResult] = await Promise.all([
    Object.keys(simulationUpdate).length
      ? auth.admin.from("demo_device_simulations").update(simulationUpdate).eq("device_id", deviceId).select("*").single()
      : Promise.resolve({ data: beforeSimulation, error: null }),
    Object.keys(deviceUpdate).length
      ? auth.admin.from("devices").update(deviceUpdate).eq("id", deviceId).select("*").single()
      : Promise.resolve({ data: beforeDevice, error: null }),
  ]);
  if (simulationResult.error || deviceResult.error) {
    return NextResponse.json({ error: simulationResult.error?.message ?? deviceResult.error?.message }, { status: 400 });
  }

  await writeAdminAudit(auth.admin, {
    actorId: auth.user.id,
    action: body.reset_energy === true ? "demo_device_reset" : "demo_device_update",
    targetType: "device",
    targetId: deviceId,
    reason: typeof body.reason === "string" ? body.reason : null,
    beforeState: { device: beforeDevice, simulation: beforeSimulation },
    afterState: { device: deviceResult.data, simulation: simulationResult.data },
  });
  return NextResponse.json({ data: { device: deviceResult.data, simulation: simulationResult.data } });
}
