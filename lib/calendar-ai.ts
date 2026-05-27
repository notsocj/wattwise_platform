export type CalendarAnalyticsDayPayload = {
  day_key: string;
  weekday: string;
  kwh: number;
  cost_php: number;
};

export type CalendarAnalyticsRequest = {
  month_label: string;
  days: CalendarAnalyticsDayPayload[];
};

export type CalendarAnalyticsResponse = {
  headline: string;
  summary: string;
  highlights: string[];
};
