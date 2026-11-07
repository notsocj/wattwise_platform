import type { ReactNode } from "react";
import type { IconComponent } from "@/components/ui/icons";

/** A titled group of settings rows in one rounded card, separated by hairlines. */
export function SettingsGroup({
  title,
  footer,
  tone = "default",
  children,
}: {
  title: string;
  /** Short note under the card. */
  footer?: ReactNode;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <h2 className={`mb-2 px-1 text-xs font-semibold uppercase tracking-[0.14em] ${tone === "danger" ? "text-danger/80" : "text-fg/45"}`}>
        {title}
      </h2>
      <div
        className={`overflow-hidden rounded-2xl border bg-surface divide-y ${
          tone === "danger" ? "border-danger/20 divide-danger/10" : "border-fg/[0.06] divide-fg/[0.06]"
        }`}
      >
        {children}
      </div>
      {footer ? <p className="mt-2 px-1 text-xs leading-relaxed text-fg/40">{footer}</p> : null}
    </section>
  );
}

/** One settings row: icon chip, title, optional description, and a control on the right. */
export function SettingsRow({
  icon: Icon,
  title,
  description,
  control,
  tone = "default",
  children,
}: {
  icon: IconComponent;
  title: ReactNode;
  description?: ReactNode;
  control?: ReactNode;
  tone?: "default" | "danger";
  /** Extra content under the row (inputs, notes, secondary actions). */
  children?: ReactNode;
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            tone === "danger" ? "bg-danger/10 text-danger" : "bg-mint/10 text-accent"
          }`}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${tone === "danger" ? "text-danger" : "text-fg"}`}>{title}</p>
          {description ? <p className="mt-0.5 text-xs leading-relaxed text-fg/50">{description}</p> : null}
        </div>
        {control ? <div className="shrink-0">{control}</div> : null}
      </div>
      {children ? <div className="mt-3 pl-12">{children}</div> : null}
    </div>
  );
}

/** Full-width pressable row (links and actions such as Log out), with press feedback. */
export const SETTINGS_ACTION_ROW =
  "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-[background-color,scale] duration-150 ease-out hover:bg-fg/[0.03] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mint";
