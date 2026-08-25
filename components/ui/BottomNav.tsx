"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FileText, Home, LineChart, Settings } from "lucide-react";
import CustomerAssistantFab from "@/components/customer-assistant/CustomerAssistantFab";

const tabs = [
  { href: "/dashboard", label: "HOME", icon: Home },
  { href: "/analytics", label: "BURN", icon: LineChart },
  { href: "/reports", label: "REPORTS", icon: FileText },
  { href: "/settings", label: "SETTINGS", icon: Settings },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const warmRoutes = () => {
      for (const tab of tabs) {
        if (tab.href !== pathname) router.prefetch(tab.href);
      }
    };
    const timer = window.setTimeout(warmRoutes, 250);
    return () => window.clearTimeout(timer);
  }, [pathname, router]);

  return (
    <>
    <CustomerAssistantFab />
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 border-t border-white/5 bg-base/95 backdrop-blur-sm">
      <div className="flex items-center justify-around px-4 py-3">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              prefetch
              className={`flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-mint" : "text-white/40 hover:text-white/60"
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
