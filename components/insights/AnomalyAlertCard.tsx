"use client";

import { Search } from "lucide-react";
import ContextualInsightCard from "@/components/insights/ContextualInsightCard";
import { InsightType } from "@/lib/constants";

export default function AnomalyAlertCard() {
  return (
    <ContextualInsightCard
      insightType={InsightType.AnomalyAlert}
      eyebrow="Anomaly Alert"
      title="Unusual Pattern"
      icon={Search}
      accentClassName="text-danger"
      surfaceClassName="border-danger/25 bg-danger/10"
    />
  );
}
