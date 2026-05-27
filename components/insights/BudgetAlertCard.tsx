"use client";

import { AlertTriangle } from "lucide-react";
import ContextualInsightCard from "@/components/insights/ContextualInsightCard";
import { InsightType } from "@/lib/constants";

export default function BudgetAlertCard() {
  return (
    <ContextualInsightCard
      insightType={InsightType.BudgetAlert}
      eyebrow="Budget Alert"
      title="Budget Check"
      icon={AlertTriangle}
      accentClassName="text-naku"
      surfaceClassName="border-naku/25 bg-naku/10"
    />
  );
}
