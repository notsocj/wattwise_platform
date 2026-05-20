/**
 * Shared application-wide constants as TypeScript enums.
 * Use these instead of raw string literals to prevent typos and
 * enable IDE auto-complete across the codebase.
 */

/**
 * AI insight types stored in the `ai_insights` table and accepted by
 * the /api/insights API route.
 */
export enum InsightType {
  BudgetAlert = 'budget_alert',
  WeeklyRecap = 'weekly_recap',
  AnomalyAlert = 'anomaly_alert',
  CostOptimizer = 'cost_optimizer',
}

/**
 * Appliance categories stored in `devices.appliance_type` and used by
 * the AI setup-recommendation flow and device icon selection.
 */
export enum ApplianceType {
  Refrigerator = 'refrigerator',
  Aircon = 'aircon',
  Tv = 'tv',
  Other = 'other',
}
