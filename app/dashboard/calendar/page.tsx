import PageHeader from "@/components/ui/PageHeader";
import { redirect } from "next/navigation";
import BottomNav from "@/components/ui/BottomNav";
import CalendarAnalyticsClient from "@/components/calendar/CalendarAnalyticsClient";
import { createClient } from "@/lib/supabase/server";
import { getActiveMeralcoRates } from "@/lib/meralco-rates";
import { getManilaMonthStart, getManilaMonthWindow } from "@/lib/date-utils";
import {
  aggregateUsageByDay,
  buildMonthGrid,
  type UsageByDeviceDayRow,
} from "@/lib/calendar-analytics";
import type { CalendarAnalyticsDayPayload } from "@/lib/calendar-ai";

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function parseMonthParam(raw: string | string[] | undefined): Date {
  const value = Array.isArray(raw) ? raw[0] : raw;

  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return getManilaMonthStart();
  }

  const [yearPart, monthPart] = value.split("-").map(Number);
  if (!yearPart || !monthPart || monthPart < 1 || monthPart > 12) {
    return getManilaMonthStart();
  }

  return new Date(yearPart, monthPart - 1, 1);
}

function toMonthParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export default async function DashboardCalendarPage(props: {
  searchParams?: Promise<{ month?: string | string[] }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const monthDate = parseMonthParam(searchParams?.month);
  const { start: startOfMonth, end: endOfMonth } = getManilaMonthWindow(
    monthDate.getFullYear(),
    monthDate.getMonth()
  );
  const prevMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
  const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);

  const [activeRates, usageByDayRes] = await Promise.all([
    getActiveMeralcoRates(supabase),
    supabase.rpc("get_usage_kwh_by_device_day", {
      p_user_id: user.id,
      p_start: startOfMonth.toISOString(),
      p_end: endOfMonth.toISOString(),
    }),
  ]);

  const usageByDayRows = (usageByDayRes.data ?? []) as UsageByDeviceDayRow[];
  const dailyUsageMap = aggregateUsageByDay(usageByDayRows);
  const weeks = buildMonthGrid({
    monthDate,
    usageByDay: dailyUsageMap,
    rates: activeRates.rates,
    vatRate: activeRates.vatRate,
  });
  const currentMonthDays = weeks.flat().filter((day) => day.isCurrentMonth);
  const monthTotalKwh = currentMonthDays.reduce((sum, day) => sum + day.kwh, 0);
  const monthTotalCostPhp = currentMonthDays.reduce((sum, day) => sum + day.costPhp, 0);
  const daysForAi: CalendarAnalyticsDayPayload[] = currentMonthDays.map((day) => ({
    day_key: day.dayKey,
    weekday: day.weekdayShort,
    kwh: day.kwh,
    cost_php: day.costPhp,
  }));

  return (
    <div className="min-h-screen bg-canvas pb-24 text-white">
      <PageHeader backHref="/dashboard" eyebrow="Expand View" title="Calendar Analytics" />

      <main className="px-5 pt-[84px]">
        <CalendarAnalyticsClient
          monthLabel={formatMonthLabel(monthDate)}
          monthTotalCostPhp={monthTotalCostPhp}
          monthTotalKwh={monthTotalKwh}
          daysForAi={daysForAi}
          previousMonthHref={`/dashboard/calendar?month=${toMonthParam(prevMonth)}`}
          nextMonthHref={`/dashboard/calendar?month=${toMonthParam(nextMonth)}`}
          weeks={weeks}
        />
      </main>

      <BottomNav />
    </div>
  );
}
