import { HeartPulse } from "@/components/ui/icons";
import { AdminPageHeader, AdminSection, StatCard } from "@/components/admin/AdminUi";
import { isFreshReading } from "@/lib/device-telemetry";
import { createAdminClient } from "@/lib/supabase/admin";

/** Supabase free-tier database size; change this if the project moves to a paid plan. */
const DATABASE_LIMIT_BYTES = 500 * 1024 * 1024;
const STALE_AFTER_MS = 15 * 60_000;

type DeviceRow = {
  id: string;
  device_name: string | null;
  mac_address: string | null;
  last_seen_at: string | null;
};

type StorageRow = { database_bytes: number; energy_logs_bytes: number; energy_logs_rows: number };

function megabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function relativeTime(iso: string | null, now: number) {
  if (!iso) return "Never";
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export default async function AdminHealthPage() {
  const admin = createAdminClient();
  const now = new Date().getTime();
  const [storage, devices, logs24h, syncRuns, demos, logsTotal] = await Promise.all([
    admin.rpc("admin_storage_stats"),
    admin.from("devices").select("id,device_name,mac_address,last_seen_at").order("last_seen_at", { ascending: false, nullsFirst: false }).returns<DeviceRow[]>(),
    admin.from("energy_logs").select("*", { count: "exact", head: true }).gte("recorded_at", new Date(now - 86_400_000).toISOString()),
    admin.from("meralco_rate_sync_runs").select("status,message,effective_month,ran_at").order("ran_at", { ascending: false }).limit(1),
    admin.from("demo_device_simulations").select("device_id"),
    // Exact count; the planner estimate in admin_storage_stats lags behind.
    admin.from("energy_logs").select("*", { count: "exact", head: true }),
  ]);
  const demoIds = new Set((demos.data ?? []).map((row) => String(row.device_id)));

  const stats = ((storage.data as StorageRow[] | null) ?? [])[0] ?? null;
  const used = stats ? Number(stats.database_bytes) : 0;
  const percent = stats ? Math.min(100, (used / DATABASE_LIMIT_BYTES) * 100) : 0;
  const storageTone = percent >= 90 ? "bg-danger" : percent >= 80 ? "bg-naku" : "bg-mint";

  const fleet = devices.data ?? [];
  const status = (device: DeviceRow) =>
    isFreshReading(device.last_seen_at, now)
      ? "online"
      : device.last_seen_at && now - new Date(device.last_seen_at).getTime() < STALE_AFTER_MS
        ? "idle"
        : device.last_seen_at
          ? "stale"
          : "never";
  const counts = { online: 0, idle: 0, stale: 0, never: 0 };
  for (const device of fleet) counts[status(device)] += 1;
  const sync = syncRuns.data?.[0] ?? null;

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={HeartPulse} title="System Health" description="Database size, telemetry flow, unit status, and rate sync." />

      <AdminSection title="Database storage" description="Against the Supabase free-tier limit of 500 MB. Warns at 80%.">
        {stats ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p className="text-3xl font-semibold tabular-nums">
                {megabytes(used)} <span className="text-base font-normal text-fg/45">of 500 MB</span>
              </p>
              <p className={`text-sm font-semibold ${percent >= 80 ? "text-naku" : "text-fg/55"}`}>{percent.toFixed(1)}% used</p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-fg/[0.06]" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label="Database storage used">
              <div className={`h-full rounded-full ${storageTone}`} style={{ width: `${Math.max(percent, 1)}%` }} />
            </div>
            <p className="mt-3 text-xs text-fg/50">
              Telemetry (<code>energy_logs</code>): {megabytes(Number(stats.energy_logs_bytes))} across{" "}
              {(logsTotal.count ?? Number(stats.energy_logs_rows)).toLocaleString()} readings.
            </p>
          </>
        ) : (
          <p className="text-sm text-danger">Storage stats are unavailable ({storage.error?.message ?? "no data"}).</p>
        )}
      </AdminSection>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Online" value={counts.online} hint="Reported in the last 20 s" tone="good" />
        <StatCard label="Idle" value={counts.idle} hint="Last seen under 15 min ago" />
        <StatCard label="Stale" value={counts.stale} hint="Silent for 15 min or more" tone={counts.stale > 0 ? "warning" : "default"} />
        <StatCard label="Readings, last 24 h" value={(logs24h.count ?? 0).toLocaleString()} hint={counts.never ? `${counts.never} unit(s) never reported` : undefined} />
      </div>

      <AdminSection
        title="Latest Meralco rate sync"
        description="The sync-meralco-rates function checks Meralco's archive each month."
      >
        {sync ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                sync.status === "success" ? "bg-mint/10 text-accent" : sync.status === "failed" ? "bg-danger/10 text-danger" : "bg-fg/[0.06] text-fg/60"
              }`}
            >
              {sync.status}
            </span>
            <span className="text-fg/70">{sync.message}</span>
            <span className="text-fg/45">
              {sync.effective_month ? `${String(sync.effective_month).slice(0, 7)} · ` : ""}
              {relativeTime(sync.ran_at, now)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-fg/50">No sync runs recorded yet.</p>
        )}
      </AdminSection>

      <AdminSection title="Units" description="Every registered unit, most recently heard from first.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.1em] text-fg/45">
              <tr>
                {["Unit", "MAC", "Status", "Last seen"].map((heading) => (
                  <th key={heading} className="pb-2 pr-4 font-semibold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fleet.map((device) => {
                const state = status(device);
                return (
                  <tr key={device.id} className="border-t border-fg/[0.05]">
                    <td className="py-2.5 pr-4 font-medium">
                      {device.device_name ?? "Unnamed"}
                      {demoIds.has(device.id) ? <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-fg/40">Demo</span> : null}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-fg/55">{device.mac_address ?? "—"}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          state === "online" ? "bg-mint/10 text-accent" : state === "stale" ? "bg-naku/10 text-naku" : "bg-fg/[0.06] text-fg/55"
                        }`}
                      >
                        {state}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-fg/60">{relativeTime(device.last_seen_at, now)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AdminSection>
    </div>
  );
}
