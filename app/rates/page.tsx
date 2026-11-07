import PageHeader from "@/components/ui/PageHeader";
import RateComponentList from "@/components/billing/RateComponentList";
import { getSessionUser } from "@/lib/auth-context";
import { ChevronDown, ExternalLink, History } from "lucide-react";
import { CARD, CardHeader } from "@/components/ui/Card";
import BottomNav from "@/components/ui/BottomNav";
import { createClient } from "@/lib/supabase/server";
import { type HistoricalMeralcoRateRow, computeMeralcoBill } from "@/lib/meralco-rates";
import { getMeralcoRateHistory } from "@/lib/meralco-rates-server";
import { redirect } from "next/navigation";

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

function ratePerKwh(rate: HistoricalMeralcoRateRow): number {
  return computeMeralcoBill(1, rate.rates, rate.vatRate);
}

function RateComponents({ rate, settingsHref }: { rate: HistoricalMeralcoRateRow; settingsHref?: string }) {
  const sourceUrl = rate.provenance.sourcePdfUrl ?? rate.provenance.sourceUrl;

  return (
    <div className="space-y-4">
      <RateComponentList
        rates={rate.rates}
        vatRate={rate.vatRate}
        fixedChargesPhp={rate.fixedCharges.meteringCharge + rate.fixedCharges.supplyCharge}
        settingsHref={settingsHref}
      />
      <div className="rounded-lg bg-fg/[0.03] p-3 text-xs leading-relaxed text-fg/55">
        <p>
          Effective from{" "}
          <span className="font-semibold text-fg/80">{formatMonth(rate.effectiveMonth)}</span>
        </p>
        <p className="mt-1">
          {rate.provenance.autoUpdated && rate.provenance.fetchedAt
            ? `Last synced ${formatTimestamp(rate.provenance.fetchedAt)}`
            : `Recorded in WattWise ${formatTimestamp(rate.provenance.createdAt)}`}
        </p>
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-semibold text-accent hover:text-accent/80"
          >
            Open Meralco {rate.provenance.sourcePdfUrl ? "monthly bill summary" : "rate archives"}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <p className="mt-1">
            No official source link was recorded for this legacy/manual rate row.
          </p>
        )}
      </div>
    </div>
  );
}

export default async function RatesPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const history = await getMeralcoRateHistory(supabase);
  const current = history[0];
  const settingsHref =
    user.role === "manager" ? "/manager/settings" : user.role === "tenant" ? undefined : "/settings";

  return (
    <div className="min-h-screen bg-canvas lg:min-h-0 pb-24 text-fg lg:pb-12">
      <PageHeader
        backHref="/dashboard"
        eyebrow="Rate transparency"
        title="Meralco Rates"
        description="The Meralco rates WattWise uses to price your usage, with every component and its source."
      />

      <main className="ww-stagger space-y-5 px-5 pt-[84px] lg:pt-0">
        {current ? (
          <section className={`${CARD} p-5 lg:p-6`}>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-fg/60">Current applicable rate</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">{formatMonth(current.effectiveMonth)}</h2>
              </div>
              <div className="rounded-xl border border-mint/20 bg-mint/[0.08] px-3.5 py-2 text-right">
                <p className="text-[11px] font-medium text-fg/50">With VAT</p>
                <p className="mt-0.5 text-base font-semibold text-accent">
                  ₱{ratePerKwh(current).toFixed(4)}/kWh
                </p>
              </div>
            </div>
            <RateComponents rate={current} settingsHref={settingsHref} />
          </section>
        ) : (
          <section className="rounded-xl border border-naku/30 bg-naku/10 p-5 text-sm text-fg/70">
            No Meralco rate has been configured yet.
          </section>
        )}

        <section className={`${CARD} p-5 lg:p-6`}>
          <div className="mb-4">
            <CardHeader icon={History} title="Rate history" />
            <p className="mt-2 text-xs text-fg/45">Past monthly rate rows used for billing calculations.</p>
          </div>
          <div className="space-y-3">
            {history.map((rate, index) => (
              <details
                key={rate.effectiveMonth}
                open={index === 0}
                className="group rounded-xl border border-fg/[0.08] bg-fg/[0.02] transition-colors duration-150 ease-out open:bg-fg/[0.03]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-semibold">{formatMonth(rate.effectiveMonth)}</p>
                    <p className="mt-1 text-xs text-fg/45">
                      ₱{ratePerKwh(rate).toFixed(4)}/kWh with VAT
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-fg/45 transition-transform duration-200 ease-out group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="border-t border-fg/[0.08] p-4">
                  <RateComponents rate={rate} />
                </div>
              </details>
            ))}
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
