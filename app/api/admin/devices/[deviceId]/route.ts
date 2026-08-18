import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, writeAdminAudit } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { deviceId } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const { data: before, error } = await auth.admin
    .from("devices")
    .select("*")
    .eq("id", deviceId)
    .single();
  if (error || !before) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const requestedLimit =
    body.user_approved_limit_php === undefined
      ? null
      : Number(body.user_approved_limit_php);
  if (
    requestedLimit !== null &&
    (!Number.isFinite(requestedLimit) || requestedLimit <= 0)
  ) {
    return NextResponse.json(
      { error: "Approved limit must be positive." },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {};
  for (const key of [
    "device_name",
    "appliance_type",
    "tenant_id",
    "owner_id",
    "user_id",
    "daily_usage_hours",
    "mac_address",
  ]) {
    if (body[key] !== undefined) update[key] = body[key];
  }
  if (update.mac_address) {
    update.mac_address = String(update.mac_address).trim().toUpperCase().replace(/-/g, ":");
  }

  if (Object.keys(update).length > 0) {
    const result = await auth.admin.from("devices").update(update).eq("id", deviceId);
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }
  }

  if (requestedLimit !== null) {
    const userClient = await createClient();
    const autoCutoffEnabled =
      typeof body.auto_cutoff_enabled === "boolean"
        ? body.auto_cutoff_enabled
        : before.require_approval_on_expiry !== true;
    const { error: budgetError } = await userClient.rpc("apply_device_budget_settings", {
      p_device_id: deviceId,
      p_limit_php: requestedLimit,
      p_auto_cutoff_enabled: autoCutoffEnabled,
    });
    if (budgetError) {
      return NextResponse.json({ error: budgetError.message }, { status: 400 });
    }
  }

  const { data: after } = await auth.admin
    .from("devices")
    .select("*")
    .eq("id", deviceId)
    .single();
  await writeAdminAudit(auth.admin, {
    actorId: auth.user.id,
    action: "device_update",
    targetType: "device",
    targetId: deviceId,
    reason: typeof body.reason === "string" ? body.reason : undefined,
    beforeState: before,
    afterState: after,
  });
  return NextResponse.json({ data: after });
}
