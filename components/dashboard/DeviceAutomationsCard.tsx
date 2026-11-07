import { Timer } from "@/components/ui/icons";
import { CARD, CardHeader, CardPill } from "@/components/ui/Card";
import CancelAutomationButton from "@/components/dashboard/CancelAutomationButton";
import {
  describeAutomation,
  formatKwh,
  formatManilaMoment,
  formatPeso,
  type AutomationTrigger,
} from "@/lib/device-automations";

export type DeviceAutomationRow = {
  id: string;
  trigger_type: AutomationTrigger;
  run_at: string | null;
  threshold: number | string | null;
  ends_at: string;
  status: "active" | "done" | "cancelled" | "expired";
  consumed_kwh: number | string;
  consumed_php: number | string;
  executed_at: string | null;
  ended_at: string | null;
};

function endedLabel(row: DeviceAutomationRow, threshold: number | null): string {
  if (row.status === "done") return `Turned off at ${formatManilaMoment(row.executed_at ?? row.ended_at ?? row.ends_at)}`;
  if (row.status === "cancelled") return "Cancelled";
  if (row.trigger_type === "time") return "Missed its window";
  const amount = row.trigger_type === "spend" ? formatPeso(threshold ?? 0) : formatKwh(threshold ?? 0);
  return `Ended without reaching ${amount}`;
}

/** Scheduled turn-offs for one device: active rules with progress, then the last day's finished ones. */
export default function DeviceAutomationsCard({ deviceId, rows }: { deviceId: string; rows: DeviceAutomationRow[] }) {
  const active = rows.filter((row) => row.status === "active");
  const finished = rows.filter((row) => row.status !== "active");

  return (
    <section className={`${CARD} p-5 lg:p-6`}>
      <div className="mb-4">
        <CardHeader
          icon={Timer}
          title="Scheduled turn-offs"
          aside={active.length ? <CardPill>{active.length} active</CardPill> : null}
        />
      </div>

      {active.length === 0 ? (
        <p className="text-sm leading-relaxed text-fg/50">
          Nothing scheduled. Ask the WattWise assistant, for example &ldquo;Turn off this at 1 AM&rdquo; or &ldquo;Turn it off after ₱50 more tonight.&rdquo;
        </p>
      ) : (
        <ul className="space-y-3">
          {active.map((row) => {
            const threshold = row.threshold == null ? null : Number(row.threshold);
            const used = row.trigger_type === "spend" ? Number(row.consumed_php) : Number(row.consumed_kwh);
            const percent = threshold ? Math.min(100, (used / threshold) * 100) : 0;
            return (
              <li key={row.id} className="rounded-xl border border-fg/[0.06] bg-fg/[0.02] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-fg">
                    {describeAutomation({ trigger: row.trigger_type, run_at: row.run_at, threshold, ends_at: row.ends_at })}
                  </p>
                  <CancelAutomationButton deviceId={deviceId} automationId={row.id} />
                </div>
                {row.trigger_type !== "time" && threshold ? (
                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-fg/[0.06]">
                      <div
                        className="h-full origin-left rounded-full bg-mint transition-[width,scale] duration-700 ease-out starting:scale-x-0"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-fg/50">
                      {row.trigger_type === "spend" ? formatPeso(used) : formatKwh(used)} of{" "}
                      {row.trigger_type === "spend" ? formatPeso(threshold) : formatKwh(threshold)} since it was scheduled
                    </p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {finished.length ? (
        <ul className="mt-4 space-y-1.5 border-t border-fg/[0.06] pt-3">
          {finished.map((row) => {
            const threshold = row.threshold == null ? null : Number(row.threshold);
            return (
              <li key={row.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-fg/50">
                  {describeAutomation({ trigger: row.trigger_type, run_at: row.run_at, threshold, ends_at: row.ends_at })}
                </span>
                <span className={`shrink-0 font-medium ${row.status === "done" ? "text-accent" : "text-fg/40"}`}>
                  {endedLabel(row, threshold)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
