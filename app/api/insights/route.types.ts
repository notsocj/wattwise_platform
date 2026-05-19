import type { InsightType } from "@/lib/interfaces/InsightType";

export type { InsightType };

export const VALID_INSIGHT_TYPES = [
  "budget_alert",
  "weekly_recap",
  "anomaly_alert",
  "cost_optimizer",
] as const;

export const CACHE_WINDOW_DAYS: Record<InsightType, number> = {
  budget_alert: 1,
  weekly_recap: 7,
  anomaly_alert: 1,
  cost_optimizer: 7,
};
