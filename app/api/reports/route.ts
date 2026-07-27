import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeUsageKwhByDeviceFromLogs } from "@/lib/energy-usage";
import {
  computeHistoricalVariableSpendForDay,
  getActiveMeralcoRates,
  getMeralcoRatesForRange,
} from "@/lib/meralco-rates";
import {
  getEndOfManilaDay,
  getManilaDayKey,
  getStartOfManilaDay,
} from "@/lib/date-utils";

type Period = "daily" | "weekly" | "monthly";

type DeviceRow = {
  id: string;
  device_name: string;
  mac_address: string;
  appliance_type: string | null;
  daily_usage_hours: number | string | null;
  profiled_baseline_watts: number | string | null;
  user_approved_limit_php: number | string | null;
  owner_id: string | null;
  user_id: string | null;
  tenant_id: string | null;
};

type LogRow = {
  device_id: string;
  energy_kwh: number | string;
  average_watts: number | string | null;
  recorded_at: string;
};

function numberValue(value: number | string | null | undefined): number {
  const result = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function periodWindow(period: Period, now: Date): { start: Date; end: Date } {
  const end = getEndOfManilaDay(now);
  const today = getStartOfManilaDay(now);
  const days = period === "daily" ? 1 : period === "weekly" ? 7 : 30;
  return { start: new Date(today.getTime() - (days - 1) * 86400000), end };
}

function csvCell(value: string | number | null): string {
  const raw = value === null ? "" : String(value);
  return `"${raw.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedPeriod = request.nextUrl.searchParams.get("period") as Period | null;
  const period: Period = requestedPeriod === "daily" || requestedPeriod === "weekly" || requestedPeriod === "monthly"
    ? requestedPeriod
    : "monthly";
  const { start, end } = periodWindow(period, new Date());

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();

  const deviceQuery = supabase
    .from("devices")
    .select("id, device_name, mac_address, appliance_type, daily_usage_hours, profiled_baseline_watts, user_approved_limit_php, owner_id, user_id, tenant_id")
    .order("created_at", { ascending: true });
  const { data: devices, error: deviceError } = profile?.role === "tenant"
    ? await deviceQuery.eq("tenant_id", user.id)
    : await deviceQuery.or(`owner_id.eq.${user.id},user_id.eq.${user.id}`);

  if (deviceError) {
    return NextResponse.json({ error: deviceError.message }, { status: 500 });
  }

  const deviceRows = (devices ?? []) as DeviceRow[];
  const identifiers = deviceRows.flatMap((device) => [device.id, device.mac_address]);
  const logsResponse = identifiers.length
    ? await supabase
        .from("energy_logs")
        .select("device_id, energy_kwh, average_watts, recorded_at")
        .in("device_id", identifiers)
        .gte("recorded_at", start.toISOString())
        .lte("recorded_at", end.toISOString())
        .order("recorded_at", { ascending: true })
        .limit(50000)
    : { data: [], error: null };

  if (logsResponse.error) {
    return NextResponse.json({ error: logsResponse.error.message }, { status: 500 });
  }

  const logs = (logsResponse.data ?? []) as LogRow[];
  const idByIdentifier = new Map<string, string>();
  deviceRows.forEach((device) => {
    idByIdentifier.set(device.id, device.id);
    idByIdentifier.set(device.mac_address, device.id);
  });
  const usageByDevice = computeUsageKwhByDeviceFromLogs(
    logs,
    (rawId) => idByIdentifier.get(rawId)
  );
  const rateRows = await getMeralcoRatesForRange(supabase, start, end);
  const activeRates = await getActiveMeralcoRates(supabase);
  const reportDay = getManilaDayKey(start);
  const variableRateCost = (usageKwh: number) =>
    computeHistoricalVariableSpendForDay(reportDay, usageKwh, rateRows);

  const rows = deviceRows.map((device) => {
    const deviceLogs = logs.filter((log) => idByIdentifier.get(log.device_id) === device.id);
    const usageKwh = usageByDevice.get(device.id) ?? 0;
    const averageWatts = deviceLogs.length
      ? deviceLogs.reduce((sum, log) => sum + numberValue(log.average_watts), 0) / deviceLogs.length
      : 0;
    const baselineWatts = numberValue(device.profiled_baseline_watts);
    const dailyHours = numberValue(device.daily_usage_hours);
    const estimatedKwh = baselineWatts > 0 && dailyHours > 0
      ? (baselineWatts / 1000) * dailyHours * (period === "daily" ? 1 : period === "weekly" ? 7 : 30)
      : null;
    const variableCost = variableRateCost(usageKwh);
    const limit = numberValue(device.user_approved_limit_php);
    return {
      device_name: device.device_name,
      appliance_type: device.appliance_type ?? "other",
      measured_kwh: Number(usageKwh.toFixed(4)),
      estimated_kwh: estimatedKwh === null ? null : Number(estimatedKwh.toFixed(4)),
      difference_kwh: estimatedKwh === null ? null : Number((usageKwh - estimatedKwh).toFixed(4)),
      difference_percent: estimatedKwh && estimatedKwh > 0 ? Number((((usageKwh - estimatedKwh) / estimatedKwh) * 100).toFixed(2)) : null,
      average_watts: Number(averageWatts.toFixed(2)),
      variable_cost_php: Number(variableCost.toFixed(2)),
      limit_php: limit > 0 ? limit : null,
      budget_percent: limit > 0 ? Number(((variableCost / limit) * 100).toFixed(2)) : null,
      generation_rate: activeRates.rates.generation,
      transmission_rate: activeRates.rates.transmission,
      distribution_rate: activeRates.rates.distribution,
      system_loss_rate: activeRates.rates.systemLoss,
      universal_charges_rate: activeRates.rates.universalCharges,
      fit_all_rate: activeRates.rates.fitAll,
      vat_rate: activeRates.vatRate,
      fixed_charges_php: activeRates.fixedMonthlyChargesPhp,
    };
  });

  const format = request.nextUrl.searchParams.get("format") ?? "json";
  if (format === "csv") {
    const headers = Object.keys(rows[0] ?? {
      device_name: "", appliance_type: "", measured_kwh: "", estimated_kwh: "",
      difference_kwh: "", difference_percent: "", average_watts: "",
      variable_cost_php: "", limit_php: "", budget_percent: "", generation_rate: "",
      transmission_rate: "", distribution_rate: "", system_loss_rate: "",
      universal_charges_rate: "", fit_all_rate: "", vat_rate: "", fixed_charges_php: "",
    });
    const csv = [headers, ...rows.map((row) => headers.map((header) => row[header as keyof typeof row]))]
      .map((line) => line.map((value) => csvCell(value as string | number | null)).join(","))
      .join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="wattwise-${period}-report.csv"`,
      },
    });
  }

  return NextResponse.json({
    period,
    start: start.toISOString(),
    end: end.toISOString(),
    meralco: {
      ...activeRates.rates,
      vat_rate: activeRates.vatRate,
      metering_charge: activeRates.fixedCharges.meteringCharge,
      supply_charge: activeRates.fixedCharges.supplyCharge,
    },
    rows,
  });
}
