export type EnergyLogRow = {
  energy_kwh: number | string;
  average_watts: number | string | null;
  voltage_v: number | string | null;
  current_a: number | string | null;
  recorded_at: string | null;
};
