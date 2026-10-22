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
};

export type MeralcoVatClass = "generation" | "transmission" | "ancillary" | "other" | "none";

export type MeralcoComponentKey = Exclude<
  keyof MeralcoRateComponents,
  "vatGeneration" | "vatTransmission" | "vatAncillary"
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
];

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
