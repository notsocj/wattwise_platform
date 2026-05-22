import type { ReactNode } from "react";

interface AdminSectionProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function AdminSection({
  title,
  description,
  actions,
  children,
  className = "",
}: AdminSectionProps) {
  return (
    <section
      className={`min-w-0 rounded-lg border border-white/10 bg-surface p-4 sm:p-6 ${className}`}
    >
      {title || description || actions ? (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-base font-bold text-white">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm leading-6 text-white/50">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
