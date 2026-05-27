import { InsightType } from "@/lib/constants";

export type BudgetInsight = {
  is_at_risk: boolean;
  message: string;
};

export type AnomalyInsight = {
  is_detected: boolean;
  message: string;
};

export type TipidTipInsight = {
  has_tip: boolean;
  message: string;
};

export type WeeklyRecapInsight = {
  has_recap: boolean;
  message: string;
};

export type StructuredInsightsPayload = {
  anomaly: AnomalyInsight;
  budget: BudgetInsight;
  tipid_tip: TipidTipInsight;
  weekly_recap: WeeklyRecapInsight;
};

export type InsightApiResponse = StructuredInsightsPayload & {
  insight_type?: string;
  cached?: boolean;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeMessage(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeBoolean(value: unknown): boolean {
  return value === true;
}

export function createEmptyStructuredInsights(): StructuredInsightsPayload {
  return {
    anomaly: {
      is_detected: false,
      message: "",
    },
    budget: {
      is_at_risk: false,
      message: "",
    },
    tipid_tip: {
      has_tip: false,
      message: "",
    },
    weekly_recap: {
      has_recap: false,
      message: "",
    },
  };
}

export function parseStructuredInsightsPayload(
  value: unknown
): StructuredInsightsPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const anomalyRaw = value.anomaly;
  const budgetRaw = value.budget;
  const tipidRaw = value.tipid_tip;
  const weeklyRecapRaw = value.weekly_recap;

  if (
    !isRecord(anomalyRaw) &&
    !isRecord(budgetRaw) &&
    !isRecord(tipidRaw) &&
    !isRecord(weeklyRecapRaw)
  ) {
    return null;
  }

  return {
    anomaly: {
      is_detected: isRecord(anomalyRaw)
        ? sanitizeBoolean(anomalyRaw.is_detected)
        : false,
      message: isRecord(anomalyRaw) ? sanitizeMessage(anomalyRaw.message) : "",
    },
    budget: {
      is_at_risk: isRecord(budgetRaw)
        ? sanitizeBoolean(budgetRaw.is_at_risk)
        : false,
      message: isRecord(budgetRaw) ? sanitizeMessage(budgetRaw.message) : "",
    },
    tipid_tip: {
      has_tip: isRecord(tipidRaw) ? sanitizeBoolean(tipidRaw.has_tip) : false,
      message: isRecord(tipidRaw) ? sanitizeMessage(tipidRaw.message) : "",
    },
    weekly_recap: {
      has_recap: isRecord(weeklyRecapRaw)
        ? sanitizeBoolean(weeklyRecapRaw.has_recap)
        : false,
      message: isRecord(weeklyRecapRaw)
        ? sanitizeMessage(weeklyRecapRaw.message)
        : "",
    },
  };
}

export function parseStructuredInsightsJson(
  value: string | null | undefined
): StructuredInsightsPayload | null {
  if (!value) {
    return null;
  }

  try {
    return parseStructuredInsightsPayload(JSON.parse(value));
  } catch {
    return null;
  }
}

export function getContextualInsightForType(
  payload: StructuredInsightsPayload,
  insightType: InsightType
): { shouldRender: boolean; message: string } {
  switch (insightType) {
    case InsightType.BudgetAlert:
      return {
        shouldRender: payload.budget.is_at_risk && payload.budget.message.length > 0,
        message: payload.budget.message,
      };
    case InsightType.AnomalyAlert:
      return {
        shouldRender:
          payload.anomaly.is_detected && payload.anomaly.message.length > 0,
        message: payload.anomaly.message,
      };
    case InsightType.CostOptimizer:
      return {
        shouldRender:
          payload.tipid_tip.has_tip && payload.tipid_tip.message.length > 0,
        message: payload.tipid_tip.message,
      };
    case InsightType.WeeklyRecap:
      return {
        shouldRender:
          payload.weekly_recap.has_recap && payload.weekly_recap.message.length > 0,
        message: payload.weekly_recap.message,
      };
    default:
      return {
        shouldRender: false,
        message: "",
      };
  }
}

export function getInsightDismissKey(insightType: InsightType): string {
  return `wattwise:dismissed-insight:${insightType}`;
}
