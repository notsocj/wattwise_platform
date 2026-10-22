// Meralco bill math, shared by every cost figure in the app. The budget
// cutoff trigger uses the same formula in SQL (public.meralco_variable_rate_per_kwh,
// migration 037); change both together.
//
// This module has no app imports so the node test runner can load it directly.

export type MeralcoRateComponents = {
  generation: number;
  transmission: number;
  ancillaryService: number;
  systemLoss: number;
  distribution: number;
  supplyRate: number;
  meteringRate: number;
  universalCharges: number;
  fitAll: number;
  // Per-kWh adjustments from the Summary Schedule of Rates; negative values
  // are refunds or credits. Rows recorded before migration 037 carry 0.
  awatAdjustment: number;
  regulatoryResetAdjustment: number;
  lifelineRateAdjustment: number;
  seniorCitizenSubsidy: number;
  rptCharge: number;
  geaAll: number;
  lifelineSubsidy: number;
  // Effective VAT rates Meralco publishes for these components each month.
  // null (older rows) falls back to the general VAT rate.
  vatGeneration: number | null;
  vatTransmission: number | null;
  vatAncillary: number | null;
  // Residential distribution rates for higher monthly consumption. Meralco
  // charges ONE tier rate on all of a home's kWh, picked by the home's total
  // monthly consumption. null (older rows) falls back to `distribution`.
  distribution201To300: number | null;
  distribution301To400: number | null;
  distributionOver400: number | null;
  // Energy tax (BP 36) averaged over all kWh for the household's monthly
  // consumption; set by applyHouseholdTier, 0 otherwise. Not subject to VAT.
  energyTax: number;
  // The monthly household kWh the tier and energy tax were chosen from.
  household: HouseholdUsage | null;
};

export type HouseholdUsage = {
  monthlyKwh: number;
  /** "bill": the homeowner's Meralco bill setting; "projected": monitored usage this cycle. */
  source: "bill" | "projected";
};

export type MeralcoVatClass = "generation" | "transmission" | "ancillary" | "other" | "none";

export type MeralcoComponentKey = Exclude<
  keyof MeralcoRateComponents,
  | "vatGeneration"
  | "vatTransmission"
  | "vatAncillary"
  | "distribution201To300"
  | "distribution301To400"
  | "distributionOver400"
  | "household"
>;

/**
 * Every per-kWh line on a Meralco residential bill, with the VAT it carries.
 * Per the schedule's VAT table, Generation, Transmission, and Ancillary
 * Service have their own monthly rates; System Loss, Universal Charge,
 * FIT-All, GEA-All, RPT, and the lifeline subsidy are not subject to VAT;
 * everything else is "Other Charges" at the general rate.
 */
export const MERALCO_COMPONENT_LINES: ReadonlyArray<{
  key: MeralcoComponentKey;
  label: string;
  vat: MeralcoVatClass;
  /** Adjustments are only shown when non-zero. */
  adjustment?: true;
}> = [
  { key: "generation", label: "Generation", vat: "generation" },
  { key: "transmission", label: "Transmission", vat: "transmission" },
  { key: "ancillaryService", label: "Ancillary service", vat: "ancillary" },
  { key: "systemLoss", label: "System loss", vat: "none" },
  { key: "distribution", label: "Distribution", vat: "other" },
  { key: "supplyRate", label: "Supply", vat: "other" },
  { key: "meteringRate", label: "Metering", vat: "other" },
  { key: "universalCharges", label: "Universal charges", vat: "none" },
  { key: "fitAll", label: "FIT-All", vat: "none" },
  { key: "awatAdjustment", label: "AWAT refund", vat: "other", adjustment: true },
  { key: "regulatoryResetAdjustment", label: "Regulatory reset adjustment", vat: "other", adjustment: true },
  { key: "lifelineRateAdjustment", label: "Lifeline rate adjustment", vat: "other", adjustment: true },
  { key: "seniorCitizenSubsidy", label: "Senior citizen subsidy", vat: "other", adjustment: true },
  { key: "rptCharge", label: "Real property tax", vat: "none", adjustment: true },
  { key: "geaAll", label: "GEA-All", vat: "none", adjustment: true },
  { key: "lifelineSubsidy", label: "Lifeline subsidy", vat: "none", adjustment: true },
  { key: "energyTax", label: "Energy tax", vat: "none", adjustment: true },
];

