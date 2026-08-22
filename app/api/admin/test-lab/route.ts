import { NextRequest, NextResponse } from "next/server";
import { getActiveMeralcoRates } from "@/lib/meralco-rates";
import { getCycleStartDate, getVariableRatePerKwh, targetCumulativeEnergy, TEST_THRESHOLDS, thresholdEventType, validatePhysicalDeviceConfirmation } from "@/lib/admin-test-lab";
import { requireAdminApi, writeAdminAudit } from "@/lib/admin-auth";

const DEVICE_FIELDS = "id,device_name,mac_address,owner_id,user_id,tenant_id,appliance_type,relay_state,budget_status,user_approved_limit_php,require_approval_on_expiry,budget_breached_at,relay_auto_disabled_at";

function numberInRange(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}
function demoMac() { const value = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase(); return `02:DE:${value.slice(0, 2)}:${value.slice(2, 4)}:${value.slice(4, 6)}:${value.slice(6, 8)}`; }

async function labData(admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>, userId?: string | null) {
  const { data: people, error: peopleError } = await admin.from("profiles").select("id,full_name,email,role,billing_cycle_start_day,created_at").order("full_name").limit(200);
  if (peopleError) throw new Error(peopleError.message);
  if (!userId) return { people: people ?? [], selected: null };
  const selected = (people ?? []).find((person) => person.id === userId);
  if (!selected) throw new Error("Selected user was not found.");
  const cycleStart = getCycleStartDate(Number(selected.billing_cycle_start_day ?? 1));
  const [{ data: preference }, { data: devices, error: deviceError }, { data: simulations }, { data: usage }, { data: events }, { data: deliveries }] = await Promise.all([
    admin.from("notification_preferences").select("budget_push_enabled,budget_email_enabled,updated_at").eq("user_id", userId).maybeSingle(),
    admin.from("devices").select(DEVICE_FIELDS).or(`owner_id.eq.${userId},user_id.eq.${userId},tenant_id.eq.${userId}`).order("device_name"),
    admin.from("demo_device_simulations").select("device_id,is_active,simulated_watts,simulated_voltage_v,energy_kwh,last_generated_at").limit(500),
    admin.from("device_month_usage").select("device_id,month_start,usage_kwh,variable_spend_php,last_energy_kwh,last_recorded_at").eq("user_id", userId).eq("month_start", cycleStart),
    admin.from("device_budget_events").select("id,device_id,event_type,threshold_percent,spend_php,usage_kwh,message,created_at,month_start").eq("user_id", userId).eq("month_start", cycleStart).order("created_at", { ascending: false }).limit(50),
    admin.from("notification_deliveries").select("id,budget_event_id,recipient_id,channel,status,attempts,error_code,error_message,sent_at,created_at").eq("recipient_id", userId).order("created_at", { ascending: false }).limit(50),
  ]);
  if (deviceError) throw new Error(deviceError.message);
  const simulationByDevice = new Map((simulations ?? []).map((item) => [item.device_id, item]));
  const usageByDevice = new Map((usage ?? []).map((item) => [item.device_id, item]));
  return { people: people ?? [], selected: { ...selected, cycle_start: cycleStart, notification_preferences: preference ?? null, devices: (devices ?? []).map((device) => ({ ...device, simulation: simulationByDevice.get(device.id) ?? null, usage: usageByDevice.get(device.id) ?? null })), events: events ?? [], deliveries: deliveries ?? [] } };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(); if ("response" in auth) return auth.response;
  try { return NextResponse.json({ data: await labData(auth.admin, request.nextUrl.searchParams.get("userId")) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Test Lab." }, { status: 400 }); }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi(); if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  if (!userId) return NextResponse.json({ error: "Choose a user first." }, { status: 400 });
  try {
    const current = await labData(auth.admin, userId);
    if (!current.selected) throw new Error("Selected user was not found.");
    if (action === "create_demo") {
      const name = typeof body.device_name === "string" ? body.device_name.trim() : "";
      const watts = numberInRange(body.simulated_watts, 0, 5000); const voltage = numberInRange(body.simulated_voltage_v, 180, 260);
      const limit = numberInRange(body.limit_php, 1, 1_000_000);
      if (!name || watts === null || voltage === null || limit === null) throw new Error("Provide a name, 0–5,000 watts, 180–260 volts, and a positive limit.");
      const approvalRequired = body.approval_required !== false;
      const { data: device, error } = await auth.admin.from("devices").insert({ device_name: name, mac_address: demoMac(), owner_id: userId, user_id: userId, appliance_type: "other", relay_state: true, is_online: false, budget_status: "ok", user_approved_limit_php: limit, require_approval_on_expiry: approvalRequired }).select(DEVICE_FIELDS).single();
      if (error || !device) throw new Error(error?.message ?? "Unable to create the demo unit.");
      const { data: simulation, error: simulationError } = await auth.admin.from("demo_device_simulations").insert({ device_id: device.id, created_by: auth.user.id, simulated_watts: watts, simulated_voltage_v: voltage, is_active: false }).select("*").single();
      if (simulationError) { await auth.admin.from("devices").delete().eq("id", device.id); throw new Error(simulationError.message); }
      await writeAdminAudit(auth.admin, { actorId: auth.user.id, action: "test_lab_demo_create", targetType: "device", targetId: device.id, reason: "Created Test Lab virtual unit", afterState: { device, simulation } });
      return NextResponse.json({ data: await labData(auth.admin, userId) }, { status: 201 });
    }
    const deviceId = typeof body.device_id === "string" ? body.device_id : "";
    const device = current.selected.devices.find((item) => item.id === deviceId);
    if (!device) throw new Error("Choose a device that belongs to the selected user.");
    const isDemo = Boolean(device.simulation);
    const guardError = validatePhysicalDeviceConfirmation({ isDemo, deviceName: device.device_name, confirmedName: body.confirm_device_name, reason: body.reason });
    if (guardError) return NextResponse.json({ error: guardError }, { status: 400 });
    if (action === "configure_device") {
      const limit = numberInRange(body.limit_php, 1, 1_000_000); if (limit === null) throw new Error("Approved limit must be between PHP 1 and PHP 1,000,000.");
      const update = { user_approved_limit_php: limit, require_approval_on_expiry: body.approval_required !== false };
      const { data: after, error } = await auth.admin.from("devices").update(update).eq("id", deviceId).select(DEVICE_FIELDS).single(); if (error) throw new Error(error.message);
      if (isDemo && (body.simulated_watts !== undefined || body.simulated_voltage_v !== undefined)) {
        const watts = body.simulated_watts === undefined ? undefined : numberInRange(body.simulated_watts, 0, 5000); const voltage = body.simulated_voltage_v === undefined ? undefined : numberInRange(body.simulated_voltage_v, 180, 260);
        if (watts === null || voltage === null) throw new Error("Demo watts must be 0–5,000 and voltage 180–260.");
        const simulationUpdate: Record<string, number> = {}; if (watts !== undefined) simulationUpdate.simulated_watts = watts; if (voltage !== undefined) simulationUpdate.simulated_voltage_v = voltage;
        if (Object.keys(simulationUpdate).length) await auth.admin.from("demo_device_simulations").update(simulationUpdate).eq("device_id", deviceId);
      }
      await writeAdminAudit(auth.admin, { actorId: auth.user.id, action: "test_lab_device_configure", targetType: "device", targetId: deviceId, reason: String(body.reason ?? "Configured Test Lab device").slice(0, 500), beforeState: device, afterState: after });
      return NextResponse.json({ data: await labData(auth.admin, userId) });
    }
    if (action === "restore_power") {
      if (device.budget_status !== "auto_cutoff") throw new Error("This device is not in an automatic-cutoff state.");
      const spend = Number(device.usage?.variable_spend_php ?? 0); const limit = Number(device.user_approved_limit_php ?? 0);
      if (!device.require_approval_on_expiry && limit > 0 && spend >= limit) throw new Error("Raise the limit or switch to approval-required before restoring power; an active automatic cutoff cannot be bypassed.");
      const { data: after, error } = await auth.admin.from("devices").update({ relay_state: true, budget_status: limit > 0 && spend >= limit ? "approval_required" : "ok", relay_auto_disabled_at: null }).eq("id", deviceId).select(DEVICE_FIELDS).single(); if (error) throw new Error(error.message);
      await writeAdminAudit(auth.admin, { actorId: auth.user.id, action: "test_lab_restore_power", targetType: "device", targetId: deviceId, reason: String(body.reason ?? "Restored after Test Lab cutoff").slice(0, 500), beforeState: device, afterState: after });
      return NextResponse.json({ data: await labData(auth.admin, userId) });
    }
    if (action !== "run") throw new Error("Unsupported Test Lab action.");
    const target = body.target;
    const threshold = TEST_THRESHOLDS.includes(Number(target) as typeof TEST_THRESHOLDS[number]) ? Number(target) as typeof TEST_THRESHOLDS[number] : null;
    const eventType = threshold ? thresholdEventType(threshold, device.require_approval_on_expiry === true) : null;
    if (threshold && current.selected.events.some((event) => event.device_id === deviceId && event.event_type === eventType && (threshold === 100 || Number(event.threshold_percent) === threshold))) {
      return NextResponse.json({ error: `This device already has its ${threshold}% event this billing cycle. Create a fresh demo unit to repeat it.`, code: "duplicate_threshold" }, { status: 409 });
    }
    const activeRates = await getActiveMeralcoRates(auth.admin);
    const customSpend = numberInRange(body.target_spend_php, 0.01, 1_000_000);
    const customUsage = numberInRange(body.target_usage_kwh, 0.0001, 100_000);
    const targetSpend = threshold
      ? Number(device.user_approved_limit_php ?? 0) * threshold / 100
      : customSpend ?? Number(device.usage?.variable_spend_php ?? 0) + Math.max(0, Number(customUsage ?? 0) - Number(device.usage?.usage_kwh ?? 0)) * getVariableRatePerKwh(activeRates.rates, activeRates.vatRate);
    if (!Number.isFinite(targetSpend) || targetSpend <= 0 || (!threshold && customSpend === null && customUsage === null)) throw new Error("Set a positive target spend or target usage before running a custom test.");
    const latest = Number(device.usage?.last_energy_kwh ?? device.simulation?.energy_kwh ?? 0);
    const cumulative = targetCumulativeEnergy({ currentSpendPhp: Number(device.usage?.variable_spend_php ?? 0), currentEnergyKwh: latest, targetSpendPhp: targetSpend, rates: activeRates.rates, vatRate: activeRates.vatRate });
    const watts = Number(device.simulation?.simulated_watts ?? body.watts ?? 500); const voltage = Number(device.simulation?.simulated_voltage_v ?? body.voltage ?? 230);
    const { data: telemetry, error: telemetryError } = await auth.admin.from("energy_logs").insert({ device_id: device.mac_address, energy_kwh: cumulative, average_watts: watts, voltage_v: voltage, current_a: voltage > 0 ? watts / voltage : null, recorded_at: new Date().toISOString() }).select("id,device_id,energy_kwh,average_watts,voltage_v,current_a,recorded_at").single();
    if (telemetryError || !telemetry) throw new Error(telemetryError?.message ?? "Telemetry insert did not return a reading.");
    if (isDemo) await auth.admin.from("demo_device_simulations").update({ energy_kwh: cumulative, last_generated_at: telemetry.recorded_at }).eq("device_id", deviceId);
    await writeAdminAudit(auth.admin, { actorId: auth.user.id, action: "test_lab_telemetry_insert", targetType: "device", targetId: deviceId, reason: String(body.reason ?? `Test Lab ${threshold ? `${threshold}%` : "custom"} telemetry run`).slice(0, 500), beforeState: { device, current_spend_php: device.usage?.variable_spend_php ?? 0 }, afterState: { telemetry, target_spend_php: targetSpend, threshold } });
    return NextResponse.json({ data: await labData(auth.admin, userId), telemetry, note: "Telemetry was inserted. Refresh delivery evidence shortly if the database webhook is still dispatching." });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Test Lab action failed." }, { status: 400 }); }
}
