export type TestLabMeralcoRates = {
  generation: number;
  transmission: number;
  systemLoss: number;
  distribution: number;
  universalCharges: number;
  fitAll: number;
};

export const TEST_THRESHOLDS = [50, 80, 100] as const;
export type TestThreshold = (typeof TEST_THRESHOLDS)[number];

export function getCycleStartDate(billingStartDay: number, date = new Date()): string {
  const manila = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => manila.find((item) => item.type === type)?.value ?? "";
  let year = Number(part("year"));
  let month = Number(part("month"));
  const day = Number(part("day"));
  const safeStartDay = Math.max(1, Math.min(28, Math.floor(billingStartDay || 1)));
  if (day < safeStartDay) {
    month -= 1;
    if (month === 0) { month = 12; year -= 1; }
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(safeStartDay).padStart(2, "0")}`;
}

export function getVariableRatePerKwh(rates: TestLabMeralcoRates, vatRate: number): number {
  return (rates.generation + rates.transmission + rates.systemLoss + rates.distribution + rates.universalCharges + rates.fitAll) * (1 + vatRate);
}

export function targetCumulativeEnergy(input: {
  currentSpendPhp: number;
  currentEnergyKwh: number;
  targetSpendPhp: number;
  rates: TestLabMeralcoRates;
  vatRate: number;
}): number {
  const rate = getVariableRatePerKwh(input.rates, input.vatRate);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("The active Meralco variable rate is invalid.");
  const neededSpend = Math.max(0, input.targetSpendPhp - input.currentSpendPhp);
  // The trigger rounds each increment to centavos. Round upward so a threshold is actually crossed.
  const incrementKwh = Math.ceil((neededSpend / rate + 0.00005) * 10_000) / 10_000;
  return Math.round((Math.max(0, input.currentEnergyKwh) + incrementKwh) * 10_000) / 10_000;
}

export function thresholdEventType(threshold: TestThreshold, approvalRequired: boolean): string | null {
  if (threshold === 50 || threshold === 80) return "budget_warning";
  return approvalRequired ? "approval_required" : "auto_cutoff";
}

export function validatePhysicalDeviceConfirmation(input: {
  isDemo: boolean;
  deviceName: string;
  confirmedName?: unknown;
  reason?: unknown;
}): string | null {
  if (input.isDemo) return null;
  if (String(input.confirmedName ?? "").trim() !== input.deviceName) return "Type the exact physical device name to confirm this test.";
  if (String(input.reason ?? "").trim().length < 3) return "A reason of at least 3 characters is required for a physical-device test.";
  return null;
}