/** Distribution rate Meralco charges on every kWh for this monthly consumption. */
export function distributionRateForHousehold(
  rates: MeralcoRateComponents,
  monthlyKwh: number | null
): number {
  if (monthlyKwh === null || monthlyKwh <= 200) return rates.distribution;
  if (monthlyKwh <= 300) return rates.distribution201To300 ?? rates.distribution;
  if (monthlyKwh <= 400) return rates.distribution301To400 ?? rates.distribution;
  return rates.distributionOver400 ?? rates.distribution;
}

/**
 * Residential energy tax in pesos for a month (Batas Pambansa Blg. 36): none
 * on the first 650 kWh, then 0.10 on the next 350, 0.20 on the next 500, and
 * 0.35 per kWh beyond 1,500.
 */
export function monthlyEnergyTaxPhp(monthlyKwh: number): number {
  const block = (from: number, to: number) => Math.min(Math.max(monthlyKwh - from, 0), to - from);
  return (
    0.1 * block(650, 1000) +
    0.2 * block(1000, 1500) +
    0.35 * Math.max(monthlyKwh - 1500, 0)
  );
}

/**
 * Prices a rate row for one household: the distribution tier and the energy
 * tax both depend on the home's total monthly kWh. Mirrors
 * public.meralco_variable_rate_per_kwh(rate, household_kwh) in SQL.
 */
export function applyHouseholdTier(
  rates: MeralcoRateComponents,
  household: HouseholdUsage | null
): MeralcoRateComponents {
  const monthlyKwh = household && household.monthlyKwh > 0 ? household.monthlyKwh : null;
  return {
    ...rates,
    distribution: distributionRateForHousehold(rates, monthlyKwh),
    energyTax: monthlyKwh ? monthlyEnergyTaxPhp(monthlyKwh) / monthlyKwh : 0,
    household: monthlyKwh ? household : null,
  };
}

/** Human label for the distribution tier a household falls in. */
export function distributionTierLabel(monthlyKwh: number | null): string {
  if (monthlyKwh === null || monthlyKwh <= 200) return "up to 200 kWh";
  if (monthlyKwh <= 300) return "201–300 kWh";
  if (monthlyKwh <= 400) return "301–400 kWh";
  return "over 400 kWh";
}

/** 1 + the VAT rate applied to one component class. */
export function vatMultiplierFor(
  vatClass: MeralcoVatClass,
  rates: MeralcoRateComponents,
  vatRate: number
): number {
  switch (vatClass) {
    case "generation":
      return 1 + (rates.vatGeneration ?? vatRate);
    case "transmission":
      return 1 + (rates.vatTransmission ?? vatRate);
    case "ancillary":
      return 1 + (rates.vatAncillary ?? vatRate);
    case "other":
      return 1 + vatRate;
    case "none":
      return 1;
  }
}

/** VAT-inclusive variable cost of one kWh. */
export function computeVariableRatePerKwh(rates: MeralcoRateComponents, vatRate: number): number {
  return MERALCO_COMPONENT_LINES.reduce(
    (sum, line) => sum + rates[line.key] * vatMultiplierFor(line.vat, rates, vatRate),
    0
  );
}

/** Fixed monthly charges (metering + supply customer charges) with VAT applied. */
export function computeFixedChargesWithVat(fixedChargesPhp: number, vatRate: number): number {
  return Math.max(0, fixedChargesPhp) * (1 + vatRate);
}

export function computeMeralcoBill(
  kWh: number,
  rates: MeralcoRateComponents,
  vatRate: number,
  options?: {
    fixedChargesPhp?: number;
  }
): number {
  return (
    kWh * computeVariableRatePerKwh(rates, vatRate) +
    computeFixedChargesWithVat(options?.fixedChargesPhp ?? 0, vatRate)
  );
}
