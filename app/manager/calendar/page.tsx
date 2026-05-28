import Link from "next/link";
import CalendarAnalyticsClient from "@/components/calendar/CalendarAnalyticsClient";
import { createClient } from "@/lib/supabase/server";
import { getActiveMeralcoRates } from "@/lib/meralco-rates";
import {
  aggregateUsageByDay,
  buildMonthGrid,
  type UsageByDeviceDayRow,
} from "@/lib/calendar-analytics";
import type { CalendarAnalyticsDayPayload } from "@/lib/calendar-ai";
import { getManagerFleetSnapshot, requireManagerPage } from "@/lib/manager-data";

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

function buildCalendarHref(month: Date, deviceId: string | null): string {
  const params = new URLSearchParams({ month: toMonthParam(month) });
  if (deviceId) {
    params.set("device", deviceId);
  }

  return `/manager/calendar?${params.toString()}`;
}

export default async function ManagerCalendarPage(props: {
  searchParams?: Promise<{ month?: string | string[]; device?: string | string[] }>;
}) {
  const { user, profile } = await requireManagerPage();
  const supabase = await createClient();
  const snapshot = await getManagerFleetSnapshot(
    supabase,
    user.id,
    profile.billing_cycle_start_day ?? 1
  );
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const monthDate = parseMonthParam(searchParams?.month);
  const rawDevice = Array.isArray(searchParams?.device)
    ? searchParams?.device[0]
    : searchParams?.device;
  const selectedDevice = snapshot.devices.find((device) => device.id === rawDevice) ?? null;
  const selectedDeviceId = selectedDevice?.id ?? null;
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

  const usageByDayRows = ((usageByDayRes.data ?? []) as UsageByDeviceDayRow[]).filter(
    (row) => !selectedDeviceId || row.device_id === selectedDeviceId
  );
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
  const scopeLabel = selectedDevice
    ? `${selectedDevice.device_name} (${selectedDevice.tenant_label})`
    : "All manager-owned rooms";

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/[0.06] bg-surface p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
          Room Filter
        </p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <Link
            href={buildCalendarHref(monthDate, null)}
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold transition-colors ${
              !selectedDeviceId
                ? "bg-mint text-black"
                : "bg-white/[0.04] text-white/60 hover:text-white"
            }`}
          >
            All Rooms
          </Link>
          {snapshot.devices.map((device) => (
            <Link
              key={device.id}
              href={buildCalendarHref(monthDate, device.id)}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold transition-colors ${
                selectedDeviceId === device.id
                  ? "bg-mint text-black"
                  : "bg-white/[0.04] text-white/60 hover:text-white"
              }`}
            >
              {device.device_name}
            </Link>
          ))}
        </div>
      </section>

      <CalendarAnalyticsClient
        monthLabel={formatMonthLabel(monthDate)}
        monthTotalCostPhp={monthTotalCostPhp}
        monthTotalKwh={monthTotalKwh}
        daysForAi={daysForAi}
        aiContext={{ viewer_role: "manager", scope_label: scopeLabel }}
        previousMonthHref={buildCalendarHref(prevMonth, selectedDeviceId)}
        nextMonthHref={buildCalendarHref(nextMonth, selectedDeviceId)}
        weeks={weeks}
      />
    </div>
  );
}
