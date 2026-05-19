export type LatestReadingRow = {
  device_id: string;
  average_watts: number | string | null;
  voltage_v: number | string | null;
  current_a: number | string | null;
  energy_kwh: number | string | null;
  recorded_at: string | null;
};
