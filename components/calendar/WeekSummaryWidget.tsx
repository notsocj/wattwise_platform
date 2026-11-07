import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "@/components/ui/icons";
import { CARD, CardHeader } from "@/components/ui/Card";
import type { CalendarDailySummary } from "@/lib/calendar-analytics";

type WeekSummaryWidgetProps = {
  days: CalendarDailySummary[];
};

function getIntensityClasses(intensity: CalendarDailySummary["intensity"]): string {
  switch (intensity) {
    case "high":
      return "border-danger/25 bg-danger/10 text-danger";
    case "medium":
      return "border-naku/25 bg-naku/10 text-naku";
    case "low":
      return "border-mint/25 bg-mint/10 text-accent";
    case "none":
    default:
      return "border-fg/[0.06] bg-fg/[0.03] text-fg/50";
  }
}

function formatDayCost(costPhp: number): string {
  if (costPhp <= 0) return "₱0";
  if (costPhp < 1) return "<₱1";
  // Cells are about 30px wide on phones; keep amounts to four characters.
  return costPhp < 1000 ? `₱${Math.round(costPhp)}` : `₱${(costPhp / 1000).toFixed(1)}k`;
}

export default function WeekSummaryWidget({ days }: WeekSummaryWidgetProps) {
  const maxKwh = Math.max(0, ...days.map((day) => day.kwh));

  return (
    <section className={`${CARD} p-4 lg:p-6`}>
      <div className="mb-4">
        <CardHeader
          icon={CalendarDays}
          title="This week"
          aside={
            <Link
              href="/dashboard/calendar"
              className="inline-flex items-center gap-1 rounded-full border border-fg/[0.08] px-2.5 py-1 text-[11px] font-medium text-fg/60 transition-colors duration-150 ease-out hover:border-mint/30 hover:text-accent"
            >
              Open calendar
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        />
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          // Share of the busiest day this week; a sliver stays visible for any usage.
          const fillPercent = maxKwh > 0 && day.kwh > 0 ? Math.max(12, (day.kwh / maxKwh) * 100) : 0;
          return (
            <div
              key={day.dayKey}
              title={`${day.kwh.toFixed(2)} kWh`}
              className={`min-w-0 rounded-xl border px-0.5 py-2 text-center ${day.isToday ? "ring-1 ring-mint/40" : ""} ${
                getIntensityClasses(day.intensity)
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide">{day.weekdayShort}</p>
              <p className="mt-1 text-base font-bold tabular-nums">{day.dayNumber}</p>
              <div className="mx-1.5 mt-2 h-1.5 overflow-hidden rounded-full bg-fg/10">
                <div className="h-full rounded-full bg-current" style={{ width: `${fillPercent}%` }} />
              </div>
              <p className="mt-2 truncate text-[10px] font-medium tracking-tight tabular-nums text-fg/65">
                {formatDayCost(day.costPhp)}
              </p>
            </div>
          );
        })}
      </div>
      {maxKwh <= 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-fg/50">
          No readings in the last 7 days. Check that your WattWise units are plugged in and online.
        </p>
      ) : null}
    </section>
  );
}
