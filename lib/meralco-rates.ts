import type { SupabaseClient } from "@supabase/supabase-js";
import { getManilaDayKey } from "@/lib/date-utils";

export type MeralcoRateComponents = {
  generation: number;
  transmission: number;
  systemLoss: number;
  distribution: number;
  universalCharges: number;
  fitAll: number;
};

export type MeralcoFixedCharges = {
  meteringCharge: number;
  supplyCharge: number;
};

export type MeralcoRatesRow = {
  effective_month: string;
  vat_rate: number | string;
  generation: number | string;
  transmission: number | string;
  system_loss: number | string;
  distribution: number | string;
  universal_charges: number | string;
  fit_all: number | string;
  metering_charge: number | string;
  supply_charge: number | string;
  created_at: string;
  source_url: string | null;
  source_pdf_url: string | null;
  fetched_at: string | null;
  auto_updated: boolean | null;
};

type UsageByDayInput = {
  day_key: string;
  usage_kwh: number | string;
  device_id?: string | null;
};

export type HistoricalMeralcoRateRow = {
  effectiveMonth: string;
  rates: MeralcoRateComponents;
  fixedCharges: MeralcoFixedCharges;
  fixedMonthlyChargesPhp: number;
  vatRate: number;
  provenance: MeralcoRateProvenance;
};

export type MeralcoRateProvenance = {
  sourceUrl: string | null;
  sourcePdfUrl: string | null;
  fetchedAt: string | null;
  createdAt: string;
  autoUpdated: boolean;
};

const MERALCO_RATE_SELECT =
  "effective_month, vat_rate, generation, transmission, system_loss, distribution, universal_charges, fit_all, metering_charge, supply_charge, created_at, source_url, source_pdf_url, fetched_at, auto_updated";

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

export function mapMeralcoRatesRowToComponents(
  row: MeralcoRatesRow
): MeralcoRateComponents {
  return {
    generation: toNumber(row.generation),
    transmission: toNumber(row.transmission),
    systemLoss: toNumber(row.system_loss),
    distribution: toNumber(row.distribution),
    universalCharges: toNumber(row.universal_charges),
    fitAll: toNumber(row.fit_all),
  };
}

export async function getActiveMeralcoRates(supabase: SupabaseClient): Promise<{
  rates: MeralcoRateComponents;
  fixedCharges: MeralcoFixedCharges;
  fixedMonthlyChargesPhp: number;
  vatRate: number;
  effectiveMonth: string;
  source: "table";
  provenance: MeralcoRateProvenance;
}> {
  const todayIso = getManilaDayKey(new Date());

  const { data, error } = await supabase
    .from("meralco_rates")
    .select(MERALCO_RATE_SELECT)
    .lte("effective_month", todayIso)
    .order("effective_month", { ascending: false })
    .limit(1)
    .maybeSingle<MeralcoRatesRow>();

  if (error) {
    throw new Error(`Failed to fetch meralco_rates: ${error.message || "unknown error"}`);
  }

  if (!data) {
    throw new Error(
      "No active meralco_rates row found in the database. Please add a row in the admin Rate Editor or run the seed migration."
    );
  }

  return {
    rates: mapMeralcoRatesRowToComponents(data),
    fixedCharges: {
      meteringCharge: toNumber(data.metering_charge),
      supplyCharge: toNumber(data.supply_charge),
    },
    fixedMonthlyChargesPhp:
      toNumber(data.metering_charge) + toNumber(data.supply_charge),
    vatRate: toNumber(data.vat_rate),
    effectiveMonth: data.effective_month,
    source: "table",
    provenance: mapMeralcoRateProvenance(data),
  };
}

export function mapMeralcoRateProvenance(row: MeralcoRatesRow): MeralcoRateProvenance {
  return {
    sourceUrl: row.source_url,
    sourcePdfUrl: row.source_pdf_url,
    fetchedAt: row.fetched_at,
    createdAt: row.created_at,
    autoUpdated: row.auto_updated === true,
  };
}

function mapRowToHistoricalRate(row: MeralcoRatesRow): HistoricalMeralcoRateRow {
  return {
    effectiveMonth: row.effective_month,
    rates: mapMeralcoRatesRowToComponents(row),
    fixedCharges: {
      meteringCharge: toNumber(row.metering_charge),
      supplyCharge: toNumber(row.supply_charge),
    },
    fixedMonthlyChargesPhp:
      toNumber(row.metering_charge) + toNumber(row.supply_charge),
    vatRate: toNumber(row.vat_rate),
    provenance: mapMeralcoRateProvenance(row),
  };
}

