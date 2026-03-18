const MERALCO_RATES = {
  generation: 5.3727,
  transmission: 0.8468,
  systemLoss: 0.5012,
  distribution: 1.4798,
  subsidies: -0.0682,
  governmentTaxes: 0.2563,
  universalCharges: 0.1754,
} as const;

const VAT_RATE = 0.12;

export function computeMeralcoBill(kWh: number) {
  const subtotal =
    Object.values(MERALCO_RATES).reduce((sum, rate) => sum + rate, 0) * kWh;

  return subtotal * (1 + VAT_RATE);
}

export { MERALCO_RATES, VAT_RATE };
