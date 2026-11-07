import Link from "next/link";
import { ChevronRight, Shield } from "@/components/ui/icons";
import AuditList, { loadAuditEntries } from "@/components/admin/AuditList";
import { AdminPageHeader, AdminSection, StatCard } from "@/components/admin/AdminUi";
import { getFreshReadingCutoffIso } from "@/lib/device-telemetry";
import { createAdminClient } from "@/lib/supabase/admin";

const QUICK_LINKS = [
  { href: "/admin/rates", label: "Meralco rates", hint: "Add or correct a month" },
  { href: "/admin/health", label: "System health", hint: "Storage and unit status" },
  { href: "/admin/demo-units", label: "Demo units", hint: "Start a simulated meter" },
  { href: "/admin/ai-costs", label: "AI costs", hint: "Tokens and estimated spend" },
] as const;

export default async function AdminPage() {
  const admin = createAdminClient();
  const [users, devices, online, disabled, warnings, cutoffs, recent] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("devices").select("*", { count: "exact", head: true }),
    // devices.is_online is never reset, so "online" means reported within the live window.
    admin.from("devices").select("*", { count: "exact", head: true }).gte("last_seen_at", getFreshReadingCutoffIso()),
    admin.from("profiles").select("*", { count: "exact", head: true }).not("disabled_at", "is", null),
    admin.from("device_budget_events").select("*", { count: "exact", head: true }).in("event_type", ["budget_warning", "approval_required"]),
    admin.from("device_budget_events").select("*", { count: "exact", head: true }).eq("event_type", "auto_cutoff"),
    loadAuditEntries(admin, 8),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Shield} title="Overview" description="Platform summary, recent admin actions, and shortcuts." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Users" value={users.count ?? 0} hint={disabled.count ? `${disabled.count} disabled` : undefined} />
        <StatCard label="Units" value={devices.count ?? 0} hint={`${online.count ?? 0} online now`} tone="good" />
        <StatCard
          label="Budget events"
          value={(warnings.count ?? 0) + (cutoffs.count ?? 0)}
          hint={`${warnings.count ?? 0} warnings · ${cutoffs.count ?? 0} automatic cutoffs`}
          tone={cutoffs.count ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <AdminSection
          title="Recent admin actions"
          actions={
            <Link href="/admin/audit" className="text-xs font-semibold text-accent hover:underline">
              View all
            </Link>
          }
        >
          <AuditList entries={recent} />
        </AdminSection>

        <AdminSection title="Shortcuts">
          <ul className="space-y-2">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-fg/[0.03] px-4 py-3 transition-[background-color,scale] duration-150 ease-out hover:bg-fg/[0.06] active:scale-[0.99]"
                >
                  <span>
                    <span className="block text-sm font-semibold">{link.label}</span>
                    <span className="block text-xs text-fg/50">{link.hint}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-fg/35" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </AdminSection>
      </div>
    </div>
  );
}
