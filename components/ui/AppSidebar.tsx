"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import LogoutButton from "@/components/ui/LogoutButton";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { getActiveHref, type NavItem, type NavSection } from "@/components/ui/app-nav";

type AppSidebarProps = {
  sections: readonly NavSection[];
  homeHref: string;
  settingsHref: string;
};

const ITEM =
  "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-[color,background-color,scale] duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";
const ITEM_IDLE = "text-fg/55 hover:bg-fg/[0.04] hover:text-fg";
const ITEM_ACTIVE = "bg-fg/[0.07] text-fg";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

/** Desktop-only (lg+) navigation rail; phones keep their bottom bar. */
export default function AppSidebar({ sections, homeHref, settingsHref }: AppSidebarProps) {
  const pathname = usePathname();
  const { user } = useSupabase();
  const settingsItem: NavItem = { href: settingsHref, label: "Settings", icon: Settings };
  const activeHref = getActiveHref(pathname, [...sections.flatMap((section) => section.items), settingsItem]);
  // The clicked item lights up at once; the real route (aria-current) catches
  // up when the page arrives. Ignored as soon as the path changes.
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const highlightedHref = pending && pending.from === pathname ? pending.href : activeHref;
  const onNavigate = (href: string) => setPending({ href, from: pathname });
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  // One highlight that glides to the active item (the sidebar stays mounted
  // across navigations). It appears in place, without gliding, on first
  // paint or when coming back from a page that isn't in this list.
  useLayoutEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    const active = navRef.current?.querySelector<HTMLElement>('[data-highlighted="true"]');
    if (!active) {
      pill.style.opacity = "0";
      return;
    }
    const wasHidden = pill.style.opacity !== "1";
    pill.style.transitionDuration = wasHidden ? "0ms" : "";
    pill.style.transform = `translateY(${active.offsetTop}px)`;
    pill.style.opacity = "1";
  }, [highlightedHref]);

  const email = user?.email ?? "";
  const metadataName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const displayName = metadataName || email.split("@")[0] || "Your account";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-sidebar lg:flex print:hidden">
      <Link
        href={homeHref}
        className="mx-3 mt-4 flex h-11 items-center gap-2.5 rounded-lg px-2 focus-visible:outline-2 focus-visible:outline-mint"
      >
        <Image src="/wattwise_mascot.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
        <span className="text-lg font-bold tracking-tight text-fg">
          Watt<span className="text-accent">Wise</span>
        </span>
      </Link>

      <nav ref={navRef} aria-label="Main" className="relative mt-6 flex-1 space-y-6 overflow-y-auto px-3">
        <span
          ref={pillRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 top-0 h-9 rounded-lg bg-fg/[0.07] opacity-0 transition-[transform,opacity] duration-250 ease-in-out"
        />
        {sections.map((section) => (
          <div key={section.label}>
            <p className="mb-1.5 px-3 text-xs font-medium text-fg/35">{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    isActive={item.href === activeHref}
                    isHighlighted={item.href === highlightedHref}
                    usesPill
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 p-3">
        <NavLink
          item={settingsItem}
          isActive={settingsHref === activeHref}
          isHighlighted={settingsHref === highlightedHref}
          onNavigate={onNavigate}
        />
        <ThemeToggle showLabel className={`${ITEM} ${ITEM_IDLE}`} />
        <LogoutButton showLabel label="Log out" className={`${ITEM} ${ITEM_IDLE} disabled:opacity-60`} />

        <div className="mt-2 flex items-center gap-3 rounded-xl border border-fg/[0.06] bg-fg/[0.03] p-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint/15 text-xs font-semibold text-accent"
          >
            {initialsOf(displayName)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-fg">{displayName}</span>
            {email ? (
              <span className="block truncate text-xs text-fg/45" title={email}>
                {email}
              </span>
            ) : null}
          </span>
        </div>
      </div>
    </aside>
  );
}

type NavLinkProps = {
  item: NavItem;
  /** The current route: drives aria-current. */
  isActive: boolean;
  /** Styled as current: the active route, or the item just clicked. */
  isHighlighted: boolean;
  /** The background comes from the gliding pill rather than this link. */
  usesPill?: boolean;
  onNavigate: (href: string) => void;
};

function NavLink({ item: { href, label, icon: Icon }, isActive, isHighlighted, usesPill = false, onNavigate }: NavLinkProps) {
  const highlightClass = usesPill ? "text-fg" : ITEM_ACTIVE;
  return (
    <Link
      href={href}
      onClick={() => onNavigate(href)}
      aria-current={isActive ? "page" : undefined}
      data-highlighted={isHighlighted}
      className={`relative ${ITEM} ${isHighlighted ? highlightClass : ITEM_IDLE}`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${isHighlighted ? "text-accent" : ""}`} aria-hidden="true" />
      {label}
    </Link>
  );
}
