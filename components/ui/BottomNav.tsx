"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart3 } from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "HOME", icon: Home },
  { href: "/insights", label: "INSIGHTS", icon: BarChart3 },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-base/95 backdrop-blur-sm border-t border-white/5">
      <div className="flex items-center justify-around max-w-md mx-auto py-3 px-4">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-mint" : "text-white/40 hover:text-white/60"
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {isActive && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-mint shadow-mint-glow" />
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
  );
}
