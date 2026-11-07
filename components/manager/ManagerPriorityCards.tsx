"use client";

import useSWR from "swr";
import { AlertTriangle, Sparkles } from "@/components/ui/icons";
import { LoadingSkeleton } from "@/components/ui/LoadingIndicator";
import { jsonFetcher } from "@/lib/fetcher";

type InsightCard = {
  type: string;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "danger";
};

const SEVERITY = {
  success: { card: "border-mint/25 bg-mint/[0.06]", label: "text-accent" },
  warning: { card: "border-naku/30 bg-naku/[0.08]", label: "text-naku" },
  danger: { card: "border-danger/30 bg-danger/[0.08]", label: "text-danger" },
  info: { card: "border-fg/[0.06] bg-fg/[0.03]", label: "text-fg/55" },
} as const;

/** AI priority cards for the fleet (formerly on the Manager AI page). */
export default function ManagerPriorityCards() {
  const { data, error, isLoading } = useSWR<{ cards: InsightCard[] }>(
    "/api/manager/ai/insights",
    (url: string) => jsonFetcher<{ cards: InsightCard[] }>(url),
    { keepPreviousData: true }
  );
  const cards = Array.isArray(data?.cards) ? data.cards : [];

  return (
    <section className="rounded-2xl border border-fg/[0.06] bg-surface p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint/10 text-accent">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold tracking-tight">AI priorities</h2>
          <p className="text-xs text-fg/45">What needs your attention first.</p>
        </div>
      </div>

      {isLoading && cards.length === 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2" aria-label="Loading AI priorities">
          <LoadingSkeleton className="h-28 rounded-2xl" />
          <LoadingSkeleton className="h-28 rounded-2xl" />
        </div>
      ) : error ? (
        <p className="mt-4 flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error instanceof Error ? error.message : "Could not load AI priorities."}
        </p>
      ) : cards.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-fg/[0.06] bg-fg/[0.03] p-4 text-sm text-fg/50">
          Nothing urgent right now.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {cards.map((card, index) => {
            const tone = SEVERITY[card.severity] ?? SEVERITY.info;
            return (
              <article
                key={card.type}
                style={{ transitionDelay: `${index * 50}ms` }}
                className={`rounded-2xl border p-4 transition-[opacity,translate] duration-300 ease-out starting:translate-y-2 starting:opacity-0 ${tone.card}`}
              >
                <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${tone.label}`}>
                  {card.type.replace(/_/g, " ")}
                </p>
                <h3 className="mt-2 text-base font-bold tracking-tight">{card.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg/70">{card.message}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
