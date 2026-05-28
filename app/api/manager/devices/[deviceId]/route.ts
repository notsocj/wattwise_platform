import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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

  if (profile?.role !== "manager") {
    return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const hasTenantUpdate = Object.prototype.hasOwnProperty.call(body, "tenant_id");
  const tenantId =
    typeof body.tenant_id === "string" && body.tenant_id.trim()
      ? body.tenant_id.trim()
      : null;
  const approvedLimit = toOptionalNumber(body.user_approved_limit_php);
  const relayState = body.relay_state;

  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("id")
    .eq("id", deviceId)
    .eq("owner_id", user.id)
    .maybeSingle<{ id: string }>();

  if (deviceError || !device) {
    return NextResponse.json(
      { error: "Device not found in your manager fleet." },
      { status: 404 }
    );
  }

  if (hasTenantUpdate && tenantId) {
    const { data: tenant } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", tenantId)
      .eq("manager_id", user.id)
      .eq("role", "tenant")
      .maybeSingle<{ id: string }>();

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant must belong to this manager." },
        { status: 400 }
      );
    }
  }

  const updates: Record<string, unknown> = {};

  if (hasTenantUpdate) {
    updates.tenant_id = tenantId;
  }

  if (approvedLimit !== null) {
    if (approvedLimit <= 0 || approvedLimit > 9_999_999.99) {
      return NextResponse.json(
        { error: "Hard limit must be a positive peso amount." },
        { status: 400 }
      );
    }

    updates.user_approved_limit_php = Number(approvedLimit.toFixed(2));
    updates.budget_status = "ok";
    updates.budget_breached_at = null;
    updates.relay_auto_disabled_at = null;
  }

  if (typeof relayState === "boolean") {
    updates.relay_state = relayState;
    if (relayState) {
      updates.budget_status = "ok";
      updates.budget_breached_at = null;
      updates.relay_auto_disabled_at = null;
    }
  }

  const { error: updateError } = await supabase
    .from("devices")
    .update(updates)
    .eq("id", deviceId)
    .eq("owner_id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update manager device settings." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
