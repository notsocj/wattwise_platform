"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Sparkles, X } from "@/components/ui/icons";
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
      return "bg-danger/20 font-bold text-danger";
    case "medium":
      return "bg-naku/20 font-bold text-naku";
    case "low":
      return "bg-mint/15 font-bold text-accent";
    default:
      return "bg-transparent text-fg";
  }
}

function getIndicatorClasses(intensity: CalendarDailySummary["intensity"]): string {
  switch (intensity) {
    case "high":
      return "bg-danger";
    case "medium":
      return "bg-naku";
    case "low":
      return "bg-mint";
    case "none":
    default:
      return "bg-fg/10";
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
      return "bg-mint/15 text-accent";
    case "none":
    default:
      return "bg-fg/[0.05] text-fg/50";
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
      <div className="flex flex-col gap-5 pb-28 lg:grid lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:items-start lg:pb-0">
        <section className="rounded-2xl border border-fg/[0.06] bg-surface p-5 lg:col-span-7 lg:row-start-1 xl:col-span-4 xl:col-start-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-fg/45">
                Energy Calendar
              </p>
              <h2 className="mt-1 text-[28px] font-bold tracking-tight">{monthLabel}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={safePreviousMonthHref}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-fg/[0.04] text-fg/65 transition-colors hover:bg-fg/[0.07] hover:text-fg"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link
                href={safeNextMonthHref}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-fg/[0.04] text-fg/65 transition-colors hover:bg-fg/[0.07] hover:text-fg"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-fg/[0.03] p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg/45">
                Month kWh
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight">{monthTotalKwh.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl bg-fg/[0.03] p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg/45">
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

        <section className="rounded-2xl border border-fg/[0.06] bg-surface p-4 lg:col-span-12 lg:row-start-2 lg:p-6 xl:col-span-8 xl:col-start-5 xl:row-span-2 xl:row-start-1">
          <div className="mb-3 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-fg/45">
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
                              ? "text-fg"
                              : "text-fg/55"
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

        <div className="sticky bottom-24 z-10 pt-1 lg:static lg:col-span-5 lg:row-start-1 lg:self-end lg:pt-0 xl:col-span-4 xl:col-start-1 xl:row-start-2 xl:self-start">
          <button
            type="button"
            onClick={() => void handleConsultAi()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-mint px-4 py-3.5 text-sm font-bold text-ink transition-transform hover:scale-[0.995] active:scale-[0.985]"
          >
            <Sparkles className="h-4 w-4" />
            Consult AI Analytics
          </button>
        </div>
      </div>

      {isPanelOpen ? (
        <div className="fixed inset-x-0 top-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ease-out starting:opacity-0 lg:bottom-0 lg:z-50">
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
          <div className="absolute inset-x-0 bottom-0 max-h-[min(78vh,100%)] overflow-y-auto rounded-t-[28px] bg-surface px-5 pb-6 pt-5 shadow-2xl transition-[translate] duration-[400ms] ease-drawer starting:translate-y-full lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[440px] lg:rounded-none lg:rounded-l-[28px] lg:px-7 lg:pt-7 lg:starting:translate-x-full lg:starting:translate-y-0">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent/70">
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
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-fg/[0.04] text-fg/60 transition-colors hover:bg-fg/[0.07] hover:text-fg disabled:opacity-40"
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
                  spinnerClassName="border-fg/20 border-t-mint"
                />
              </div>
            ) : error ? (
              <div className="rounded-2xl bg-danger/10 p-4">
                <p className="text-sm leading-relaxed text-danger">{error}</p>
              </div>
            ) : analysis ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-fg/[0.03] p-4">
                  <p className="text-sm leading-relaxed text-fg/75">
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
                        <p className="text-sm leading-relaxed text-fg/80">
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
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md transition-opacity duration-200 ease-out starting:opacity-0">
          <button
            type="button"
            aria-label="Close day details"
            className="absolute inset-0"
            onClick={() => setSelectedDay(null)}
          />
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-2xl bg-surface p-5 shadow-2xl transition-[scale,opacity] duration-200 ease-out starting:scale-[0.96] starting:opacity-0 lg:inset-x-auto lg:left-1/2 lg:w-[440px] lg:-translate-x-1/2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-fg/45">
                  Day Details
                </p>
                <h3 className="mt-1 text-xl font-bold tracking-tight">
                  {formatFullDate(selectedDay.dayKey)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-fg/[0.04] text-fg/60 transition-colors hover:bg-fg/[0.07] hover:text-fg"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-fg/[0.03] p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg/45">
                  Usage
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight">
                  {selectedDay.kwh.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-fg/55">kWh for the day</p>
              </div>
              <div className="rounded-2xl bg-fg/[0.03] p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg/45">
                  Variable Spend
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight">
                  ₱{selectedDay.costPhp.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-fg/55">Estimated by active Meralco rate</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-fg/[0.03] px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg/45">
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
              <p className="max-w-36 text-right text-[11px] leading-relaxed text-fg/60">
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
