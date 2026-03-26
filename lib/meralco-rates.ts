export type MeralcoRateComponents = {
  generation: number;
  transmission: number;
  systemLoss: number;
  distribution: number;
  subsidies: number;
  governmentTaxes: number;
  universalCharges: number;
};

export const DEFAULT_MERALCO_RATES_MARCH_2026: MeralcoRateComponents = {
  generation: 5.3727,
  transmission: 0.8468,
  systemLoss: 0.5012,
  distribution: 1.4798,
  subsidies: -0.0682,
  governmentTaxes: 0.2563,
  universalCharges: 0.1754,
};

export const MERALCO_VAT_RATE = 0.12;

export function computeMeralcoBill(
  kWh: number,
  rates: MeralcoRateComponents = DEFAULT_MERALCO_RATES_MARCH_2026,
  vatRate: number = MERALCO_VAT_RATE
): number {
  const subtotalPerKWh =
    rates.generation +
    rates.transmission +
    rates.systemLoss +
    rates.distribution +
    rates.subsidies +
    rates.governmentTaxes +
    rates.universalCharges;

  const subtotal = subtotalPerKWh * kWh;
  return subtotal * (1 + vatRate);
}