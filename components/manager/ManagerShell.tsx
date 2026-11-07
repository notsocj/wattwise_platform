"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AppSidebar from "@/components/ui/AppSidebar";
import { DESKTOP_PANEL } from "@/components/ui/AppFrame";
import { getActiveHref, MANAGER_DESKTOP_SECTIONS, MANAGER_TABS } from "@/components/ui/app-nav";

// Fixed-position button, so loading it after the page causes no layout shift.
const ManagerAssistantFab = dynamic(() => import("@/components/manager/ManagerAssistantFab"), { ssr: false });

// `description` is the desktop page intro (desktop has no top bar).
const titles: Record<string, { eyebrow: string; title: string; description: string }> = {
  "/manager": { eyebrow: "Manager Portal", title: "Fleet", description: "Live status of every room and unit in your property." },
  "/manager/rooms": { eyebrow: "Room Operations", title: "Rooms & Relays", description: "Assign units to rooms, set hard limits, and switch power remotely." },
  "/manager/tenants": { eyebrow: "Tenant Access", title: "Tenants", description: "Create tenant logins and move tenants between rooms." },
  "/manager/calendar": { eyebrow: "Usage Timeline", title: "Fleet Calendar", description: "Daily usage and cost across your property." },
  "/manager/settings": { eyebrow: "Manager Account", title: "Settings", description: "Your manager account, billing cycle and notifications." },
};

export default function ManagerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeHref = getActiveHref(pathname, MANAGER_TABS);
  const header = titles[activeHref ?? "/manager"] ?? titles["/manager"];
  const HeaderIcon = MANAGER_TABS.find(({ href }) => href === activeHref)?.icon ?? MANAGER_TABS[0].icon;

  return (
    <div className="min-h-screen bg-canvas pb-28 text-fg lg:min-h-dvh lg:bg-sidebar lg:py-2 lg:pb-2 lg:pl-56 lg:pr-2 xl:pl-64">
      <AppSidebar sections={MANAGER_DESKTOP_SECTIONS} homeHref="/manager" settingsHref="/manager/settings" />
      <div className={DESKTOP_PANEL}>
        <header className="sticky top-0 z-40 border-b border-fg/5 bg-canvas/95 backdrop-blur-sm lg:static lg:border-0 lg:bg-transparent lg:backdrop-blur-none">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 py-4 lg:ww-enter lg:max-w-6xl lg:px-11 lg:pb-8 lg:pt-10">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint/10 text-accent lg:hidden">
              <HeaderIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-fg/40 lg:hidden">{header.eyebrow}</p>
              <h1 className="truncate text-lg font-bold tracking-tight lg:text-[32px] lg:font-semibold lg:leading-tight lg:tracking-tighter">
                {header.title}
              </h1>
              <p className="mt-1.5 hidden text-sm text-fg/50 lg:block">{header.description}</p>
            </div>
          </div>
        </header>

        <main className="ww-stagger mx-auto w-full max-w-5xl px-5 pt-4 lg:max-w-6xl lg:px-11 lg:pb-12 lg:pt-0">{children}</main>
      </div>

      <ManagerAssistantFab />

      <nav
        aria-label="Manager"
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-5xl -translate-x-1/2 border-t border-fg/5 bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
      >
        <div className="grid grid-cols-5 px-2 py-2">
          {MANAGER_TABS.map(({ href, label, icon: Icon }) => {
            const isActive = href === activeHref;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-1.5 transition-[color,scale] duration-150 ease-out active:scale-[0.94] ${
                  isActive ? "text-accent" : "text-fg/50 hover:text-fg/70"
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span
                    aria-hidden="true"
                    className={`absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-mint transition-[opacity,scale] duration-200 ease-out ${
                      isActive ? "scale-100 opacity-100" : "scale-50 opacity-0"
                    }`}
                  />
                </div>
                <span className="max-w-full truncate text-[10px] font-semibold uppercase tracking-wide">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
