import Link from "next/link";
import { navigationItems } from "@/lib/constants/navigation";
import { siteConfig } from "@/lib/config/site";

export function SiteHeader() {
  return (
    <header className="animate-rise border-b border-[var(--color-line)]">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-5">
        <Link href="/" className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-[var(--color-accent)]">
            Energy Intelligence
          </span>
          <span className="text-lg font-semibold tracking-tight">
            {siteConfig.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-[var(--color-muted)] md:flex">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-[var(--color-ink)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
