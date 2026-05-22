import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface AdminEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export default function AdminEmptyState({
  icon: Icon,
  title,
  description,
  actions,
}: AdminEmptyStateProps) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center sm:px-6">
      {Icon ? (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-mint">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      <h3 className="text-sm font-bold text-white">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-white/50">
          {description}
        </p>
      ) : null}
      {actions ? <div className="mt-5">{actions}</div> : null}
    </div>
  );
}
