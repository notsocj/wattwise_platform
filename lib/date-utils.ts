const MANILA_TIME_ZONE = "Asia/Manila";
const MANILA_OFFSET_HOURS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

type ManilaDateParts = {
  year: number;
  month: number;
  day: number;
};

function getManilaDateParts(date: Date): ManilaDateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? 0),
    month: Number(parts.find((part) => part.type === "month")?.value ?? 1),
    day: Number(parts.find((part) => part.type === "day")?.value ?? 1),
  };
}

function toUtcDateForManilaMidnight(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, -MANILA_OFFSET_HOURS, 0, 0, 0));
}

function addMonths(year: number, monthIndex: number, delta: number): {
  year: number;
  monthIndex: number;
} {
  const nextMonthIndex = monthIndex + delta;
  const nextYear = year + Math.floor(nextMonthIndex / 12);
  const normalizedMonthIndex = ((nextMonthIndex % 12) + 12) % 12;

  return {
    year: nextYear,
    monthIndex: normalizedMonthIndex,
  };
}

export function getManilaDayKey(date: Date): string {
  const { year, month, day } = getManilaDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getStartOfManilaDay(date: Date = new Date()): Date {
  const { year, month, day } = getManilaDateParts(date);
  return toUtcDateForManilaMidnight(year, month - 1, day);
}

export function getEndOfManilaDay(date: Date = new Date()): Date {
  const startOfDay = getStartOfManilaDay(date);
  return new Date(startOfDay.getTime() + DAY_MS - 1);
}

export function getCurrentBillingCycle(billingStartDay: number, now: Date = new Date()): {
  startDate: Date;
  endDate: Date;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
} {
  const safeBillingStartDay = Number.isInteger(billingStartDay)
    ? Math.min(28, Math.max(1, billingStartDay))
    : 1;
  const { year, month, day } = getManilaDateParts(now);
  const currentMonthIndex = month - 1;
  const startMonth =
    day >= safeBillingStartDay
      ? { year, monthIndex: currentMonthIndex }
      : addMonths(year, currentMonthIndex, -1);
  const nextStartMonth = addMonths(startMonth.year, startMonth.monthIndex, 1);

  const startDate = toUtcDateForManilaMidnight(
    startMonth.year,
    startMonth.monthIndex,
    safeBillingStartDay
  );
  const nextCycleStartDate = toUtcDateForManilaMidnight(
    nextStartMonth.year,
    nextStartMonth.monthIndex,
    safeBillingStartDay
  );
  const endDate = new Date(nextCycleStartDate.getTime() - 1);
  const todayStart = getStartOfManilaDay(now);
  const totalDays = Math.max(
    1,
    Math.round((nextCycleStartDate.getTime() - startDate.getTime()) / DAY_MS)
  );
  const elapsedDays = Math.min(
    totalDays,
    Math.max(1, Math.floor((todayStart.getTime() - startDate.getTime()) / DAY_MS) + 1)
  );

  return {
    startDate,
    endDate,
    totalDays,
    elapsedDays,
    remainingDays: Math.max(0, totalDays - elapsedDays),
  };
}
