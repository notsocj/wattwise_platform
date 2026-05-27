"use client";

import { useEffect, useState } from "react";
import { X, type LucideIcon } from "lucide-react";
import { InsightType } from "@/lib/constants";
import {
  createEmptyStructuredInsights,
  getContextualInsightForType,
  getInsightDismissKey,
  type InsightApiResponse,
} from "@/lib/insights";

type ContextualInsightCardProps = {
  insightType: InsightType;
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  accentClassName: string;
  surfaceClassName: string;
  titleClassName?: string;
};

export default function ContextualInsightCard({
  insightType,
  eyebrow,
  title,
  icon: Icon,
  accentClassName,
  surfaceClassName,
  titleClassName = "text-white",
}: ContextualInsightCardProps) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadInsight() {
      try {
        const response = await fetch("/api/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ insight_type: insightType }),
        });

        if (!response.ok) {
          if (!ignore) {
            setLoading(false);
          }
          return;
        }

        const payload = (await response.json()) as InsightApiResponse;
        const nextInsight = getContextualInsightForType(
          {
            anomaly: payload.anomaly ?? createEmptyStructuredInsights().anomaly,
            budget: payload.budget ?? createEmptyStructuredInsights().budget,
            tipid_tip:
              payload.tipid_tip ?? createEmptyStructuredInsights().tipid_tip,
            weekly_recap:
              payload.weekly_recap ?? createEmptyStructuredInsights().weekly_recap,
          },
          insightType
        );
        const nextMessage = nextInsight.message.trim() || null;

        if (ignore) {
          return;
        }

        const storedMessage =
          typeof window === "undefined"
            ? null
            : window.localStorage.getItem(getInsightDismissKey(insightType));

        setMessage(nextMessage);
        setShouldRender(nextInsight.shouldRender);
        setDismissed(Boolean(nextMessage) && storedMessage === nextMessage);
        setLoading(false);
      } catch {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadInsight();

    return () => {
      ignore = true;
    };
  }, [insightType]);

  if (
    loading ||
    !message ||
    dismissed ||
    !shouldRender
  ) {
    return null;
  }

  return (
    <section className={`rounded-xl border p-4 ${surfaceClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-[0.24em] ${accentClassName}`}>
              {eyebrow}
            </span>
            <Icon className={`h-4 w-4 ${accentClassName}`} />
          </div>
          <h3 className={`mt-2 text-lg font-bold tracking-tight ${titleClassName}`}>
            {title}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.localStorage.setItem(getInsightDismissKey(insightType), message);
            }
            setDismissed(true);
          }}
          className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
          aria-label={`Dismiss ${title}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-white/70">{message}</p>
    </section>
  );
}
