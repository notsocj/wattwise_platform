import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import RateComponentList from "@/components/billing/RateComponentList";
import { computeVariableRatePerKwh, type MeralcoRateComponents } from "@/lib/meralco-bill";

type MeralcoBreakdownCardProps = {
  rates: MeralcoRateComponents;
  vatRate: number;
  fixedCharges: { meteringCharge: number; supplyCharge: number };
  usageKwh?: number;
  settingsHref?: string;
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
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(`${value}T00:00:00+08:00`));
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

export default function MeralcoBreakdownCard({
  rates,
  vatRate,
  fixedCharges,
  usageKwh = 0,
  settingsHref,
  effectiveMonth,
  provenance,
}: MeralcoBreakdownCardProps) {
  const variableWithVat = computeVariableRatePerKwh(rates, vatRate);
  const fixedTotal = fixedCharges.meteringCharge + fixedCharges.supplyCharge;

  const sourceUrl = provenance?.sourcePdfUrl ?? provenance?.sourceUrl;

  return (
    <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider">Meralco rate breakdown</h2>
          <p className="mt-1 text-xs text-white/45">
            PHP per kWh, with VAT applied per component as Meralco bills it
          </p>
        </div>
        <span className="text-xs font-semibold text-mint">₱{variableWithVat.toFixed(4)}/kWh</span>
      </div>
      <RateComponentList
        rates={rates}
        vatRate={vatRate}
        fixedChargesPhp={fixedTotal}
        usageKwh={usageKwh}
        size="xs"
        settingsHref={settingsHref}
      />
      {effectiveMonth && provenance && (
        <div className="mt-4 border-t border-white/[0.08] pt-3 text-[11px] leading-relaxed text-white/45">
          <p>
            Effective from{" "}
            <span className="font-medium text-white/70">{formatMonth(effectiveMonth)}</span>
          </p>
          <p className="mt-1">
            {provenance.autoUpdated && provenance.fetchedAt
              ? `Last synced ${formatTimestamp(provenance.fetchedAt)}`
              : `Recorded in WattWise ${formatTimestamp(provenance.createdAt)}`}
          </p>
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 font-medium text-mint hover:text-mint/80"
            >
              Source: Meralco {provenance.sourcePdfUrl ? "monthly bill summary" : "rate archives"}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <p className="mt-1">Source link was not recorded for this legacy rate.</p>
          )}
        </div>
      )}
      <Link
        href="/rates"
        className="mt-4 flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-xs font-semibold text-white/75 transition-colors hover:border-mint/35 hover:text-mint"
      >
        <span>View rate details &amp; history</span>
        <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
