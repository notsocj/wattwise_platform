export type NumericLike = number | string | null | undefined;

export type MinMax = {
  min: number;
  max: number;
};

export type TimedReading = {
  energyKwh: number;
  timestampMs: number;
  dayKey: string;
};
