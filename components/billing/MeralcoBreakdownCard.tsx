import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";

type MeralcoBreakdownCardProps = {
  rates: {
    generation: number;
    transmission: number;
    systemLoss: number;
    distribution: number;
    universalCharges: number;
    fitAll: number;
  };
  vatRate: number;
  fixedCharges: { meteringCharge: number; supplyCharge: number };
  usageKwh?: number;
  effectiveMonth?: string;
  provenance?: {
    sourceUrl: string | null;
    sourcePdfUrl: string | null;
    fetchedAt: string | null;
    createdAt: string;
    autoUpdated: boolean;
  };
};

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

export default function MeralcoBreakdownCard({ rates, vatRate, fixedCharges, usageKwh = 0, effectiveMonth, provenance }: MeralcoBreakdownCardProps) {
  const variableSubtotal = Object.values(rates).reduce((sum, value) => sum + value, 0);
  const variableWithVat = variableSubtotal * (1 + vatRate);
  const fixedTotal = fixedCharges.meteringCharge + fixedCharges.supplyCharge;
  const items = [
    ["Generation", rates.generation],
    ["Transmission", rates.transmission],
    ["System loss", rates.systemLoss],
    ["Distribution", rates.distribution],
    ["Universal charges", rates.universalCharges],
    ["FIT-All", rates.fitAll],
  ] as const;

  const sourceUrl = provenance?.sourcePdfUrl ?? provenance?.sourceUrl;

  return <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
    <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold uppercase tracking-wider">Meralco rate breakdown</h2><p className="mt-1 text-xs text-white/45">PHP per kWh, VAT applied after variable components</p></div><span className="text-xs font-semibold text-mint">₱{variableWithVat.toFixed(4)}/kWh</span></div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">{items.map(([label, value]) => <div key={label} className="flex justify-between gap-2 text-white/60"><span>{label}</span><span className="font-semibold text-white">₱{value.toFixed(4)}{usageKwh > 0 && <span className="ml-1 text-[10px] text-white/35">(₱{(value * usageKwh * (1 + vatRate)).toFixed(2)})</span>}</span></div>)}</div>
    <div className="mt-4 border-t border-white/[0.08] pt-3 text-xs text-white/60"><div className="flex justify-between"><span>Metering + supply fixed charges</span><span className="font-semibold text-white">₱{fixedTotal.toFixed(2)}</span></div><div className="mt-1 flex justify-between"><span>VAT</span><span className="font-semibold text-white">{(vatRate * 100).toFixed(2)}%</span></div></div>
    {effectiveMonth && provenance && <div className="mt-4 border-t border-white/[0.08] pt-3 text-[11px] leading-relaxed text-white/45"><p>Effective from <span className="font-medium text-white/70">{formatMonth(effectiveMonth)}</span></p><p className="mt-1">{provenance.autoUpdated && provenance.fetchedAt ? `Last synced ${formatTimestamp(provenance.fetchedAt)}` : `Recorded in WattWise ${formatTimestamp(provenance.createdAt)}`}</p>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium text-mint hover:text-mint/80">Source: Meralco {provenance.sourcePdfUrl ? "monthly bill summary" : "rate archives"}<ExternalLink className="h-3 w-3" /></a> : <p className="mt-1">Source link was not recorded for this legacy rate.</p>}</div>}
    <Link href="/rates" className="mt-4 flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-xs font-semibold text-white/75 transition-colors hover:border-mint/35 hover:text-mint"><span>View rate details &amp; history</span><ChevronRight className="h-4 w-4" /></Link>
  </section>;
}
