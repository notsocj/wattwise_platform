import Link from "next/link";
import { ArrowLeft, CalendarClock, ExternalLink, History } from "lucide-react";
import BottomNav from "@/components/ui/BottomNav";
import LogoutButton from "@/components/ui/LogoutButton";
import { createClient } from "@/lib/supabase/server";
import { getMeralcoRateHistory, type HistoricalMeralcoRateRow } from "@/lib/meralco-rates";
import { redirect } from "next/navigation";

function formatMonth(value: string): string {
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" }).format(
    new Date(`${value}T00:00:00+08:00`)
  );
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function ratePerKwh(rate: HistoricalMeralcoRateRow): number {
  return Object.values(rate.rates).reduce((sum, value) => sum + value, 0) * (1 + rate.vatRate);
}

function RateComponents({ rate }: { rate: HistoricalMeralcoRateRow }) {
  const rows = [
    ["Generation", rate.rates.generation],
    ["Transmission", rate.rates.transmission],
    ["System loss", rate.rates.systemLoss],
    ["Distribution", rate.rates.distribution],
    ["Universal charges", rate.rates.universalCharges],
    ["FIT-All", rate.rates.fitAll],
  ] as const;
  const sourceUrl = rate.provenance.sourcePdfUrl ?? rate.provenance.sourceUrl;
  const fixedTotal = rate.fixedCharges.meteringCharge + rate.fixedCharges.supplyCharge;

  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      {rows.map(([label, value]) => <div key={label} className="flex justify-between gap-2 text-white/60"><span>{label}</span><span className="font-semibold text-white">₱{value.toFixed(4)}</span></div>)}
    </div>
    <div className="border-t border-white/[0.08] pt-3 text-sm text-white/60">
      <div className="flex justify-between"><span>Metering + supply fixed charges</span><span className="font-semibold text-white">₱{fixedTotal.toFixed(2)}</span></div>
      <div className="mt-2 flex justify-between"><span>VAT</span><span className="font-semibold text-white">{(rate.vatRate * 100).toFixed(2)}%</span></div>
    </div>
    <div className="rounded-lg bg-white/[0.03] p-3 text-xs leading-relaxed text-white/55">
      <p>Effective from <span className="font-semibold text-white/80">{formatMonth(rate.effectiveMonth)}</span></p>
      <p className="mt-1">{rate.provenance.autoUpdated && rate.provenance.fetchedAt ? `Last synced ${formatTimestamp(rate.provenance.fetchedAt)}` : `Recorded in WattWise ${formatTimestamp(rate.provenance.createdAt)}`}</p>
      {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-semibold text-mint hover:text-mint/80">Open Meralco {rate.provenance.sourcePdfUrl ? "monthly bill summary" : "rate archives"}<ExternalLink className="h-3 w-3" /></a> : <p className="mt-1">No official source link was recorded for this legacy/manual rate row.</p>}
    </div>
  </div>;
}

export default async function RatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const history = await getMeralcoRateHistory(supabase);
  const current = history[0];

  return <div className="min-h-screen bg-base pb-24 text-white">
    <header className="fixed top-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-b border-white/5 bg-base/95 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-white/70 transition-colors hover:text-mint" aria-label="Back to dashboard"><ArrowLeft className="h-4 w-4" /></Link>
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/40">Rate transparency</p><h1 className="mt-1 text-lg font-bold tracking-tight">Meralco Rates</h1></div>
        </div>
        <LogoutButton />
      </div>
    </header>

    <main className="space-y-5 px-5 pt-[92px]">
      {current ? <section className="rounded-xl border border-mint/25 bg-surface p-5 shadow-[0_12px_35px_rgba(0,0,0,0.16)]">
        <div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-mint">Current applicable rate</p><h2 className="mt-1 text-2xl font-bold">{formatMonth(current.effectiveMonth)}</h2></div><div className="rounded-lg bg-mint/10 px-3 py-2 text-right"><p className="text-[10px] uppercase tracking-wider text-white/45">With VAT</p><p className="mt-1 text-sm font-bold text-mint">₱{ratePerKwh(current).toFixed(4)}/kWh</p></div></div>
        <RateComponents rate={current} />
      </section> : <section className="rounded-xl border border-naku/30 bg-naku/10 p-5 text-sm text-white/70">No Meralco rate has been configured yet.</section>}

      <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
        <div className="mb-4 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05]"><History className="h-4 w-4 text-mint" /></div><div><h2 className="text-sm font-bold uppercase tracking-wider">Rate history</h2><p className="mt-1 text-xs text-white/45">Past monthly rate rows used for billing calculations.</p></div></div>
        <div className="space-y-3">{history.map((rate, index) => <details key={rate.effectiveMonth} open={index === 0} className="rounded-lg border border-white/[0.08] bg-white/[0.02] group"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4"><div><p className="font-semibold">{formatMonth(rate.effectiveMonth)}</p><p className="mt-1 text-xs text-white/45">₱{ratePerKwh(rate).toFixed(4)}/kWh with VAT</p></div><CalendarClock className="h-4 w-4 text-white/45 transition-transform group-open:rotate-180" /></summary><div className="border-t border-white/[0.08] p-4"><RateComponents rate={rate} /></div></details>)}</div>
      </section>
    </main>
    <BottomNav />
  </div>;
}
