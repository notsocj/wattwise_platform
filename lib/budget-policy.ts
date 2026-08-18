export type BudgetSeverity = "normal" | "info" | "warning" | "critical";

export function getBudgetProgressPercent(
  variableSpendPhp: number,
  approvedLimitPhp: number
): number {
  if (!Number.isFinite(variableSpendPhp) || variableSpendPhp <= 0) return 0;
  if (!Number.isFinite(approvedLimitPhp) || approvedLimitPhp <= 0) return 0;
  return Math.max(0, (variableSpendPhp / approvedLimitPhp) * 100);
}

export function getBudgetSeverity(percent: number): BudgetSeverity {
  if (!Number.isFinite(percent) || percent < 50) return "normal";
  if (percent < 80) return "info";
  if (percent < 100) return "warning";
  return "critical";
}

export function getBudgetToneClasses(percent: number): {
  bar: string;
  text: string;
  border: string;
  background: string;
} {
  switch (getBudgetSeverity(percent)) {
    case "critical":
      return {
        bar: "bg-danger",
        text: "text-danger",
        border: "border-danger/30",
        background: "bg-danger/10",
      };
    case "warning":
      return {
        bar: "bg-naku",
        text: "text-naku",
        border: "border-naku/30",
        background: "bg-naku/10",
      };
    case "info":
      return {
        bar: "bg-bida",
        text: "text-bida",
        border: "border-bida/30",
        background: "bg-bida/10",
      };
    default:
      return {
        bar: "bg-mint",
        text: "text-bida",
        border: "border-white/[0.08]",
        background: "bg-white/[0.03]",
      };
  }
}

export function isAutoCutoffEnabled(requireApprovalOnExpiry: boolean | null): boolean {
  return requireApprovalOnExpiry !== true;
}
