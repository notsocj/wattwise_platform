import type { ReactNode } from "react";

interface AdminChartCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  height?: number;
  actions?: ReactNode;
}

export default function AdminChartCard({
  title,
  description,
  children,
  height = 280,
  actions,
}: AdminChartCardProps) {
  return (
    <section className="min-w-0 rounded-lg border border-white/10 bg-surface p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-white">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-white/50">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div style={{ height }} className="min-w-0 overflow-hidden">
        {children}
      </div>
    </section>
  );
}
