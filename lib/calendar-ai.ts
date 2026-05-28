export type CalendarAnalyticsDayPayload = {
  day_key: string;
  weekday: string; 
  kwh: number;
  cost_php: number;
};

export type CalendarAnalyticsRequest = {
  month_label: string;
  days: CalendarAnalyticsDayPayload[];
  viewer_role?: "user" | "manager" | "tenant";
  scope_label?: string;
};

export type CalendarAnalyticsResponse = {
  headline: string;
  summary: string;
  highlights: string[];
};
