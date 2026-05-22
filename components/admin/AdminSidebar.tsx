"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  Shield,
  DollarSign,
  TrendingUp,
  Brain,
  HeartPulse,
  Globe,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { label: "Overview", path: "/admin", icon: Shield },
  { label: "Meralco Rates", path: "/admin/rates", icon: DollarSign },
  { label: "Revenue & Growth", path: "/admin/growth", icon: TrendingUp },
  { label: "AI Costs", path: "/admin/ai-costs", icon: Brain },
  { label: "System Health", path: "/admin/health", icon: HeartPulse },
  { label: "Global Analytics", path: "/admin/analytics", icon: Globe },
];

interface AdminSidebarProps {
  adminName: string | null;
  adminEmail: string;
}

export default function AdminSidebar({ adminName, adminEmail }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="border-b border-white/10 bg-surface lg:fixed lg:left-0 lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 lg:block lg:px-5 lg:py-6">
        <div>
          <div className="mb-2 flex items-center gap-2 lg:mb-3">
            <span className="text-lg font-bold text-white">
              Watt<span className="text-mint">Wise</span>
            </span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-mint/60">
            Mission Control
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/60 transition-colors hover:border-danger/30 hover:bg-danger/10 hover:text-danger lg:hidden"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-white/10 px-4 py-3 lg:px-5 lg:py-4">
        <p className="truncate text-sm font-semibold text-white">
          {adminName || "Super Admin"}
        </p>
        <p className="truncate text-xs text-white/40">{adminEmail}</p>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-1 lg:flex-col lg:space-y-1 lg:overflow-y-auto lg:px-3 lg:py-4">
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
          const isActive = pathname === path;
          return (
            <Link
              key={path}
              href={path}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:gap-3 ${
                isActive
                  ? "bg-mint/10 text-mint"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="hidden border-t border-white/10 px-3 py-4 lg:block">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
