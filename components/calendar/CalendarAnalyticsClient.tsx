"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import type { CalendarDailySummary } from "@/lib/calendar-analytics";
import type {
  CalendarAnalyticsDayPayload,
  CalendarAnalyticsRequest,
  CalendarAnalyticsResponse,
} from "@/lib/calendar-ai";

type CalendarAnalyticsClientProps = {
  monthLabel: string;
  monthTotalCostPhp: number;
  monthTotalKwh: number;
  daysForAi: CalendarAnalyticsDayPayload[];
  aiContext?: Pick<CalendarAnalyticsRequest, "viewer_role" | "scope_label">;
  previousMonthHref?: string;
  nextMonthHref?: string;
  weeks: CalendarDailySummary[][];
};

function getDayCircleClasses(intensity: CalendarDailySummary["intensity"]): string {
  switch (intensity) {
    case "high":
      return "bg-danger text-white shadow-[0_10px_26px_rgba(239,68,68,0.22)]";
    case "medium":
      return "bg-naku text-white shadow-[0_10px_26px_rgba(245,158,11,0.18)]";
    case "low":
      return "bg-bida text-white shadow-[0_10px_26px_rgba(16,185,129,0.2)]";
    default:
      return "bg-transparent text-white";
  }
}

function getIndicatorClasses(intensity: CalendarDailySummary["intensity"]): string {
  switch (intensity) {
    case "high":
      return "bg-danger";
    case "medium":
      return "bg-naku";
    case "low":
      return "bg-bida";
    case "none":
    default:
      return "bg-white/10";
  }
}

