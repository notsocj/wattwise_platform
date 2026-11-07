import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, type IconComponent } from "@/components/ui/icons";
import LogoutButton from "@/components/ui/LogoutButton";
import { LoadingSkeleton } from "@/components/ui/LoadingIndicator";

type PageHeaderProps = {
  title: ReactNode;
  icon?: IconComponent;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  /** Desktop only: a line under the title. Desktop has no top bar, so this is the page intro. */
  description?: ReactNode;
  /** Desktop only: replaces `title` (e.g. a greeting instead of the brand). */
  desktopTitle?: ReactNode;
  /** Replaces the default logout button on the right. */
  actions?: ReactNode;
};

/**
 * Phones: fixed 64px app bar. Pair it with `PAGE_HEADER_OFFSET` (plus
 * `lg:pt-0`) on the page body so content clears it.
 * Desktop: an in-page title block (title, description, actions) that scrolls
 * with the page; the sidebar covers navigation, so there is no back button.
 */
export const PAGE_HEADER_OFFSET = "pt-[84px]";

export default function PageHeader({
  title,
  icon: Icon,
  eyebrow,
  backHref,
  backLabel = "Back to dashboard",
  description,
  desktopTitle,
  actions,
}: PageHeaderProps) {
  return (
    <header className="fixed top-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 md:max-w-2xl border-b border-fg/5 bg-canvas/95 backdrop-blur-sm lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:border-0 lg:bg-transparent lg:backdrop-blur-none print:static print:translate-x-0 print:border-black/10 print:bg-transparent">
      <div className="flex h-16 items-center justify-between gap-3 px-5 lg:ww-enter lg:h-auto lg:items-end lg:gap-6 lg:pb-8 lg:pt-10">
        <div className="flex min-w-0 items-center gap-3">
          {backHref ? (
            <Link
              href={backHref}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-fg/[0.06] bg-fg/[0.03] text-fg/70 transition-colors hover:text-accent lg:hidden print:hidden"
              aria-label={backLabel}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : null}
          {Icon ? <Icon className="h-5 w-5 shrink-0 text-accent lg:hidden" aria-hidden="true" /> : null}
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-fg/50 lg:hidden">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="truncate text-lg font-bold tracking-tight lg:text-[32px] lg:leading-tight lg:font-semibold lg:tracking-tighter">
              {desktopTitle ? (
                <>
                  <span className="lg:hidden">{title}</span>
                  <span className="hidden lg:inline">{desktopTitle}</span>
                </>
              ) : (
                title
              )}
            </h1>
            {description ? <p className="mt-1.5 hidden text-sm text-fg/50 lg:block">{description}</p> : null}
          </div>
        </div>
        {/* On desktop the sidebar has the logout button. */}
        <div className={actions ? "shrink-0 print:hidden" : "print:hidden lg:hidden"}>{actions ?? <LogoutButton />}</div>
      </div>
    </header>
  );
}

/** Desktop stand-in for the title block while a route loads (phones show nothing extra). */
export function PageTitleSkeleton() {
  return (
    <div aria-hidden="true" className="hidden pb-8 pt-10 lg:block">
      <LoadingSkeleton className="h-9 w-64 rounded-lg" />
      <LoadingSkeleton className="mt-3 h-4 w-80 rounded" />
    </div>
  );
}
