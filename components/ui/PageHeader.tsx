import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import LogoutButton from "@/components/ui/LogoutButton";

type PageHeaderProps = {
  title: ReactNode;
  icon?: LucideIcon;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  /** Replaces the default logout button on the right. */
  actions?: ReactNode;
};

/**
 * Fixed 64px app header for the mobile shell. Pair it with `PAGE_HEADER_OFFSET`
 * on the page body so content always clears it by the same amount.
 */
export const PAGE_HEADER_OFFSET = "pt-[84px]";

export default function PageHeader({
  title,
  icon: Icon,
  eyebrow,
  backHref,
  backLabel = "Back to dashboard",
  actions,
}: PageHeaderProps) {
  return (
    <header className="fixed top-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-b border-white/5 bg-canvas/95 backdrop-blur-sm print:static print:translate-x-0 print:border-black/10 print:bg-transparent">
      <div className="flex h-16 items-center justify-between gap-3 px-5">
        <div className="flex min-w-0 items-center gap-3">
          {backHref ? (
            <Link
              href={backHref}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-white/70 transition-colors hover:text-mint print:hidden"
              aria-label={backLabel}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : null}
          {Icon ? <Icon className="h-5 w-5 shrink-0 text-mint" aria-hidden="true" /> : null}
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/50">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="truncate text-lg font-bold tracking-tight">{title}</h1>
          </div>
        </div>
        <div className="print:hidden">{actions ?? <LogoutButton />}</div>
      </div>
    </header>
  );
}
