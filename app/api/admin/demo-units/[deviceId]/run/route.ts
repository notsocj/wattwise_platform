import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, writeAdminAudit } from "@/lib/admin-auth";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { deviceId } = await params;
  const { data: simulation } = await auth.admin.from("demo_device_simulations").select("device_id,is_active").eq("device_id", deviceId).single();
  if (!simulation) return NextResponse.json({ error: "Demo unit not found." }, { status: 404 });
  if (!simulation.is_active) return NextResponse.json({ error: "Start the demo unit before generating a reading." }, { status: 400 });

  const { data, error } = await auth.admin.functions.invoke("simulate-demo-units", { body: { device_id: deviceId } });
  if (error) return NextResponse.json({ error: "Unable to generate demo telemetry." }, { status: 502 });
  await writeAdminAudit(auth.admin, { actorId: auth.user.id, action: "demo_device_run", targetType: "device", targetId: deviceId, afterState: data });
  return NextResponse.json({ data });
}