function formatFullDate(dayKey: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dayKey}T00:00:00`));
}

function getModalBadgeClasses(intensity: CalendarDailySummary["intensity"]): string {
  switch (intensity) {
    case "high":
      return "bg-danger/18 text-danger";
    case "medium":
      return "bg-naku/18 text-naku";
    case "low":
      return "bg-bida/18 text-bida";
    case "none":
    default:
      return "bg-white/[0.05] text-white/35";
  }
}

export default function CalendarAnalyticsClient({
  monthLabel,
  monthTotalCostPhp,
  monthTotalKwh,
  daysForAi,
  aiContext,
  previousMonthHref,
  nextMonthHref,
  weeks,
}: CalendarAnalyticsClientProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CalendarAnalyticsResponse | null>(null);
  const [selectedDay, setSelectedDay] = useState<CalendarDailySummary | null>(null);
  const safePreviousMonthHref = previousMonthHref || "/dashboard/calendar";
  const safeNextMonthHref = nextMonthHref || "/dashboard/calendar";

  async function handleConsultAi() {
    setIsPanelOpen(true);
    setIsLoading(true);
    setError(null);

    try {
      const payload: CalendarAnalyticsRequest = {
        month_label: monthLabel,
        days: daysForAi,
        viewer_role: aiContext?.viewer_role,
        scope_label: aiContext?.scope_label,
      };

      const response = await fetch("/api/insights/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "We could not generate calendar analytics right now."
        );
      }

      const nextAnalysis = (await response.json()) as CalendarAnalyticsResponse;
      setAnalysis(nextAnalysis);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "We could not generate calendar analytics right now."
      );
      setAnalysis(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-5 pb-28">
        <section className="rounded-[28px] bg-surface/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
                Energy Calendar
              </p>
              <h2 className="mt-1 text-[28px] font-bold tracking-tight">{monthLabel}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={safePreviousMonthHref}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link
                href={safeNextMonthHref}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/[0.03] p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Month kWh
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight">{monthTotalKwh.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Variable Spend
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight">
                ₱{monthTotalCostPhp.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-surface/80 p-4">
          <div className="mb-3 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="grid gap-2">
            {weeks.map((week, weekIndex) => (
              <div key={`week-${weekIndex}`} className="grid grid-cols-7 gap-2">
                {week.map((day) => (
                  <button
                    type="button"
                    key={day.dayKey}
                    onClick={() => setSelectedDay(day)}
                    className={`flex min-h-[76px] items-start justify-center rounded-2xl p-1.5 text-center transition-transform hover:scale-[1.01] ${
                      day.isCurrentMonth ? "" : "opacity-40"
                    }`}
                  >
                    <div className="flex h-full w-full flex-col items-center">
                      <div
                        className={`relative flex h-11 w-11 items-center justify-center rounded-full text-[17px] font-bold tracking-tight ${
                          day.kwh > 0
                            ? getDayCircleClasses(day.intensity)
                            : day.isCurrentMonth
                              ? "text-white"
                              : "text-white/55"
                        } ${day.isToday ? "ring-2 ring-mint/70 ring-offset-2 ring-offset-surface" : ""}`}
                      >
                        {day.dayNumber}
                        {day.isToday ? (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-mint" />
                        ) : null}
                      </div>

                      {day.kwh > 0 ? (
                        <span
                          className={`mt-2 h-1.5 w-1.5 rounded-full ${getIndicatorClasses(
                            day.intensity
                          )}`}
                        />
                      ) : (
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-transparent" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>

        <div className="sticky bottom-24 z-10 pt-1">
          <button
            type="button"
            onClick={() => void handleConsultAi()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-mint px-4 py-3.5 text-sm font-bold text-base shadow-[0_16px_40px_rgba(0,230,111,0.18)] transition-transform hover:scale-[0.995] active:scale-[0.985]"
          >
            <Sparkles className="h-4 w-4" />
            Consult AI Analytics
          </button>
        </div>
      </div>

      {isPanelOpen ? (
        <div className="fixed inset-x-0 top-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 bg-black/60 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close analytics panel"
            className="absolute inset-0"
            onClick={() => {
              if (!isLoading) {
                setIsPanelOpen(false);
              }
            }}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[min(78vh,100%)] overflow-y-auto rounded-t-[28px] bg-surface px-5 pb-6 pt-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-mint/70">
                  AI Calendar Read
                </p>
                <h3 className="mt-1 text-xl font-bold tracking-tight">
                  {analysis?.headline ?? "Reading your month..."}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPanelOpen(false)}
                disabled={isLoading}
                className="rounded-full bg-white/[0.04] p-2 text-white/60 transition-colors hover:bg-white/[0.07] hover:text-white disabled:opacity-40"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isLoading ? (
              <div className="flex min-h-[180px] items-center justify-center">
                <LoadingIndicator
                  size="md"
                  label="Consulting your calendar habits"
                  spinnerClassName="border-white/20 border-t-mint"
                />
              </div>
            ) : error ? (
              <div className="rounded-2xl bg-danger/10 p-4">
                <p className="text-sm leading-relaxed text-danger">{error}</p>
              </div>
            ) : analysis ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-white/[0.03] p-4">
                  <p className="text-sm leading-relaxed text-white/75">
                    {analysis.summary}
                  </p>
                </div>

                {analysis.highlights.length > 0 ? (
                  <div className="space-y-2">
                    {analysis.highlights.map((highlight) => (
                      <div
                        key={highlight}
                        className="rounded-2xl bg-mint/10 p-3"
                      >
                        <p className="text-sm leading-relaxed text-white/80">
                          {highlight}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedDay ? (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md">
          <button
            type="button"
            aria-label="Close day details"
            className="absolute inset-0"
            onClick={() => setSelectedDay(null)}
          />
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-[28px] bg-surface p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
                  Day Details
                </p>
                <h3 className="mt-1 text-xl font-bold tracking-tight">
                  {formatFullDate(selectedDay.dayKey)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="rounded-full bg-white/[0.04] p-2 text-white/60 transition-colors hover:bg-white/[0.07] hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/[0.03] p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Usage
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight">
                  {selectedDay.kwh.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-white/55">kWh for the day</p>
              </div>
              <div className="rounded-2xl bg-white/[0.03] p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Variable Spend
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight">
                  ₱{selectedDay.costPhp.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-white/55">Estimated by active Meralco rate</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Usage Level
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${getIndicatorClasses(selectedDay.intensity)}`}
                  />
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getModalBadgeClasses(
                      selectedDay.intensity
                    )}`}
                  >
                    {selectedDay.kwh > 0 ? selectedDay.intensity : "idle"}
                  </span>
                </div>
              </div>
              <p className="max-w-36 text-right text-[11px] leading-relaxed text-white/60">
                {selectedDay.kwh > 0
                  ? "Tap other days to compare your burn pattern."
                  : "No meaningful usage logged for this day."}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
