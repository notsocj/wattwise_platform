"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import LogoutButton from "@/components/ui/LogoutButton";
import AppSidebar from "@/components/ui/AppSidebar";
import { DESKTOP_PANEL } from "@/components/ui/AppFrame";
import { getActiveHref, MANAGER_DESKTOP_SECTIONS, MANAGER_TABS } from "@/components/ui/app-nav";

// `description` is the desktop page intro (desktop has no top bar).
const titles: Record<string, { eyebrow: string; title: string; description: string }> = {
  "/manager": { eyebrow: "Manager Portal", title: "Fleet Dashboard", description: "Live status of every room and unit in your property." },
  "/manager/rooms": { eyebrow: "Room Operations", title: "Rooms & Relays", description: "Assign units to rooms and switch power remotely." },
  "/manager/tenants": { eyebrow: "Tenant Access", title: "Tenant Center", description: "Invite tenants and manage their access." },
  "/manager/calendar": { eyebrow: "Usage Timeline", title: "Fleet Calendar", description: "Daily usage and cost across your property." },
  "/manager/ai": { eyebrow: "WattWise AI", title: "Manager Assistant", description: "Ask WattWise about usage, costs and tenants." },
  "/manager/settings": { eyebrow: "Manager Account", title: "Settings", description: "Your manager account, billing cycle and notifications." },
};

function getHeader(pathname: string) {
  return titles[pathname] ?? titles["/manager"];
}

export default function ManagerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const header = getHeader(pathname);
  const activeHref = getActiveHref(pathname, MANAGER_TABS);

  return (
    <div className="min-h-screen bg-canvas pb-28 text-fg lg:min-h-dvh lg:bg-sidebar lg:py-2 lg:pl-64 lg:pr-2">
      <AppSidebar sections={MANAGER_DESKTOP_SECTIONS} homeHref="/manager" settingsHref="/manager/settings" />
      <div className={DESKTOP_PANEL}>
        <header className="sticky top-0 z-40 border-b border-fg/5 bg-canvas/95 backdrop-blur-sm lg:static lg:border-0 lg:bg-transparent lg:backdrop-blur-none">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 pb-4 pt-5 lg:ww-enter lg:max-w-6xl lg:px-11 lg:pb-8 lg:pt-10">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-fg/40 lg:hidden">
                {header.eyebrow}
              </p>
              <div className="mt-1 flex items-center gap-2 lg:mt-0">
                <Building2 className="h-5 w-5 shrink-0 text-accent lg:hidden" />
                <h1 className="truncate text-lg font-bold tracking-tight lg:text-[32px] lg:leading-tight lg:font-semibold lg:tracking-tighter">
                  {header.title}
                </h1>
              </div>
              <p className="mt-1.5 hidden text-sm text-fg/50 lg:block">{header.description}</p>
            </div>
            {/* On desktop the sidebar has the logout button. */}
            <div className="lg:hidden">
              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="ww-stagger mx-auto w-full max-w-5xl px-5 pt-4 lg:max-w-6xl lg:px-11 lg:pb-12 lg:pt-0">{children}</main>
      </div>

      <nav
        aria-label="Manager"
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-5xl -translate-x-1/2 border-t lg:hidden border-fg/5 bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
      >
        <div className="grid grid-cols-6 px-2 py-2">
          {MANAGER_TABS.map(({ href, label, icon: Icon }) => {
            const isActive = href === activeHref;

            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 transition-colors ${
                  isActive ? "text-accent" : "text-fg/50 hover:text-fg/60"
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {isActive ? (
                    <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-mint" />
                  ) : null}
                </div>
                <span className="max-w-full truncate text-[10px] font-semibold uppercase tracking-wide">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
