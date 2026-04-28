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
import type { AdminSidebarProps } from "@/components/admin/AdminSidebar.types";

const NAV_ITEMS = [
  { label: "Overview", path: "/admin", icon: Shield },
  { label: "Meralco Rates", path: "/admin/rates", icon: DollarSign },
  { label: "Revenue & Growth", path: "/admin/growth", icon: TrendingUp },
  { label: "AI Costs", path: "/admin/ai-costs", icon: Brain },
  { label: "System Health", path: "/admin/health", icon: HeartPulse },
  { label: "Global Analytics", path: "/admin/analytics", icon: Globe },
];

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
    <aside className="fixed top-0 left-0 h-screen w-64 bg-surface border-r border-white/10 flex flex-col">
      {/* Brand Header */}
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg font-bold text-white">
            Watt<span className="text-mint">Wise</span>
          </span>
        </div>
        <p className="text-xs font-semibold tracking-widest text-mint/60 uppercase">
          Mission Control
        </p>
      </div>

      {/* Admin Profile */}
      <div className="px-5 py-4 border-b border-white/10">
        <p className="text-sm font-semibold text-white truncate">
          {adminName || "Super Admin"}
        </p>
        <p className="text-xs text-white/40 truncate">{adminEmail}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
          const isActive = pathname === path;
          return (
            <Link
              key={path}
              href={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-mint/10 text-mint"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Sign Out */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-danger hover:bg-danger/10 transition-colors w-full"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
