import { TrendingUp } from "@/components/ui/icons";
import AdminChart from "@/components/admin/AdminChart";
import { AdminPageHeader, AdminSection, StatCard, lastManilaDays, manilaDayKey, shortDayLabel } from "@/components/admin/AdminUi";
import { createAdminClient } from "@/lib/supabase/admin";

type Created = { created_at: string | null };
type ProfileRow = Created & { role: string | null };

const ROLE_LABELS: Record<string, string> = {
  user: "Home users",
  manager: "Property managers",
  tenant: "Tenants",
  super_admin: "Admins",
};

function countSince(rows: Created[], days: number, now: number) {
  const since = now - days * 86_400_000;
  return rows.filter((row) => row.created_at && new Date(row.created_at).getTime() >= since).length;
}

export default async function AdminGrowthPage() {
  const admin = createAdminClient();
  const now = new Date().getTime();
  const [profiles, devices] = await Promise.all([
    admin.from("profiles").select("created_at,role").returns<ProfileRow[]>(),
    admin.from("devices").select("created_at").returns<Created[]>(),
  ]);
  const users = profiles.data ?? [];
  const units = devices.data ?? [];

  const usersByDay = new Map<string, number>();
  for (const row of users) if (row.created_at) usersByDay.set(manilaDayKey(row.created_at), (usersByDay.get(manilaDayKey(row.created_at)) ?? 0) + 1);
  const unitsByDay = new Map<string, number>();
  for (const row of units) if (row.created_at) unitsByDay.set(manilaDayKey(row.created_at), (unitsByDay.get(manilaDayKey(row.created_at)) ?? 0) + 1);
  const chart = lastManilaDays(30).map((day) => ({
    label: shortDayLabel(day),
    value: usersByDay.get(day) ?? 0,
    secondary: unitsByDay.get(day) ?? 0,
  }));

  const roles = new Map<string, number>();
  for (const row of users) roles.set(row.role ?? "user", (roles.get(row.role ?? "user") ?? 0) + 1);

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={TrendingUp} title="Growth" description="New accounts and units over time." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={users.length.toLocaleString()} />
        <StatCard label="New users · 7 days" value={countSince(users, 7, now)} hint={`${countSince(users, 30, now)} in 30 days · ${countSince(users, 90, now)} in 90`} tone="good" />
        <StatCard label="Total units" value={units.length.toLocaleString()} />
        <StatCard label="New units · 7 days" value={countSince(units, 7, now)} hint={`${countSince(units, 30, now)} in 30 days · ${countSince(units, 90, now)} in 90`} tone="good" />
      </div>

      <AdminSection title="Sign-ups and new units" description="Per day, last 30 days (Manila time).">
        <AdminChart data={chart} kind="bar" valueLabel="New users" secondaryLabel="New units" />
        <div className="mt-3 flex gap-4 text-xs text-fg/55">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-mint" aria-hidden="true" />New users</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-fg/25" aria-hidden="true" />New units</span>
        </div>
      </AdminSection>

      <AdminSection title="Accounts by role">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(ROLE_LABELS).map(([role, label]) => (
            <div key={role} className="rounded-2xl bg-fg/[0.03] px-4 py-3">
              <p className="text-xs text-fg/50">{label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{roles.get(role) ?? 0}</p>
            </div>
          ))}
        </div>
      </AdminSection>
    </div>
  );
}
