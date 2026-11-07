import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** The one card surface used across the app. */
export const CARD = "rounded-2xl border border-fg/[0.06] bg-surface";

/** Card heading row: icon chip, title, and an optional right-side slot (pill, link, menu). */
export function CardHeader({
  icon: Icon,
  title,
  aside,
  as: Heading = "h2",
}: {
  icon?: LucideIcon;
  title: ReactNode;
  aside?: ReactNode;
  as?: "h2" | "h3" | "p";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mint/10 text-accent">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
        <Heading className="truncate text-sm font-medium text-fg/60">{title}</Heading>
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

/** Small muted pill for card headers ("Billing cycle", "incl. VAT"). */
export function CardPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-fg/[0.08] px-2.5 py-1 text-[11px] font-medium text-fg/50">{children}</span>
  );
}
