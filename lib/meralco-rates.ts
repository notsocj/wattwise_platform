import { getManilaDayKey } from "@/lib/date-utils";
import { computeMeralcoBill, type MeralcoRateComponents } from "@/lib/meralco-bill";

export {
  applyHouseholdTier,
  distributionTierLabel,
  computeFixedChargesWithVat,
  computeMeralcoBill,
  computeVariableRatePerKwh,
  MERALCO_COMPONENT_LINES,
  vatMultiplierFor,
  type HouseholdUsage,
  type MeralcoComponentKey,
  type MeralcoRateComponents,
  type MeralcoVatClass,
} from "@/lib/meralco-bill";

export type MeralcoFixedCharges = {
  meteringCharge: number;
  supplyCharge: number;
};

export type MeralcoRatesRow = {
  effective_month: string;
  vat_rate: number | string;
  generation: number | string;
  transmission: number | string;
  ancillary_service: number | string;
  system_loss: number | string;
  distribution: number | string;
  supply_rate: number | string;
  metering_rate: number | string;
  universal_charges: number | string;
  fit_all: number | string;
  awat_adjustment: number | string;
  regulatory_reset_adjustment: number | string;
  lifeline_rate_adjustment: number | string;
  senior_citizen_subsidy: number | string;
  rpt_charge: number | string;
  gea_all: number | string;
  lifeline_subsidy: number | string;
  vat_generation: number | string | null;
  vat_transmission: number | string | null;
  vat_ancillary: number | string | null;
  distribution_201_300: number | string | null;
  distribution_301_400: number | string | null;
  distribution_over_400: number | string | null;
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

export const MERALCO_RATE_SELECT =
  "effective_month, vat_rate, generation, transmission, ancillary_service, system_loss, distribution, supply_rate, metering_rate, universal_charges, fit_all, awat_adjustment, regulatory_reset_adjustment, lifeline_rate_adjustment, senior_citizen_subsidy, rpt_charge, gea_all, lifeline_subsidy, vat_generation, vat_transmission, vat_ancillary, distribution_201_300, distribution_301_400, distribution_over_400, metering_charge, supply_charge, created_at, source_url, source_pdf_url, fetched_at, auto_updated";

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function nullableNumber(value: number | string | null | undefined): number | null {
  return value === null || value === undefined ? null : toNumber(value);
}

export function mapMeralcoRatesRowToComponents(
  row: MeralcoRatesRow
): MeralcoRateComponents {
  return {
    generation: toNumber(row.generation),
    transmission: toNumber(row.transmission),
    ancillaryService: toNumber(row.ancillary_service),
    systemLoss: toNumber(row.system_loss),
    distribution: toNumber(row.distribution),
    supplyRate: toNumber(row.supply_rate),
    meteringRate: toNumber(row.metering_rate),
    universalCharges: toNumber(row.universal_charges),
    fitAll: toNumber(row.fit_all),
    awatAdjustment: toNumber(row.awat_adjustment ?? 0),
    regulatoryResetAdjustment: toNumber(row.regulatory_reset_adjustment ?? 0),
    lifelineRateAdjustment: toNumber(row.lifeline_rate_adjustment ?? 0),
    seniorCitizenSubsidy: toNumber(row.senior_citizen_subsidy ?? 0),
    rptCharge: toNumber(row.rpt_charge ?? 0),
    geaAll: toNumber(row.gea_all ?? 0),
    lifelineSubsidy: toNumber(row.lifeline_subsidy ?? 0),
    vatGeneration: row.vat_generation === null || row.vat_generation === undefined ? null : toNumber(row.vat_generation),
    vatTransmission: row.vat_transmission === null || row.vat_transmission === undefined ? null : toNumber(row.vat_transmission),
    vatAncillary: row.vat_ancillary === null || row.vat_ancillary === undefined ? null : toNumber(row.vat_ancillary),
    distribution201To300: nullableNumber(row.distribution_201_300),
    distribution301To400: nullableNumber(row.distribution_301_400),
    distributionOver400: nullableNumber(row.distribution_over_400),
    energyTax: 0,
    household: null,
  };
}

export type ActiveMeralcoRates = {
  rates: MeralcoRateComponents;
  fixedCharges: MeralcoFixedCharges;
  fixedMonthlyChargesPhp: number;
  vatRate: number;
  effectiveMonth: string;
  source: "table";
  provenance: MeralcoRateProvenance;
};

// The selectors below work on every meralco_rates row sorted by
// effective_month ascending; lib/meralco-rates-server.ts loads and caches them.

export function selectActiveMeralcoRates(
  rows: MeralcoRatesRow[],
  now: Date = new Date()
): ActiveMeralcoRates {
  const todayIso = getManilaDayKey(now);
  const data = [...rows].reverse().find((row) => row.effective_month <= todayIso) ?? null;

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

export function selectMeralcoRateHistory(
  rows: MeralcoRatesRow[],
  limit = 24
): HistoricalMeralcoRateRow[] {
  return [...rows]
    .reverse()
    .slice(0, Math.min(60, Math.max(1, limit)))
    .map(mapRowToHistoricalRate);
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

export function selectMeralcoRatesForRange(
  allRows: MeralcoRatesRow[],
  startDate: Date,
  endDate: Date
): HistoricalMeralcoRateRow[] {
  const endDayKey = getManilaDayKey(endDate);
  const rows = allRows.filter((row) => row.effective_month <= endDayKey);
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
