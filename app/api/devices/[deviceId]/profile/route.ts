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

  if (profile?.role === "tenant") {
    return NextResponse.json(
      { error: "Tenants cannot edit device limits." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const dailyUsageHours = toOptionalNumber((body as Record<string, unknown>).daily_usage_hours);
  const suggestedLimit = toOptionalNumber((body as Record<string, unknown>).suggested_monthly_limit_php);
  const approvedLimit = toOptionalNumber((body as Record<string, unknown>).user_approved_limit_php);
  const baselineWatts = toOptionalNumber((body as Record<string, unknown>).profiled_baseline_watts);
  const voltageV = toOptionalNumber((body as Record<string, unknown>).profiled_voltage_v);
  const currentA = toOptionalNumber((body as Record<string, unknown>).profiled_current_a);

  if (dailyUsageHours === null || dailyUsageHours < 1 || dailyUsageHours > 24) {
    return NextResponse.json(
      { error: "daily_usage_hours must be from 1 to 24." },
      { status: 400 }
    );
  }

  if (approvedLimit === null || approvedLimit <= 0 || approvedLimit > 9_999_999.99) {
    return NextResponse.json(
      { error: "user_approved_limit_php must be a positive peso amount." },
      { status: 400 }
    );
  }

  if (suggestedLimit !== null && suggestedLimit <= 0) {
    return NextResponse.json(
      { error: "suggested_monthly_limit_php must be positive when provided." },
      { status: 400 }
    );
  }

  const { data: device, error: fetchError } = await supabase
    .from("devices")
    .select("id, require_approval_on_expiry")
    .eq("id", deviceId)
    .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`)
    .maybeSingle();

  if (fetchError || !device) {
    return NextResponse.json(
      { error: "Device not found or not owned by you." },
      { status: 404 }
    );
  }

  const { error: updateError } = await supabase
    .from("devices")
    .update({
      daily_usage_hours: Number(dailyUsageHours.toFixed(1)),
      suggested_monthly_limit_php:
        suggestedLimit === null ? null : Number(suggestedLimit.toFixed(2)),
      profiled_baseline_watts:
        baselineWatts === null ? null : Number(baselineWatts.toFixed(2)),
      profiled_voltage_v: voltageV === null ? null : Number(voltageV.toFixed(2)),
      profiled_current_a: currentA === null ? null : Number(currentA.toFixed(2)),
      profiled_at: new Date().toISOString(),
    })
    .eq("id", deviceId)
    .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to save appliance profile." },
      { status: 500 }
    );
  }

  const { error: budgetError } = await supabase.rpc(
    "apply_device_budget_settings",
    {
      p_device_id: deviceId,
      p_limit_php: Number(approvedLimit.toFixed(2)),
      p_auto_cutoff_enabled: device.require_approval_on_expiry !== true,
    }
  );

  if (budgetError) {
    return NextResponse.json(
      { error: "Profile saved, but its budget policy could not be initialized." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
