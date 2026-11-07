import Link from "next/link";
import { ChevronRight, ExternalLink, ReceiptText } from "lucide-react";
import { CARD, CardHeader } from "@/components/ui/Card";
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
    <section className={`${CARD} p-5 lg:p-6`}>
      <div className="mb-4">
        <CardHeader
          icon={ReceiptText}
          title="Meralco rate breakdown"
          aside={<span className="text-sm font-semibold text-accent">₱{variableWithVat.toFixed(4)}/kWh</span>}
        />
        <p className="mt-2 text-xs text-fg/45">PHP per kWh, with VAT applied per component as Meralco bills it.</p>
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
        <div className="mt-4 border-t border-fg/[0.08] pt-3 text-[11px] leading-relaxed text-fg/45">
          <p>
            Effective from{" "}
            <span className="font-medium text-fg/70">{formatMonth(effectiveMonth)}</span>
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
              className="mt-1 inline-flex items-center gap-1 font-medium text-accent hover:text-accent/80"
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
        className="mt-4 flex items-center justify-between rounded-lg border border-fg/[0.08] bg-fg/[0.02] px-3 py-2.5 text-xs font-semibold text-fg/75 transition-colors hover:border-mint/35 hover:text-accent"
      >
        <span>View rate details &amp; history</span>
        <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
