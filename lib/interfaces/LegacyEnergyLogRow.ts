export type LegacyEnergyLogRow = {
  energy_kwh: number | string;
  average_watts: number | string | null;
  recorded_at: string | null;
};
