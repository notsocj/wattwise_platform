import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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
      return "border-mint/25 bg-mint/10 text-mint";
    case "none":
    default:
      return "border-white/[0.06] bg-white/[0.03] text-white/35";
  }
}

export default function WeekSummaryWidget({ days }: WeekSummaryWidgetProps) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
            Calendar Pulse
          </p>
          <h2 className="mt-1 text-sm font-bold tracking-tight">
            This Week At A Glance
          </h2>
        </div>
        <Link
          href="/dashboard/calendar"
          className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-white/70 transition-colors hover:border-mint/20 hover:bg-mint/10 hover:text-mint"
        >
          Expand View
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => (
          <div
            key={day.dayKey}
            className={`rounded-xl border px-2 py-2 text-center ${day.isToday ? "ring-1 ring-mint/40" : ""} ${
              getIntensityClasses(day.intensity)
            }`}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em]">
              {day.weekdayShort}
            </p>
            <p className="mt-1 text-base font-bold">{day.dayNumber}</p>
            <div className="mx-auto mt-2 h-1.5 w-7 rounded-full bg-current/40" />
            <p className="mt-2 text-[10px] font-medium text-white/65">
              ₱{day.costPhp.toFixed(0)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
