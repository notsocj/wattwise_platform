import Link from "next/link";
import ManagerPriorityCards from "@/components/manager/ManagerPriorityCards";
import { formatPeso } from "@/lib/format";
import {
  AlertTriangle,
  Gauge,
  PlugZap,
  Power,
  RadioTower,
  Users,
} from "@/components/ui/icons";
import type { ManagerFleetSnapshot } from "@/lib/manager-data";
import { getBudgetToneClasses } from "@/lib/budget-policy";

type ManagerFleetDashboardProps = {
  snapshot: ManagerFleetSnapshot;
};

function statusLabel(status: string | null): string {
  if (status === "auto_cutoff") {
    return "Auto cutoff";
  }

  if (status === "approval_required") {
    return "100% reached · power on";
  }

  return "Normal";
}

export default function ManagerFleetDashboard({
  snapshot,
}: ManagerFleetDashboardProps) {
  const topRooms = [...snapshot.devices]
    .sort((first, second) => second.progress_percent - first.progress_percent)
    .slice(0, 4);
  const totalProgress =
    snapshot.totals.limit_php > 0
      ? Math.min((snapshot.totals.spend_php / snapshot.totals.limit_php) * 100, 100)
      : 0;
  const totalTone = getBudgetToneClasses(totalProgress);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-fg/[0.06] bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-fg/45">
              Current Cycle
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              {formatPeso(snapshot.totals.spend_php)}
            </h2>
            <p className="mt-1 text-xs text-fg/45">
              Across {snapshot.devices.length} paired room
              {snapshot.devices.length === 1 ? "" : "s"}
            </p>
          </div>
          <span className="rounded-full bg-fg/[0.05] px-3 py-1.5 text-[11px] font-semibold text-fg/55">
            Day {snapshot.billingCycle.elapsedDays} of {snapshot.billingCycle.totalDays}
          </span>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-[11px] text-fg/45">
            <span>Fleet hard-limit usage</span>
            <span>
              {snapshot.totals.limit_php > 0
                ? formatPeso(snapshot.totals.limit_php)
                : "No limits yet"}
            </span>
          </div>
          <div className="h-2 rounded-full bg-fg/[0.06]">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-out ${totalTone.bar}`}
              style={{ width: `${totalProgress}%` }}
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            label: "Assigned",
            value: snapshot.totals.assigned_rooms,
            icon: Users,
            tone: "text-accent",
          },
          {
            label: "Relays On",
            value: snapshot.totals.active_relays,
            icon: Power,
            tone: "text-bida",
          },
          {
            label: "Near Limit",
            value: snapshot.totals.rooms_at_risk,
            icon: AlertTriangle,
            tone: "text-naku",
          },
          {
            label: "Stale",
            value: snapshot.totals.offline_rooms,
            icon: RadioTower,
            tone: "text-fg/55",
          },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="rounded-2xl border border-fg/[0.06] bg-surface p-4"
          >
            <Icon className={`h-4 w-4 ${tone}`} />
            <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg/45">
              {label}
            </p>
          </div>
        ))}
      </section>

      <ManagerPriorityCards />

      <section className="rounded-2xl border border-fg/[0.06] bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Priority Rooms
            </h2>
            <p className="mt-1 text-xs text-fg/45">
              Highest hard-limit progress this billing cycle.
            </p>
          </div>
          <Link
            href="/manager/rooms"
            className="rounded-full border border-mint/30 px-3 py-1.5 text-xs font-bold text-accent transition-[background-color,scale] duration-150 ease-out hover:bg-mint/10 active:scale-[0.97]"
          >
            Manage
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {topRooms.length === 0 ? (
            <p className="rounded-2xl border border-fg/[0.06] bg-fg/[0.03] p-4 text-sm text-fg/50">
              Pair a WattWise room unit to start seeing fleet analytics.
            </p>
          ) : (
            topRooms.map((device) => (
              <div
                key={device.id}
                className="rounded-2xl border border-fg/[0.06] bg-fg/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{device.device_name}</p>
                    <p className="mt-1 truncate text-xs text-fg/45">
                      {device.tenant_label}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      device.relay_state
                        ? "bg-mint/10 text-accent"
                        : "bg-fg/[0.06] text-fg/60"
                    }`}
                  >
                    {device.relay_state ? "ON" : "OFF"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-fg/60">
                  <span className="inline-flex items-center gap-1">
                    <PlugZap className="h-3 w-3" />
                    {Math.round(device.watts)}W
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Gauge className="h-3 w-3" />
                    {formatPeso(device.spend_php)}
                  </span>
                  <span>{statusLabel(device.budget_status)}</span>
                </div>

                <div className="mt-3 h-2 rounded-full bg-fg/[0.06]">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ease-out ${getBudgetToneClasses(device.progress_percent).bar}`}
                    style={{ width: `${Math.min(device.progress_percent, 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
