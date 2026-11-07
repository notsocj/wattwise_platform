import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { LEGAL_CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/legal";

/** Shared frame for /privacy and /terms: brand bar, title, readable column, contact footer. */
export default function LegalPage({
  title,
  intro,
  other,
  children,
}: {
  title: string;
  intro: ReactNode;
  /** The sibling legal page, linked in the footer. */
  other: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-canvas tracking-tight text-fg">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link
          href="/onboarding"
          className="flex items-center gap-2 rounded-full text-lg font-bold transition-opacity duration-150 ease-out hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint"
        >
          <Image src="/wattwise_mascot.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
          <span>
            Watt<span className="text-accent">Wise</span>
          </span>
        </Link>
        <Link href="/register" className="text-sm font-semibold text-accent hover:underline">
          Create account
        </Link>
      </header>

      <article className="mx-auto max-w-3xl px-6 pb-16 pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent/80">Last updated {LEGAL_UPDATED}</p>
        <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tighter sm:text-5xl">{title}</h1>
        <div className="mt-4 text-lg leading-relaxed text-fg/60">{intro}</div>

        <div className="mt-10 space-y-10 text-[15px] leading-7 text-fg/70 [&_a]:font-semibold [&_a]:text-accent [&_a:hover]:underline [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-fg [&_li]:mt-1.5 [&_p+p]:mt-3 [&_strong]:text-fg/90 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>

        <footer className="mt-14 rounded-3xl border border-fg/[0.06] bg-surface px-6 py-5 text-sm leading-6 text-fg/60">
          Questions or requests? Email{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="font-semibold text-accent hover:underline">
            {LEGAL_CONTACT_EMAIL}
          </a>
          . See also our{" "}
          <Link href={other.href} className="font-semibold text-accent hover:underline">
            {other.label}
          </Link>
          .
        </footer>
      </article>
    </main>
  );
}
