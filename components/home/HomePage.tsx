import Link from "next/link";
import { ArrowRight, FolderTree, Gauge, ShieldCheck } from "lucide-react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { siteConfig } from "@/lib/config/site";
import { navigationItems } from "@/lib/constants/navigation";

const foundationAreas = [
  {
    title: "App routes",
    description:
      "The app router now has a home route, a starter dashboard route, and a health endpoint for quick integration checks.",
    icon: FolderTree,
  },
  {
    title: "Shared building blocks",
    description:
      "Reusable components, provider boundaries, typed constants, and utility modules are separated into predictable folders.",
    icon: Gauge,
  },
  {
    title: "Domain groundwork",
    description:
      "Energy summary types, sample data, and Meralco billing helpers are in place for the first product features.",
    icon: ShieldCheck,
  },
];

export function HomePage() {
  return (
    <div className="page-shell">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-12 sm:py-16">
        <section className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div className="animate-rise space-y-6">
            <p className="text-sm font-medium uppercase tracking-[0.35em] text-[var(--color-accent)]">
              {siteConfig.tagline}
            </p>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-6xl">
                Clean project scaffolding for a serious energy platform.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[var(--color-muted)]">
                The starter app has been reshaped into a practical foundation so
                dashboards, AI insights, Supabase flows, and hardware controls
                all have a clear home from day one.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-accent-strong)]"
              >
                Open starter dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/api/health"
                className="inline-flex items-center justify-center rounded-full border border-[var(--color-line)] bg-[color:var(--color-panel)] px-6 py-3 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-accent)]"
              >
                Check API health route
              </Link>
            </div>
          </div>

          <div
            className="animate-rise rounded-[2rem] border border-[var(--color-line)] bg-[color:var(--color-panel)] p-6 shadow-[var(--shadow-soft)]"
            style={{ animationDelay: "120ms" }}
          >
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-[var(--color-accent)]">
              Initial navigation
            </p>
            <ul className="mt-5 space-y-4">
              {navigationItems.map((item) => (
                <li
                  key={item.href}
                  className="flex items-center justify-between border-b border-[var(--color-line)] pb-4 last:border-b-0 last:pb-0"
                >
                  <div>
                    <p className="text-base font-semibold text-[var(--color-ink)]">
                      {item.label}
                    </p>
                    <p className="text-sm text-[var(--color-muted)]">
                      {item.description}
                    </p>
                  </div>
                  <span className="text-sm text-[var(--color-muted)]">
                    {item.href}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {foundationAreas.map(({ title, description, icon: Icon }, index) => (
            <article
              key={title}
              className="animate-rise rounded-[1.75rem] border border-[var(--color-line)] bg-[color:var(--color-panel)] p-6 shadow-[var(--shadow-soft)]"
              style={{ animationDelay: `${index * 100 + 180}ms` }}
            >
              <div className="mb-4 inline-flex rounded-full bg-[var(--color-panel-strong)] p-3 text-[var(--color-accent)]">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-[var(--color-ink)]">
                {title}
              </h2>
              <p className="mt-3 text-base leading-7 text-[var(--color-muted)]">
                {description}
              </p>
            </article>
          ))}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