export async function getMeralcoRateHistory(
  supabase: SupabaseClient,
  limit = 24
): Promise<HistoricalMeralcoRateRow[]> {
  const { data, error } = await supabase
    .from("meralco_rates")
    .select(MERALCO_RATE_SELECT)
    .order("effective_month", { ascending: false })
    .limit(Math.min(60, Math.max(1, limit)));

  if (error) {
    throw new Error(`Failed to fetch meralco_rates history: ${error.message || "unknown error"}`);
  }

  return ((data ?? []) as MeralcoRatesRow[]).map(mapRowToHistoricalRate);
}

function getApplicableRateForDay(
  dayKey: string,
  rateRows: HistoricalMeralcoRateRow[]
): HistoricalMeralcoRateRow | null {
  let applicableRate: HistoricalMeralcoRateRow | null = null;

  for (const rateRow of rateRows) {
    if (rateRow.effectiveMonth <= dayKey) {
      applicableRate = rateRow;
      continue;
    }

    break;
  }

  return applicableRate;
}

function toUsageNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getMeralcoRatesForRange(
  supabase: SupabaseClient,
  startDate: Date,
  endDate: Date
): Promise<HistoricalMeralcoRateRow[]> {
  const endDayKey = getManilaDayKey(endDate);

  const { data, error } = await supabase
    .from("meralco_rates")
    .select(MERALCO_RATE_SELECT)
    .lte("effective_month", endDayKey)
    .order("effective_month", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch meralco_rates range: ${error.message || "unknown error"}`);
  }

  const rows = (data ?? []) as MeralcoRatesRow[];
  if (!rows.length) {
    throw new Error(
      "No applicable meralco_rates rows found for the requested date range."
    );
  }

  const startDayKey = getManilaDayKey(startDate);
  const lastRateBeforeStart = [...rows]
    .reverse()
    .find((row) => row.effective_month <= startDayKey);

  if (!lastRateBeforeStart) {
    throw new Error(
      "No meralco_rates row exists on or before the billing cycle start date."
    );
  }

  const filteredRows = rows.filter(
    (row) => row.effective_month >= lastRateBeforeStart.effective_month
  );

  return filteredRows.map(mapRowToHistoricalRate);
}

export function computeHistoricalVariableSpendForDay(
  dayKey: string,
  usageKwh: number,
  rateRows: HistoricalMeralcoRateRow[]
): number {
  if (usageKwh <= 0) {
    return 0;
  }

  const applicableRate = getApplicableRateForDay(dayKey, rateRows);
  if (!applicableRate) {
    return 0;
  }

  return computeMeralcoBill(usageKwh, applicableRate.rates, applicableRate.vatRate);
}

export function computeHistoricalVariableSpendFromDayRows(
  rows: UsageByDayInput[],
  rateRows: HistoricalMeralcoRateRow[]
): number {
  return rows.reduce((sum, row) => {
    const usageKwh = Math.max(0, toUsageNumber(row.usage_kwh));
    return sum + computeHistoricalVariableSpendForDay(row.day_key, usageKwh, rateRows);
  }, 0);
}

export function computeHistoricalVariableSpendByDay(
  rows: UsageByDayInput[],
  rateRows: HistoricalMeralcoRateRow[]
): Map<string, number> {
  const costByDay = new Map<string, number>();

  for (const row of rows) {
    const usageKwh = Math.max(0, toUsageNumber(row.usage_kwh));
    const nextCost =
      (costByDay.get(row.day_key) ?? 0) +
      computeHistoricalVariableSpendForDay(row.day_key, usageKwh, rateRows);
    costByDay.set(row.day_key, nextCost);
  }

  return costByDay;
}

export function computeHistoricalVariableSpendByDeviceFromDayRows(
  rows: UsageByDayInput[],
  rateRows: HistoricalMeralcoRateRow[]
): Map<string, number> {
  const costByDevice = new Map<string, number>();

  for (const row of rows) {
    if (!row.device_id) {
      continue;
    }

    const usageKwh = Math.max(0, toUsageNumber(row.usage_kwh));
    const nextCost =
      (costByDevice.get(row.device_id) ?? 0) +
      computeHistoricalVariableSpendForDay(row.day_key, usageKwh, rateRows);
    costByDevice.set(row.device_id, nextCost);
  }

  return costByDevice;
}

export function computeMeralcoBill(
  kWh: number,
  rates: MeralcoRateComponents,
  vatRate: number,
  options?: {
    fixedChargesPhp?: number;
  }
): number {
  const subtotalPerKWh =
    rates.generation +
    rates.transmission +
    rates.systemLoss +
    rates.distribution +
    rates.universalCharges +
    rates.fitAll;

  const variableCharges = subtotalPerKWh * kWh;
  const fixedCharges = Math.max(0, options?.fixedChargesPhp ?? 0);
  const preVatTotal = variableCharges + fixedCharges;

  return preVatTotal * (1 + vatRate);
}
