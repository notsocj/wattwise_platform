import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  Gauge,
  PlugZap,
  Power,
  RadioTower,
  Users,
} from "lucide-react";
import type { ManagerFleetSnapshot } from "@/lib/manager-data";

type ManagerFleetDashboardProps = {
  snapshot: ManagerFleetSnapshot;
};

function formatPeso(value: number): string {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusLabel(status: string | null): string {
  if (status === "auto_cutoff") {
    return "Auto cutoff";
  }

  if (status === "approval_required") {
    return "Approval required";
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

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
              Current Cycle
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              {formatPeso(snapshot.totals.spend_php)}
            </h2>
            <p className="mt-1 text-xs text-white/45">
              Across {snapshot.devices.length} paired room
              {snapshot.devices.length === 1 ? "" : "s"}
            </p>
          </div>
          <Link
            href="/manager/ai"
            className="inline-flex items-center gap-2 rounded-xl border border-mint/30 bg-mint/10 px-3 py-2 text-xs font-bold text-mint transition-colors hover:bg-mint/15"
          >
            <Bot className="h-4 w-4" />
            Ask AI
          </Link>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-[11px] text-white/45">
            <span>Fleet hard-limit usage</span>
            <span>
              {snapshot.totals.limit_php > 0
                ? formatPeso(snapshot.totals.limit_php)
                : "No limits yet"}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${
                totalProgress >= 100
                  ? "bg-danger"
                  : totalProgress >= 80
                    ? "bg-naku"
                    : "bg-mint"
              }`}
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
            tone: "text-mint",
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
            tone: "text-white/55",
          },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="rounded-xl border border-white/[0.06] bg-surface p-4"
          >
            <Icon className={`h-4 w-4 ${tone}`} />
            <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
              {label}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">
              Priority Rooms
            </h2>
            <p className="mt-1 text-xs text-white/45">
              Highest hard-limit progress this billing cycle.
            </p>
          </div>
          <Link
            href="/manager/rooms"
            className="text-xs font-bold text-mint transition-colors hover:text-mint/80"
          >
            Manage
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {topRooms.length === 0 ? (
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/50">
              Pair a WattWise room unit to start seeing fleet analytics.
            </p>
          ) : (
            topRooms.map((device) => (
              <div
                key={device.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{device.device_name}</p>
                    <p className="mt-1 truncate text-xs text-white/45">
                      {device.tenant_label}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      device.relay_state
                        ? "bg-mint/10 text-mint"
                        : "bg-danger/10 text-danger"
                    }`}
                  >
                    {device.relay_state ? "ON" : "OFF"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-white/60">
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

                <div className="mt-3 h-2 rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${
                      device.progress_percent >= 100
                        ? "bg-danger"
                        : device.progress_percent >= 80
                          ? "bg-naku"
                          : "bg-mint"
                    }`}
                    style={{ width: `${device.progress_percent}%` }}
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
