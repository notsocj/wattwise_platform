export type ParsedRates = {
  generation: number | null;
  transmission: number | null;
  ancillary_service: number | null;
  system_loss: number | null;
  distribution: number | null;
  supply_rate: number | null;
  metering_rate: number | null;
  universal_charges: number | null;
  fit_all: number | null;
  vat_rate: number | null;
  metering_charge: number | null;
  supply_charge: number | null;
  // Per-kWh adjustments and component VAT rates. Read only from the current
  // summary-schedule layout; null for other layouts.
  awat_adjustment: number | null;
  regulatory_reset_adjustment: number | null;
  lifeline_rate_adjustment: number | null;
  senior_citizen_subsidy: number | null;
  rpt_charge: number | null;
  gea_all: number | null;
  lifeline_subsidy: number | null;
  vat_generation: number | null;
  vat_transmission: number | null;
  vat_ancillary: number | null;
  // Residential distribution rates for homes above 200 kWh a month (column 4
  // of the 201-300, 301-400, and over-400 rows). null for other layouts.
  distribution_201_300: number | null;
  distribution_301_400: number | null;
  distribution_over_400: number | null;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toNumber(raw: string): number | null {
  const normalized = raw.replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSignedNumberToken(raw: string): number | null {
  const trimmed = raw.trim();
  const normalized =
    trimmed.startsWith("(") && trimmed.endsWith(")")
      ? `-${trimmed.slice(1, -1).trim()}`
      : trimmed;
  return toNumber(normalized);
}

// Column order of the residential rows in Meralco's current Summary Schedule
// of Rates (verified on the August, September, and October 2026 PDFs):
//   0 Generation, 1 Transmission, 2 Ancillary Service, 3 System Loss,
//   4 Distribution, 5 Supply (per kWh), 6 Supply (per customer),
//   7 Metering (per kWh), 8 Metering (per customer), 9 AWAT 1, 10 AWAT 2,
//   11 Regulatory Reset Fees Adj, 12 Lifeline Rate Adj, 13 Senior Citizen
//   Subsidy, 14 RPT Charge, 15 RPT Adj, 16-19 Universal Charge parts
//   (UC-ME NPC-SPUG, UC-ME RED-CI, UC-EC, UC-SD), 20 FIT-All, 21 GEA-All,
//   22 Lifeline Subsidy.
const CURRENT_SCHEDULE_COLUMNS = {
  awat: [9, 10],
  regulatoryReset: 11,
  lifelineRateAdjustment: 12,
  seniorCitizenSubsidy: 13,
  rpt: [14, 15],
  universalParts: [16, 17, 18, 19],
  fitAll: 20,
  geaAll: 21,
  lifelineSubsidy: 22,
  length: 23,
} as const;

function sumColumns(row: number[], indexes: readonly number[]): number {
  return Number(indexes.reduce((sum, index) => sum + row[index], 0).toFixed(4));
}

/** Monthly effective VAT rate for one component from the schedule's VAT table. */
function findComponentVat(text: string, label: string): number | null {
  const match = text.match(new RegExp(`${escapeRegExp(label)}\\s+(\\d{1,2}(?:\\.\\d+)?)\\s*%`, "i"));
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 && value <= 30 ? Number((value / 100).toFixed(4)) : null;
}

/**
 * Reads exactly one residential row (101-200 kWh by default, up to the next
 * row label) when the schedule uses the current column set. Returns null for
 * other layouts so the legacy positional parsing still applies to them.
 */
function parseCurrentScheduleRow(text: string, rowLabel = "101 TO 200 KWH"): number[] | null {
  if (!/UC-ME/i.test(text) || !/GEA-All/i.test(text)) return null;

  const match = text.match(
    new RegExp(
      `${escapeRegExp(rowLabel)}\\s+([\\s\\S]*?)(?=\\s+\\d+\\s+TO\\s+\\d+\\s+KWH|\\s+OVER\\s+\\d+\\s+KWH|\\s+[A-Za-z]{2,}|$)`,
      "i"
    )
  );
  if (!match) return null;

  const values = (match[1].match(/\(\s*-?\d+(?:\.\d+)?\s*\)|-?\d+(?:\.\d+)?/g) ?? [])
    .map((token) => parseSignedNumberToken(token))
    .filter((value): value is number => value !== null);

  return values.length === CURRENT_SCHEDULE_COLUMNS.length ? values : null;
}

function tierDistribution(text: string, rowLabel: string): number | null {
  return parseCurrentScheduleRow(text, rowLabel)?.[4] ?? null;
}

function parseResidentialBaseRowValues(text: string): number[] | null {
  const rowAnchors = ["101 TO 200 KWH", "201 TO 300 KWH", "0 TO 20 KWH"];

  for (const anchor of rowAnchors) {
    const idx = text.toUpperCase().indexOf(anchor);
    if (idx < 0) continue;

    const snippet = text.slice(idx, idx + 500);
    const tokens = snippet.match(/\(?-?\d+(?:\.\d+)?\)?/g) ?? [];
    let numbers = tokens
      .map((token) => parseSignedNumberToken(token))
      .filter((value): value is number => value !== null);

    if (
      numbers.length >= 20 &&
      numbers[0] >= 0 &&
      numbers[0] <= 500 &&
      numbers[1] >= 0 &&
      numbers[1] <= 500 &&
      numbers[2] > 0 &&
      numbers[2] < 20
    ) {
      numbers = numbers.slice(2);
    }

    if (numbers.length >= 22) return numbers;
  }

  const allDecimalTokens = text.match(/\(?-?\d+\.\d+\)?/g) ?? [];
  const allNumbers = allDecimalTokens
    .map((token) => parseSignedNumberToken(token))
    .filter((value): value is number => value !== null);

  for (let i = 0; i + 21 < allNumbers.length; i += 1) {
    const window = allNumbers.slice(i, i + 22);
    const looksLikeResidentialRow =
      window[0] >= 3 &&
      window[0] <= 15 &&
      window[1] >= 0.5 &&
      window[1] <= 3 &&
      window[2] >= 0.1 &&
      window[2] <= 2 &&
      window[3] >= 0.5 &&
      window[3] <= 3 &&
      window[7] >= 0 &&
      window[7] <= 20 &&
      window[20] >= 0 &&
      window[20] <= 2 &&
      window[21] >= 0 &&
      window[21] <= 2;

    if (looksLikeResidentialRow) return window;
  }

  return null;
}

function parseTypicalResidentialRowValues(text: string): number[] | null {
  const upperText = text.toUpperCase();
  const rateSectionIndex = upperText.lastIndexOf("RATE PER KWH");
  if (rateSectionIndex < 0) return null;

  const rateSection = text.slice(rateSectionIndex);
  const nonLifelineIndex = rateSection.toUpperCase().indexOf("FOR NON-LIFELINE CUSTOMERS");
  if (nonLifelineIndex < 0) return null;

  const nonLifelineSection = rateSection.slice(nonLifelineIndex);
  const rowMatch = nonLifelineSection.match(/\b100\s+(?=\d{1,2}\.\d{4}\s+)/);
  if (!rowMatch || rowMatch.index === undefined) return null;

  const rowAndFollowing = nonLifelineSection.slice(rowMatch.index);
  const nextRowMatch = rowAndFollowing
    .slice(rowMatch[0].length)
    .match(/\b(?:200|300)\s+(?=\d{1,2}\.\d{4}\s+)/);
  const rowEnd = nextRowMatch?.index === undefined
    ? Math.min(500, rowAndFollowing.length)
    : rowMatch[0].length + nextRowMatch.index;
  const snippet = rowAndFollowing.slice(0, rowEnd);
  const values = (snippet.match(/\(\s*-?\d+(?:\.\d+)?\s*\)|-?\d+(?:\.\d+)?/g) ?? [])
    .map((token) => parseSignedNumberToken(token))
    .filter((value): value is number => value !== null);

  if (values[0] !== 100 || values.length < 23) return null;
  return values.slice(1);
}

function findByLabels(
  text: string,
  labels: string[],
  options?: { min?: number; max?: number; window?: number; requireDecimal?: boolean }
): number | null {
  const min = options?.min ?? Number.NEGATIVE_INFINITY;
  const max = options?.max ?? Number.POSITIVE_INFINITY;
  const window = options?.window ?? 120;
  const requireDecimal = options?.requireDecimal ?? false;
  const numberPattern = requireDecimal
    ? "-?\\d{1,4}(?:,\\d{3})*\\.\\d{1,4}"
    : "-?\\d{1,4}(?:,\\d{3})*(?:\\.\\d{1,4})?";

  for (const label of labels) {
    const escaped = escapeRegExp(label);
    const regex = new RegExp(`${escaped}[\\s\\S]{0,${window}}?(${numberPattern})`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const value = toNumber(match[1]);
      if (value !== null && value >= min && value <= max) return value;
    }
  }

  return null;
}

function findVatRate(text: string): number | null {
  // The summary schedule's VAT table lists per-component rates (Generation
  // 8.33%, Transmission 11.99%, ...) before "Other Charges 12.00%", the single
  // rate WattWise applies. Prefer it over the first percentage near "VAT".
  const otherChargesRegex = /other\s+charges[\s\S]{0,30}?(\d{1,2}(?:\.\d+)?)\s*%/gi;
  let otherChargesMatch: RegExpExecArray | null;
  while ((otherChargesMatch = otherChargesRegex.exec(text)) !== null) {
    const value = Number(otherChargesMatch[1]);
    if (Number.isFinite(value) && value > 0 && value <= 100) return value / 100;
  }

  const vatPercentRegex = /vat[\s\S]{0,50}?(\d{1,2}(?:\.\d+)?)\s*%/gi;
  let vatPercentMatch: RegExpExecArray | null;
  while ((vatPercentMatch = vatPercentRegex.exec(text)) !== null) {
    const value = Number(vatPercentMatch[1]);
    if (Number.isFinite(value) && value > 0 && value <= 100) return value / 100;
  }

  return findByLabels(text, ["VAT rate", "VAT"], { min: 0.01, max: 0.3 });
}

export function parseRatesFromText(text: string): ParsedRates {
  const normalizedText = text
    .replace(/\u00A0/g, " ")
    .replace(/(\d)\s+\.\s*(\d)/g, "$1.$2")
    .replace(/(\d)\s*,\s*(\d)/g, "$1,$2")
    .replace(/\s+/g, " ")
    .trim();
  const typicalResidentialRow = parseTypicalResidentialRowValues(normalizedText);
  const currentScheduleRow = typicalResidentialRow ? null : parseCurrentScheduleRow(normalizedText);
  const residentialBaseRow =
    typicalResidentialRow ?? currentScheduleRow ?? parseResidentialBaseRowValues(normalizedText);
  const fixedChargeMultiplier = typicalResidentialRow ? 100 : 1;

  // Typical-bill rows omit dash-only columns in extracted text, so Universal
  // and FIT-All are most stable relative to the row's final subsidy/total cells.
  // The current summary schedule splits Universal Charge into four columns
  // that are summed; GEA-All sits after FIT-All and must not be read as it.
  const universalIndex = typicalResidentialRow ? typicalResidentialRow.length - 4 : 20;
  const fitAllIndex = currentScheduleRow
    ? CURRENT_SCHEDULE_COLUMNS.fitAll
    : typicalResidentialRow
      ? typicalResidentialRow.length - 3
      : 21;
  const rowFallbackUniversal = currentScheduleRow
    ? sumColumns(currentScheduleRow, CURRENT_SCHEDULE_COLUMNS.universalParts)
    : residentialBaseRow && residentialBaseRow.length > universalIndex
      ? residentialBaseRow[universalIndex]
      : null;
  const rowFallbackGeneration = residentialBaseRow?.[0] ?? null;
  const rowFallbackTransmission = residentialBaseRow?.[1] ?? null;
  const rowFallbackAncillaryService = residentialBaseRow?.[2] ?? null;
  // Meralco inserts Ancillary Service between Transmission and System Loss.
  const rowFallbackSystemLoss = residentialBaseRow?.[3] ?? null;
  const rowFallbackDistribution = residentialBaseRow?.[4] ?? null;
  const rowFallbackSupplyRate = residentialBaseRow?.[5] ?? null;
  const rowFallbackMeteringRate = residentialBaseRow?.[7] ?? null;
  const rowFallbackFitAll = residentialBaseRow && residentialBaseRow.length > fitAllIndex
    ? residentialBaseRow[fitAllIndex]
    : null;
  // Supply and metering each have a per-kWh column followed by a fixed customer charge.
  const rowFallbackSupplyCharge = residentialBaseRow
    ? residentialBaseRow[6] * fixedChargeMultiplier
    : null;
  const rowFallbackMeteringCharge = residentialBaseRow
    ? residentialBaseRow[8] * fixedChargeMultiplier
    : null;

  return {
    generation: rowFallbackGeneration ?? findByLabels(normalizedText, ["Generation Charge", "Generation"], { min: 0.1, max: 20, requireDecimal: true }),
    transmission: rowFallbackTransmission ?? findByLabels(normalizedText, ["Transmission Charge", "Transmission"], { min: 0.05, max: 10, requireDecimal: true }),
    ancillary_service: rowFallbackAncillaryService ?? findByLabels(normalizedText, ["Ancillary Service Charge", "Ancillary Service"], { min: 0.01, max: 10, requireDecimal: true }),
    system_loss: rowFallbackSystemLoss ?? findByLabels(normalizedText, ["System Loss Charge", "System Loss", "System-Loss"], { min: 0.01, max: 10, requireDecimal: true }),
    distribution: rowFallbackDistribution ?? findByLabels(normalizedText, ["Distribution Charge", "Distribution"], { min: 0.01, max: 10, requireDecimal: true }),
    supply_rate: rowFallbackSupplyRate,
    metering_rate: rowFallbackMeteringRate,
    universal_charges: rowFallbackUniversal ?? findByLabels(normalizedText, ["Universal Charge", "Universal Charges", "Universal Charge FIT-All"], { min: 0.001, max: 10, window: 1200, requireDecimal: true }),
    fit_all: rowFallbackFitAll ?? findByLabels(normalizedText, ["FIT-All", "FIT All", "FITALL"], { min: 0.0001, max: 3, requireDecimal: true }),
    vat_rate: findVatRate(normalizedText),
    metering_charge: rowFallbackMeteringCharge ?? findByLabels(normalizedText, ["Metering Charge", "Metering Cust Charge"], { min: 0, max: 100, requireDecimal: true }),
    supply_charge: rowFallbackSupplyCharge ?? findByLabels(normalizedText, ["Supply Charge", "Supply Cust Charge"], { min: 0, max: 100, requireDecimal: true }),
    awat_adjustment: currentScheduleRow ? sumColumns(currentScheduleRow, CURRENT_SCHEDULE_COLUMNS.awat) : null,
    regulatory_reset_adjustment: currentScheduleRow?.[CURRENT_SCHEDULE_COLUMNS.regulatoryReset] ?? null,
    lifeline_rate_adjustment: currentScheduleRow?.[CURRENT_SCHEDULE_COLUMNS.lifelineRateAdjustment] ?? null,
    senior_citizen_subsidy: currentScheduleRow?.[CURRENT_SCHEDULE_COLUMNS.seniorCitizenSubsidy] ?? null,
    rpt_charge: currentScheduleRow ? sumColumns(currentScheduleRow, CURRENT_SCHEDULE_COLUMNS.rpt) : null,
    gea_all: currentScheduleRow?.[CURRENT_SCHEDULE_COLUMNS.geaAll] ?? null,
    lifeline_subsidy: currentScheduleRow?.[CURRENT_SCHEDULE_COLUMNS.lifelineSubsidy] ?? null,
    vat_generation: currentScheduleRow ? findComponentVat(normalizedText, "Generation") : null,
    vat_transmission: currentScheduleRow ? findComponentVat(normalizedText, "Transmission") : null,
    vat_ancillary: currentScheduleRow ? findComponentVat(normalizedText, "Ancillary Service") : null,
    distribution_201_300: currentScheduleRow ? tierDistribution(normalizedText, "201 TO 300 KWH") : null,
    distribution_301_400: currentScheduleRow ? tierDistribution(normalizedText, "301 TO 400 KWH") : null,
    distribution_over_400: currentScheduleRow ? tierDistribution(normalizedText, "OVER 400 KWH") : null,
  };
}
