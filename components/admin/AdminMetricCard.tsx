import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type AdminMetricTone = "default" | "success" | "warning" | "danger" | "info";

const toneStyles: Record<AdminMetricTone, string> = {
  default: "border-white/10 bg-white/[0.03] text-white/60",
  success: "border-mint/20 bg-mint/10 text-mint",
  warning: "border-naku/25 bg-naku/10 text-naku",
  danger: "border-danger/25 bg-danger/10 text-danger",
  info: "border-white/10 bg-white/[0.06] text-white/70",
};

interface AdminMetricCardProps {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  trend?: ReactNode;
  icon?: LucideIcon;
  tone?: AdminMetricTone;
}

export default function AdminMetricCard({
  label,
  value,
  helper,
  trend,
  icon: Icon,
  tone = "default",
}: AdminMetricCardProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
            {label}
          </p>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white">
            {value}
          </div>
        </div>
        {Icon ? (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${toneStyles[tone]}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
      <div className="flex min-h-5 items-center justify-between gap-3 text-xs">
        {helper ? <p className="text-white/50">{helper}</p> : <span />}
        {trend ? (
          <div className="shrink-0 font-semibold text-mint">{trend}</div>
        ) : null}
      </div>
    </div>
  );
}
