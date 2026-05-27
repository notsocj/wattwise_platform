"use client";

import { Leaf } from "lucide-react";
import ContextualInsightCard from "@/components/insights/ContextualInsightCard";
import { InsightType } from "@/lib/constants";

export default function TipidTipCard() {
  return (
    <ContextualInsightCard
      insightType={InsightType.CostOptimizer}
      eyebrow="Tipid Tip"
      title="Small Move, Real Savings"
      icon={Leaf}
      accentClassName="text-bida"
      surfaceClassName="border-mint/20 bg-mint/10"
    />
  );
}
