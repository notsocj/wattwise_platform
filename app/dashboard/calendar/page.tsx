import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import BottomNav from "@/components/ui/BottomNav";
import LogoutButton from "@/components/ui/LogoutButton";
import ThemeToggle from "@/components/ui/ThemeToggle";
import CalendarAnalyticsClient from "@/components/calendar/CalendarAnalyticsClient";
import { createClient } from "@/lib/supabase/server";
import { getActiveMeralcoRates } from "@/lib/meralco-rates";
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
    return new Date();
  }

  const [yearPart, monthPart] = value.split("-").map(Number);
  if (!yearPart || !monthPart || monthPart < 1 || monthPart > 12) {
    return new Date();
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
  const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);
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
    <div className="min-h-screen bg-base pb-24 text-white">
      <header className="fixed top-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-b border-white/5 bg-base/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-5">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-white/70 transition-colors hover:text-mint"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/40">
                Expand View
              </p>
              <h1 className="mt-1 text-lg font-bold tracking-tight">
                Calendar Analytics
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="px-5 pt-[92px]">
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
