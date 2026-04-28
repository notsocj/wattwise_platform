export type InsightResult = {
  message: string;
  insight_type: string;
};

export type InsightState = {
  loading: boolean;
  message: string | null;
  error: string | null;
};

export type InsightType =
  | "budget_alert"
  | "weekly_recap"
  | "anomaly_alert"
  | "cost_optimizer";
