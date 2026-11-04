import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, writeAdminAudit } from "@/lib/admin-auth";
import { buildDemoSimulationUpdate } from "@/lib/demo-units";

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

  const simulationChange = buildDemoSimulationUpdate(body);
  if ("error" in simulationChange) {
    return NextResponse.json({ error: simulationChange.error }, { status: 400 });
  }
  const simulationUpdate = simulationChange.update;

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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { deviceId } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.confirm !== true) return NextResponse.json({ error: "Confirm deletion of this demo unit." }, { status: 400 });

  const [{ data: simulation }, { data: device }] = await Promise.all([
    auth.admin.from("demo_device_simulations").select("*").eq("device_id", deviceId).single(),
    auth.admin.from("devices").select("*").eq("id", deviceId).single(),
  ]);
  if (!simulation || !device) return NextResponse.json({ error: "Demo unit not found." }, { status: 404 });

  const { count: telemetryCount, error: telemetryError } = await auth.admin
    .from("energy_logs")
    .delete({ count: "exact" })
    .in("device_id", [device.id, device.mac_address]);
  if (telemetryError) return NextResponse.json({ error: "Unable to remove demo telemetry." }, { status: 500 });

  const { error: deviceError } = await auth.admin.from("devices").delete().eq("id", deviceId);
  if (deviceError) return NextResponse.json({ error: "Unable to delete the demo unit." }, { status: 500 });

  await writeAdminAudit(auth.admin, {
    actorId: auth.user.id,
    action: "demo_device_delete",
    targetType: "device",
    targetId: deviceId,
    reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : "Deleted virtual demo unit",
    beforeState: { device, simulation, deleted_telemetry_rows: telemetryCount ?? 0 },
  });
  return NextResponse.json({ ok: true, deleted_telemetry_rows: telemetryCount ?? 0 });
}
