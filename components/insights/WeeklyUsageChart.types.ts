export type WeeklyUsagePoint = {
  day: string;
  thisWk: number;
  lastWk: number;
};

export type WeeklyUsageChartProps = {
  data: WeeklyUsagePoint[];
};
