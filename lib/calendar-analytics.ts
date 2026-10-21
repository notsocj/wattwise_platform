import { getManilaDayKey, getManilaMonthStart } from "@/lib/date-utils";
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

// Calendar cells are civil dates stored at UTC midnight and read with UTC
// getters, so the grid is independent of the server's timezone.
function toCivilDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

function manilaCivilDate(instant: Date): Date {
  return new Date(`${getManilaDayKey(instant)}T00:00:00Z`);
}

function addCivilDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function formatDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
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
    dayNumber: date.getUTCDate(),
    weekdayShort: WEEKDAY_LABELS[date.getUTCDay()],
    kwh: Number(usageKwh.toFixed(2)),
    costPhp: Number(computeMeralcoBill(usageKwh, rates, vatRate).toFixed(2)),
    intensity: getIntensity(usageKwh, maxUsageKwh),
    isToday: formatDayKey(date) === getManilaDayKey(new Date()),
    isCurrentMonth: date.getUTCMonth() === currentMonth,
  };
}

export function buildWeekSummaries(params: {
  endDate?: Date;
  usageByDay: Map<string, number>;
  rates: MeralcoRateComponents;
  vatRate: number;
}): CalendarDailySummary[] {
  const endDate = manilaCivilDate(params.endDate ?? new Date());
  const startDate = addCivilDays(endDate, -6);

  const dates: Date[] = [];
  for (let index = 0; index < 7; index += 1) {
    dates.push(addCivilDays(startDate, index));
  }

  const maxUsageKwh = dates.reduce((maxValue, date) => {
    const nextValue = params.usageByDay.get(formatDayKey(date)) ?? 0;
    return Math.max(maxValue, nextValue);
  }, 0);

  return dates.map((date) =>
    buildSummary(
      date,
      date.getUTCMonth(),
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
  // monthDate is a civil month (e.g. new Date(2026, 9, 1)); read its local parts.
  const monthDate = params.monthDate ?? getManilaMonthStart();
  const year = monthDate.getFullYear();
  const currentMonth = monthDate.getMonth();
  const startOfMonth = toCivilDate(year, currentMonth, 1);
  const endOfMonth = toCivilDate(year, currentMonth + 1, 0);

  const gridStart = addCivilDays(startOfMonth, -startOfMonth.getUTCDay());
  const gridEnd = addCivilDays(endOfMonth, 6 - endOfMonth.getUTCDay());

  const dates: Date[] = [];
  for (let cursor = gridStart; cursor <= gridEnd; cursor = addCivilDays(cursor, 1)) {
    dates.push(cursor);
  }

  const monthDates = dates.filter((date) => date.getUTCMonth() === currentMonth);
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
