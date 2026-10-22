import "server-only";

import type { SessionUser } from "@/lib/auth-context";
import { getEndOfManilaDay, getStartOfManilaDay } from "@/lib/date-utils";
import {
  computeHistoricalVariableSpendByDeviceFromDayRows,
  computeVariableRatePerKwh,
} from "@/lib/meralco-rates";
import { getActiveMeralcoRates, getMeralcoRatesForRange } from "@/lib/meralco-rates-server";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const REPORT_PERIODS = ["daily", "weekly", "monthly"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

const PERIOD_DAYS: Record<ReportPeriod, number> = { daily: 1, weekly: 7, monthly: 30 };

export function parseReportPeriod(value: string | null | undefined): ReportPeriod {
  return REPORT_PERIODS.includes(value as ReportPeriod) ? (value as ReportPeriod) : "monthly";
}

type DeviceRow = {
  id: string;
  device_name: string;
  mac_address: string;
  appliance_type: string | null;
  daily_usage_hours: number | string | null;
  profiled_baseline_watts: number | string | null;
  user_approved_limit_php: number | string | null;
};

type UsageDayRow = { device_id: string; day_key: string; usage_kwh: number | string };
type AverageWattsRow = { device_id: string; average_watts: number | string | null };

export type EnergyReportRow = {
  device_name: string;
  appliance_type: string;
  measured_kwh: number;
  estimated_kwh: number | null;
  difference_kwh: number | null;
  difference_percent: number | null;
  average_watts: number;
  variable_cost_php: number;
  limit_php: number | null;
  budget_percent: number | null;
  generation_rate: number;
  transmission_rate: number;
  ancillary_service_rate: number;
  distribution_rate: number;
  system_loss_rate: number;
  supply_rate: number;
  metering_rate: number;
  universal_charges_rate: number;
  fit_all_rate: number;
  adjustments_rate: number;
  vat_rate: number;
  vat_generation_rate: number;
  vat_transmission_rate: number;
  vat_ancillary_rate: number;
  variable_rate_per_kwh: number;
  fixed_charges_php: number;
};

export type EnergyReport = {
  period: ReportPeriod;
  start: Date;
  end: Date;
  activeRates: Awaited<ReturnType<typeof getActiveMeralcoRates>>;
  rows: EnergyReportRow[];
};

function numberValue(value: number | string | null | undefined): number {
  const result = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export function getReportWindow(period: ReportPeriod, now: Date): { start: Date; end: Date } {
  const end = getEndOfManilaDay(now);
  const today = getStartOfManilaDay(now);
  return { start: new Date(today.getTime() - (PERIOD_DAYS[period] - 1) * 86400000), end };
}

/**
 * Per-device usage, cost, and average power for the report period. Usage
 * comes from the same per-day RPC as the dashboard, each day is priced at the
 * Meralco rate in effect that day, and every lookup runs in parallel.
 */
export async function buildEnergyReport(
  supabase: SupabaseServerClient,
  user: SessionUser,
  period: ReportPeriod
): Promise<EnergyReport> {
  const { start, end } = getReportWindow(period, new Date());
  const window = { p_user_id: user.id, p_start: start.toISOString(), p_end: end.toISOString() };

  const role =
    user.role ??
    (
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle<{ role: string | null }>()
    ).data?.role ??
    null;

  const deviceQuery = supabase
    .from("devices")
    .select(
      "id, device_name, mac_address, appliance_type, daily_usage_hours, profiled_baseline_watts, user_approved_limit_php"
    )
    .order("created_at", { ascending: true });

  const [devicesRes, usageRes, averageRes, rateRows, activeRates] = await Promise.all([
    role === "tenant"
      ? deviceQuery.eq("tenant_id", user.id)
      : deviceQuery.or(`owner_id.eq.${user.id},user_id.eq.${user.id}`),
    supabase.rpc("get_usage_kwh_by_device_day", window),
    supabase.rpc("get_average_watts_by_device", window),
    getMeralcoRatesForRange(supabase, start, end),
    getActiveMeralcoRates(supabase),
  ]);

  const failure = devicesRes.error ?? usageRes.error ?? averageRes.error;
  if (failure) {
    throw new Error(`Report data could not be loaded: ${failure.message}`);
  }

  const dayRows = (usageRes.data ?? []) as UsageDayRow[];
  const usageByDevice = new Map<string, number>();
  for (const row of dayRows) {
    usageByDevice.set(row.device_id, (usageByDevice.get(row.device_id) ?? 0) + Math.max(0, numberValue(row.usage_kwh)));
  }
  const costByDevice = computeHistoricalVariableSpendByDeviceFromDayRows(dayRows, rateRows);
  const averageByDevice = new Map(
    ((averageRes.data ?? []) as AverageWattsRow[]).map((row) => [row.device_id, numberValue(row.average_watts)])
  );

  const r = activeRates.rates;
  // AWAT refunds, regulatory reset, lifeline rate adjustment, senior citizen
  // subsidy, RPT, GEA-All, and lifeline subsidy, before VAT.
  const adjustmentsRate = Number(
    (r.awatAdjustment + r.regulatoryResetAdjustment + r.lifelineRateAdjustment +
      r.seniorCitizenSubsidy + r.rptCharge + r.geaAll + r.lifelineSubsidy).toFixed(4)
  );
  const variableRatePerKwh = Number(computeVariableRatePerKwh(r, activeRates.vatRate).toFixed(4));

  const rows = ((devicesRes.data ?? []) as DeviceRow[]).map((device): EnergyReportRow => {
    const usageKwh = usageByDevice.get(device.id) ?? 0;
    const baselineWatts = numberValue(device.profiled_baseline_watts);
    const dailyHours = numberValue(device.daily_usage_hours);
    const estimatedKwh =
      baselineWatts > 0 && dailyHours > 0 ? (baselineWatts / 1000) * dailyHours * PERIOD_DAYS[period] : null;
    const variableCost = costByDevice.get(device.id) ?? 0;
    const limit = numberValue(device.user_approved_limit_php);

    return {
      device_name: device.device_name,
      appliance_type: device.appliance_type ?? "other",
      measured_kwh: Number(usageKwh.toFixed(4)),
      estimated_kwh: estimatedKwh === null ? null : Number(estimatedKwh.toFixed(4)),
      difference_kwh: estimatedKwh === null ? null : Number((usageKwh - estimatedKwh).toFixed(4)),
      difference_percent:
        estimatedKwh && estimatedKwh > 0
          ? Number((((usageKwh - estimatedKwh) / estimatedKwh) * 100).toFixed(2))
          : null,
      average_watts: Number((averageByDevice.get(device.id) ?? 0).toFixed(2)),
      variable_cost_php: Number(variableCost.toFixed(2)),
      limit_php: limit > 0 ? limit : null,
      budget_percent: limit > 0 ? Number(((variableCost / limit) * 100).toFixed(2)) : null,
      generation_rate: activeRates.rates.generation,
      transmission_rate: activeRates.rates.transmission,
      ancillary_service_rate: activeRates.rates.ancillaryService,
      distribution_rate: activeRates.rates.distribution,
      system_loss_rate: activeRates.rates.systemLoss,
      supply_rate: activeRates.rates.supplyRate,
      metering_rate: activeRates.rates.meteringRate,
      universal_charges_rate: activeRates.rates.universalCharges,
      fit_all_rate: activeRates.rates.fitAll,
      adjustments_rate: adjustmentsRate,
      vat_rate: activeRates.vatRate,
      vat_generation_rate: activeRates.rates.vatGeneration ?? activeRates.vatRate,
      vat_transmission_rate: activeRates.rates.vatTransmission ?? activeRates.vatRate,
      vat_ancillary_rate: activeRates.rates.vatAncillary ?? activeRates.vatRate,
      variable_rate_per_kwh: variableRatePerKwh,
      fixed_charges_php: activeRates.fixedMonthlyChargesPhp,
    };
  });

  return { period, start, end, activeRates, rows };
}
