"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { APP_TABS, getActiveHref } from "@/components/ui/app-nav";

// Fixed-position button, so loading it after the page causes no layout shift.
const CustomerAssistantFab = dynamic(
  () => import("@/components/customer-assistant/CustomerAssistantFab"),
  { ssr: false }
);

export default function BottomNav() {
  const pathname = usePathname();
  const activeHref = getActiveHref(pathname, APP_TABS);

  return (
    <>
    <CustomerAssistantFab />
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 md:max-w-2xl border-t lg:hidden border-fg/5 bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
    >
      <div className="flex items-center justify-around px-4 py-2">
        {APP_TABS.map(({ href, label, icon: Icon }) => {
          const isActive = href === activeHref;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-11 min-w-16 flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? "text-accent" : "text-fg/50 hover:text-fg/60"
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {isActive && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-mint" />
                )}
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
    </>
  );
}
