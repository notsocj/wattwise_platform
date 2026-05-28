"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Bot,
  Building2,
  CalendarDays,
  DoorOpen,
  Settings,
  Users,
} from "lucide-react";
import LogoutButton from "@/components/ui/LogoutButton";

const tabs = [
  { href: "/manager", label: "Fleet", icon: Building2 },
  { href: "/manager/rooms", label: "Rooms", icon: DoorOpen },
  { href: "/manager/tenants", label: "Tenants", icon: Users },
  { href: "/manager/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/manager/ai", label: "AI", icon: Bot },
  { href: "/manager/settings", label: "Settings", icon: Settings },
] as const;

const titles: Record<string, { eyebrow: string; title: string }> = {
  "/manager": { eyebrow: "Manager Portal", title: "Fleet Dashboard" },
  "/manager/rooms": { eyebrow: "Room Operations", title: "Rooms & Relays" },
  "/manager/tenants": { eyebrow: "Tenant Access", title: "Tenant Center" },
  "/manager/calendar": { eyebrow: "Usage Timeline", title: "Fleet Calendar" },
  "/manager/ai": { eyebrow: "WattWise AI", title: "Manager Assistant" },
  "/manager/settings": { eyebrow: "Manager Account", title: "Settings" },
};

function getHeader(pathname: string) {
  return titles[pathname] ?? titles["/manager"];
}

function isActiveTab(pathname: string, href: string) {
  if (href === "/manager") {
    return pathname === "/manager";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function ManagerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const header = getHeader(pathname);

  return (
    <div className="min-h-screen bg-base pb-28 text-white">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-base/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 pb-4 pt-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/40">
              {header.eyebrow}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Building2 className="h-5 w-5 shrink-0 text-mint" />
              <h1 className="truncate text-lg font-bold tracking-tight">
                {header.title}
              </h1>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 pt-4">{children}</main>

      <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-5xl -translate-x-1/2 border-t border-white/5 bg-base/95 backdrop-blur-sm">
        <div className="grid grid-cols-6 px-2 py-3">
          {tabs.map(({ href, label, icon: Icon }) => {
            const isActive = isActiveTab(pathname, href);

            return (
              <Link
                key={href}
                href={href}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1.5 py-1.5 transition-colors ${
                  isActive ? "text-mint" : "text-white/40 hover:text-white/65"
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {isActive ? (
                    <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-mint" />
                  ) : null}
                </div>
                <span className="max-w-full truncate text-[9px] font-semibold uppercase tracking-wider">
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
