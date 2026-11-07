/**
 * Fields an admin can edit on a meralco_rates row, with the bounds the server
 * enforces. Values are in database units: pesos per kWh, pesos per month, or
 * VAT as a fraction (0.12 = 12%). Shared by the rate editor and its API route.
 */

export type RateFieldKind = "per_kwh" | "adjustment" | "tier" | "vat" | "fixed";

export type RateField = {
  key: string;
  label: string;
  kind: RateFieldKind;
  /** Optional fields may be left blank (stored as NULL). */
  optional?: boolean;
};

export const RATE_FIELD_GROUPS: { title: string; hint: string; fields: RateField[] }[] = [
  {
    title: "Per-kWh charges",
    hint: "Pesos per kWh, before VAT.",
    fields: [
      { key: "generation", label: "Generation", kind: "per_kwh" },
      { key: "transmission", label: "Transmission", kind: "per_kwh" },
      { key: "ancillary_service", label: "Ancillary service", kind: "per_kwh" },
      { key: "system_loss", label: "System loss", kind: "per_kwh" },
      { key: "distribution", label: "Distribution (up to 200 kWh)", kind: "per_kwh" },
      { key: "supply_rate", label: "Supply", kind: "per_kwh" },
      { key: "metering_rate", label: "Metering", kind: "per_kwh" },
      { key: "universal_charges", label: "Universal charges", kind: "per_kwh" },
      { key: "fit_all", label: "FIT-All", kind: "per_kwh" },
    ],
  },
  {
    title: "Distribution tiers",
    hint: "Pesos per kWh for the whole home's monthly usage. Blank uses the base distribution rate.",
    fields: [
      { key: "distribution_201_300", label: "201–300 kWh", kind: "tier", optional: true },
      { key: "distribution_301_400", label: "301–400 kWh", kind: "tier", optional: true },
      { key: "distribution_over_400", label: "Over 400 kWh", kind: "tier", optional: true },
    ],
  },
  {
    title: "Adjustments and subsidies",
    hint: "Pesos per kWh. Use a negative number for refunds (for example AWAT).",
    fields: [
      { key: "awat_adjustment", label: "AWAT adjustment", kind: "adjustment" },
      { key: "regulatory_reset_adjustment", label: "Regulatory reset", kind: "adjustment" },
      { key: "lifeline_rate_adjustment", label: "Lifeline rate adjustment", kind: "adjustment" },
      { key: "senior_citizen_subsidy", label: "Senior citizen subsidy", kind: "adjustment" },
      { key: "rpt_charge", label: "RPT charge", kind: "adjustment" },
      { key: "gea_all", label: "GEA-All", kind: "adjustment" },
      { key: "lifeline_subsidy", label: "Lifeline subsidy", kind: "adjustment" },
    ],
  },
  {
    title: "VAT",
    hint: "Percent. Component rates are optional; blank uses the main VAT rate.",
    fields: [
      { key: "vat_rate", label: "VAT", kind: "vat" },
      { key: "vat_generation", label: "VAT on generation", kind: "vat", optional: true },
      { key: "vat_transmission", label: "VAT on transmission", kind: "vat", optional: true },
      { key: "vat_ancillary", label: "VAT on ancillary", kind: "vat", optional: true },
    ],
  },
  {
    title: "Fixed monthly charges",
    hint: "Pesos per customer per month.",
    fields: [
      { key: "supply_charge", label: "Supply charge", kind: "fixed" },
      { key: "metering_charge", label: "Metering charge", kind: "fixed" },
    ],
  },
];

export const RATE_FIELDS = RATE_FIELD_GROUPS.flatMap((group) => group.fields);

const BOUNDS: Record<RateFieldKind, [number, number]> = {
  per_kwh: [0, 30],
  tier: [0, 30],
  adjustment: [-10, 10],
  vat: [0, 0.25],
  fixed: [0, 1000],
};

export type RateRowInput = { effective_month: string; values: Record<string, number | null> };

/**
 * Validates an editor submission. `effective_month` is "YYYY-MM" or
 * "YYYY-MM-01"; every field must be a finite number within its bounds
 * (optional fields may be null). Returns the row to upsert, or field errors.
 */
export function parseRateInput(
  body: unknown
): { row: RateRowInput; reason: string } | { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const source = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  const month = typeof source.effective_month === "string" ? source.effective_month.trim() : "";
  const match = /^(\d{4})-(0[1-9]|1[0-2])(?:-01)?$/.exec(month);
  if (!match) errors.effective_month = "Pick the month these rates apply to.";

  const reason = typeof source.reason === "string" ? source.reason.trim() : "";
  if (reason.length < 5) errors.reason = "Say briefly why you're changing these rates.";
  else if (reason.length > 300) errors.reason = "Keep the reason under 300 characters.";

  const row: Record<string, number | null> = {};
  for (const field of RATE_FIELDS) {
    const raw = source[field.key];
    const blank = raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "");
    if (blank && field.optional) {
      row[field.key] = null;
      continue;
    }
    // Number("") is 0, so a blank required field must fail here, not save as zero.
    const value = blank ? Number.NaN : typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
    const [min, max] = BOUNDS[field.kind];
    if (!Number.isFinite(value)) {
      errors[field.key] = "Enter a number.";
    } else if (value < min || value > max) {
      errors[field.key] =
        field.kind === "vat" ? `Must be between ${min * 100}% and ${max * 100}%.` : `Must be between ${min} and ${max}.`;
    } else {
      row[field.key] = value;
    }
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { row: { effective_month: `${match![1]}-${match![2]}-01`, values: row }, reason };
}
