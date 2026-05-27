import { computeMeralcoBill, type MeralcoRateComponents } from "@/lib/meralco-rates";

export type UsageByDeviceDayRow = {
  device_id: string;
  day_key: string;
  usage_kwh: number | string;
};

export type CalendarDailySummary = {
  dayKey: string;
  dayNumber: number;
  weekdayShort: string;
  kwh: number;
  costPhp: number;
  intensity: "none" | "low" | "medium" | "high";
  isToday: boolean;
  isCurrentMonth: boolean;
};

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function aggregateUsageByDay(
  rows: UsageByDeviceDayRow[]
): Map<string, number> {
  const usageByDay = new Map<string, number>();

  for (const row of rows) {
    usageByDay.set(
      row.day_key,
      (usageByDay.get(row.day_key) ?? 0) + Math.max(0, toNumber(row.usage_kwh))
    );
  }

  return usageByDay;
}

function getIntensity(
  value: number,
  maxValue: number
): CalendarDailySummary["intensity"] {
  if (value <= 0 || maxValue <= 0) {
    return "none";
  }

  const ratio = value / maxValue;

  if (ratio >= 0.7) {
    return "high";
  }

  if (ratio >= 0.35) {
    return "medium";
  }

  return "low";
}

function buildSummary(
  date: Date,
  currentMonth: number,
  usageKwh: number,
  maxUsageKwh: number,
  rates: MeralcoRateComponents,
  vatRate: number
): CalendarDailySummary {
  return {
    dayKey: formatDayKey(date),
    dayNumber: date.getDate(),
    weekdayShort: WEEKDAY_LABELS[date.getDay()],
    kwh: Number(usageKwh.toFixed(2)),
    costPhp: Number(computeMeralcoBill(usageKwh, rates, vatRate).toFixed(2)),
    intensity: getIntensity(usageKwh, maxUsageKwh),
    isToday: formatDayKey(date) === formatDayKey(new Date()),
    isCurrentMonth: date.getMonth() === currentMonth,
  };
}

export function buildWeekSummaries(params: {
  endDate?: Date;
  usageByDay: Map<string, number>;
  rates: MeralcoRateComponents;
  vatRate: number;
}): CalendarDailySummary[] {
  const endDate = params.endDate ? new Date(params.endDate) : new Date();
  endDate.setHours(0, 0, 0, 0);

  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 6);

  const dates: Date[] = [];
  for (let index = 0; index < 7; index += 1) {
    const nextDate = new Date(startDate);
    nextDate.setDate(startDate.getDate() + index);
    dates.push(nextDate);
  }

  const maxUsageKwh = dates.reduce((maxValue, date) => {
    const nextValue = params.usageByDay.get(formatDayKey(date)) ?? 0;
    return Math.max(maxValue, nextValue);
  }, 0);

  return dates.map((date) =>
    buildSummary(
      date,
      date.getMonth(),
      params.usageByDay.get(formatDayKey(date)) ?? 0,
      maxUsageKwh,
      params.rates,
      params.vatRate
    )
  );
}

export function buildMonthGrid(params: {
  monthDate?: Date;
  usageByDay: Map<string, number>;
  rates: MeralcoRateComponents;
  vatRate: number;
}): CalendarDailySummary[][] {
  const monthDate = params.monthDate ? new Date(params.monthDate) : new Date();
  const currentMonth = monthDate.getMonth();
  const startOfMonth = new Date(monthDate.getFullYear(), currentMonth, 1);
  const endOfMonth = new Date(monthDate.getFullYear(), currentMonth + 1, 0);

  const gridStart = new Date(startOfMonth);
  gridStart.setDate(startOfMonth.getDate() - startOfMonth.getDay());

  const gridEnd = new Date(endOfMonth);
  gridEnd.setDate(endOfMonth.getDate() + (6 - endOfMonth.getDay()));

  const dates: Date[] = [];
  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(new Date(cursor));
  }

  const monthDates = dates.filter((date) => date.getMonth() === currentMonth);
  const maxUsageKwh = monthDates.reduce((maxValue, date) => {
    const nextValue = params.usageByDay.get(formatDayKey(date)) ?? 0;
    return Math.max(maxValue, nextValue);
  }, 0);

  const summaries = dates.map((date) =>
    buildSummary(
      date,
      currentMonth,
      params.usageByDay.get(formatDayKey(date)) ?? 0,
      maxUsageKwh,
      params.rates,
      params.vatRate
    )
  );

  const weeks: CalendarDailySummary[][] = [];
  for (let index = 0; index < summaries.length; index += 7) {
    weeks.push(summaries.slice(index, index + 7));
  }

  return weeks;
}
