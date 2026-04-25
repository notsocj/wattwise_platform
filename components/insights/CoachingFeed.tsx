"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Trophy, Leaf, Search, Zap } from "lucide-react";

type InsightResult = {
  message: string;
  insight_type: string;
};

type InsightState = {
  loading: boolean;
  message: string | null;
  error: string | null;
};

const INSIGHT_TYPES = [
  "budget_alert",
  "weekly_recap",
  "anomaly_alert",
  "cost_optimizer",
] as const;

type InsightType = (typeof INSIGHT_TYPES)[number];

function SkeletonCard() {
  return (
    <div className="rounded-xl bg-surface border border-white/[0.06] p-4 animate-pulse">
      <div className="h-3 w-20 bg-white/10 rounded mb-3" />
      <div className="h-4 w-32 bg-white/10 rounded mb-2" />
      <div className="space-y-1.5">
        <div className="h-3 w-full bg-white/[0.06] rounded" />
        <div className="h-3 w-4/5 bg-white/[0.06] rounded" />
        <div className="h-3 w-3/5 bg-white/[0.06] rounded" />
      </div>
    </div>
  );
}

export default function CoachingFeed() {
  const [insights, setInsights] = useState<Record<InsightType, InsightState>>(
    () => {
      const initial = {} as Record<InsightType, InsightState>;
      for (const type of INSIGHT_TYPES) {
        initial[type] = { loading: true, message: null, error: null };
      }
      return initial;
    }
  );

  const fetchInsight = useCallback(async (insightType: InsightType) => {
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insight_type: insightType }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error || `Failed to fetch ${insightType} (${res.status})`
        );
      }

      const data: InsightResult = await res.json();

      setInsights((prev) => ({
        ...prev,
        [insightType]: {
          loading: false,
          message: data.message,
          error: null,
        },
      }));
    } catch (err) {
      setInsights((prev) => ({
        ...prev,
        [insightType]: {
          loading: false,
          message: null,
          error: err instanceof Error ? err.message : "Unknown error",
        },
      }));
    }
  }, []);

  useEffect(() => {
    for (const type of INSIGHT_TYPES) {
      fetchInsight(type);
    }
  }, [fetchInsight]);

  const budget = insights.budget_alert;
  const recap = insights.weekly_recap;
  const anomaly = insights.anomaly_alert;
  const optimizer = insights.cost_optimizer;

  return (
    <section>
      <h2 className="text-[15px] font-bold mb-3">Coaching Feed</h2>

      {/* Naku! Alert — Budget */}
      {budget.loading ? (
        <SkeletonCard />
      ) : budget.message ? (
        <div className="rounded-xl bg-naku/10 border border-naku/20 p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold tracking-wider text-naku uppercase">
              Naku! Alert
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-naku" />
          </div>
          <h3 className="text-lg font-bold mb-1">Budget Check</h3>
          <p className="text-sm text-white/70 leading-relaxed">
            {budget.message}
          </p>
        </div>
      ) : budget.error ? (
        <div className="rounded-xl bg-surface border border-white/[0.06] p-4 mb-3">
          <p className="text-xs text-white/40">{budget.error}</p>
        </div>
      ) : null}

      {/* Anomaly Detection */}
      {anomaly.loading ? (
        <SkeletonCard />
      ) : anomaly.message ? (
        <div className="rounded-xl bg-danger/10 border border-danger/20 p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold tracking-wider text-danger uppercase">
              Anomaly Detected
            </span>
            <Search className="w-3.5 h-3.5 text-danger" />
          </div>
          <h3 className="text-lg font-bold mb-1">Unusual Pattern</h3>
          <p className="text-sm text-white/70 leading-relaxed">
            {anomaly.message}
          </p>
        </div>
      ) : anomaly.error ? (
        <div className="rounded-xl bg-surface border border-white/[0.06] p-4 mb-3">
          <p className="text-xs text-white/40">{anomaly.error}</p>
        </div>
      ) : null}

      {/* Bento row: Bida Recap + Cost Optimizer */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Bida Recap */}
        {recap.loading ? (
          <SkeletonCard />
        ) : recap.message ? (
          <div className="rounded-xl bg-bida/10 border border-bida/20 p-4 flex flex-col justify-between min-h-[140px]">
            <div>
              <span className="text-[10px] font-bold tracking-wider text-bida uppercase">
                Bida Recap
              </span>
              <h3 className="text-base font-bold mt-1.5 leading-snug">
                Weekly Win!
              </h3>
              <p className="text-xs text-white/60 mt-1 leading-relaxed">
                {recap.message}
              </p>
            </div>
            <Trophy className="w-5 h-5 text-bida mt-2" />
          </div>
        ) : recap.error ? (
          <div className="rounded-xl bg-surface border border-white/[0.06] p-4 min-h-[140px]">
            <p className="text-xs text-white/40">{recap.error}</p>
          </div>
        ) : null}

        {/* Cost Optimizer */}
        {optimizer.loading ? (
          <SkeletonCard />
        ) : optimizer.message ? (
          <div className="rounded-xl bg-surface border border-white/[0.06] p-4 flex flex-col justify-between min-h-[140px]">
            <div>
              <span className="text-[10px] font-bold tracking-wider text-mint/60 uppercase">
                Tipid Tip
              </span>
              <p className="text-xs text-white/70 mt-1.5 leading-relaxed">
                {optimizer.message}
              </p>
            </div>
            <Leaf className="w-5 h-5 text-bida mt-2" />
          </div>
        ) : optimizer.error ? (
          <div className="rounded-xl bg-surface border border-white/[0.06] p-4 min-h-[140px]">
            <p className="text-xs text-white/40">{optimizer.error}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
