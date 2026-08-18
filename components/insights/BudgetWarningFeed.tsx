import { AlertTriangle, BellRing, CheckCircle2 } from "lucide-react";
import { getBudgetToneClasses } from "@/lib/budget-policy";
import { createClient } from "@/lib/supabase/server";

type BudgetEvent = {
  id: string;
  event_type: string;
  threshold_percent: number | null;
  threshold_php: number | string | null;
  spend_php: number | string;
  message: string;
  created_at: string;
  devices:
    | { device_name: string; user_approved_limit_php: number | string | null }
    | { device_name: string; user_approved_limit_php: number | string | null }[]
    | null;
};

function eventPercent(event: BudgetEvent): number {
  if (event.event_type === "approval_required" || event.event_type === "auto_cutoff") {
    return 100;
  }
  return event.threshold_percent ?? 0;
}

export default async function BudgetWarningFeed() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("device_budget_events")
    .select(
      "id, event_type, threshold_percent, threshold_php, spend_php, message, created_at, devices(device_name, user_approved_limit_php)"
    )
    .order("created_at", { ascending: false })
    .limit(6);
  const events = (data ?? []) as BudgetEvent[];

  return (
    <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
      <div className="mb-3 flex items-center gap-2">
        <BellRing className="h-4 w-4 text-mint" />
        <h2 className="text-sm font-bold uppercase tracking-wider">Budget alerts</h2>
      </div>
      {events.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-base/30 p-3 text-sm text-white/50">
          <CheckCircle2 className="h-4 w-4 text-bida" />
          No budget alerts yet.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const percent = eventPercent(event);
            const tone = getBudgetToneClasses(percent);
            const relation = Array.isArray(event.devices)
              ? event.devices[0] ?? null
              : event.devices;
            const limit = Number(
              relation?.user_approved_limit_php ?? event.threshold_php ?? 0
            );

            return (
              <div
                key={event.id}
                className={`flex gap-3 rounded-lg border p-3 ${tone.border} ${tone.background}`}
              >
                <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${tone.text}`} />
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wide ${tone.text}`}>
                    {relation?.device_name ?? "WattWise device"} · {percent}%
                  </p>
                  <p className="mt-1 text-sm text-white/80">{event.message}</p>
                  <p className="mt-1 text-[11px] text-white/45">
                    ₱{Number(event.spend_php).toFixed(2)} spent
                    {limit > 0 ? ` of ₱${limit.toFixed(2)}` : ""} ·{" "}
                    {new Date(event.created_at).toLocaleString("en-PH")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
