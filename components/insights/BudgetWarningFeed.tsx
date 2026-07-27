import { AlertTriangle, BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type BudgetEvent = {
  id: string;
  event_type: string;
  threshold_php: number | string | null;
  spend_php: number | string;
  message: string;
  created_at: string;
};

export default async function BudgetWarningFeed() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("device_budget_events")
    .select("id, event_type, threshold_php, spend_php, message, created_at")
    .order("created_at", { ascending: false })
    .limit(6);
  const events = (data ?? []) as BudgetEvent[];
  if (!events.length) return null;

  return <section className="rounded-xl border border-naku/25 bg-naku/10 p-5"><div className="mb-3 flex items-center gap-2"><BellRing className="h-4 w-4 text-naku" /><h2 className="text-sm font-bold uppercase tracking-wider text-naku">Budget warnings</h2></div><div className="space-y-2">{events.map((event) => <div key={event.id} className="flex gap-3 rounded-lg border border-white/[0.08] bg-base/30 p-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-naku" /><div><p className="text-sm text-white/80">{event.message}</p><p className="mt-1 text-[11px] text-white/45">Spend: ₱{Number(event.spend_php).toFixed(2)} · {new Date(event.created_at).toLocaleString("en-PH")}</p></div></div>)}</div></section>;
}
