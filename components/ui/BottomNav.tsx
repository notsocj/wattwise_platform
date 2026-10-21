"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Home, LineChart, Settings } from "lucide-react";
import dynamic from "next/dynamic";

// Fixed-position button, so loading it after the page causes no layout shift.
const CustomerAssistantFab = dynamic(
  () => import("@/components/customer-assistant/CustomerAssistantFab"),
  { ssr: false }
);

const tabs = [
  { href: "/dashboard", label: "HOME", icon: Home },
  { href: "/analytics", label: "BURN", icon: LineChart },
  { href: "/reports", label: "REPORTS", icon: FileText },
  { href: "/settings", label: "SETTINGS", icon: Settings },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <>
    <CustomerAssistantFab />
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 border-t border-white/5 bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
    >
      <div className="flex items-center justify-around px-4 py-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-11 min-w-16 flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? "text-mint" : "text-white/50 hover:text-white/60"
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {isActive && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-mint" />
                )}
              </div>
              <span className="text-[10px] font-semibold tracking-wider">
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
