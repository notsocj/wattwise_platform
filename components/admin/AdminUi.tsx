import type { ReactNode } from "react";
import type { IconComponent } from "@/components/ui/icons";

/** Title block shared by every admin page. */
export function AdminPageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: IconComponent;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mint/10 text-accent">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-fg/50">{description}</p>
        </div>
      </div>
      {actions}
    </header>
  );
}

/** One number with a label and an optional hint. */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "warning" | "danger" | "good";
}) {
  const valueTone =
    tone === "warning" ? "text-naku" : tone === "danger" ? "text-danger" : tone === "good" ? "text-accent" : "text-fg";
  return (
    <div className="rounded-2xl border border-fg/[0.06] bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fg/45">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${valueTone}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-fg/45">{hint}</p> : null}
    </div>
  );
}

/** A titled card for charts, tables, and lists. */
export function AdminSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-fg/[0.06] bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-fg/45">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Manila calendar day (YYYY-MM-DD) for a timestamp. */
export function manilaDayKey(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

/** The last `days` Manila day keys, oldest first, ending today. */
export function lastManilaDays(days: number): string[] {
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    keys.push(manilaDayKey(new Date(Date.now() - offset * 86_400_000)));
  }
  return keys;
}

/** "Nov 7" from a YYYY-MM-DD key. */
export function shortDayLabel(dayKey: string): string {
  return new Date(`${dayKey}T00:00:00+08:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}
