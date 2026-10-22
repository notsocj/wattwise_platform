import {
  MERALCO_COMPONENT_LINES,
  vatMultiplierFor,
  type MeralcoRateComponents,
} from "@/lib/meralco-bill";

type RateComponentListProps = {
  rates: MeralcoRateComponents;
  vatRate: number;
  fixedChargesPhp: number;
  /** When set, each line also shows its VAT-inclusive cost for this usage. */
  usageKwh?: number;
  size?: "sm" | "xs";
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Every per-kWh line of a Meralco residential bill, one per row, with the
 * fixed charges and the VAT that applies to each part. Adjustments that are
 * zero this month are hidden.
 */
export default function RateComponentList({
  rates,
  vatRate,
  fixedChargesPhp,
  usageKwh = 0,
  size = "sm",
}: RateComponentListProps) {
  const lines = MERALCO_COMPONENT_LINES.filter(
    (line) => !line.adjustment || rates[line.key] !== 0
  );
  const textSize = size === "sm" ? "text-sm" : "text-xs";
  const rowPadding = size === "sm" ? "py-2" : "py-1.5";
  const vatLines = [
    { label: "Generation", value: rates.vatGeneration ?? vatRate },
    { label: "Transmission", value: rates.vatTransmission ?? vatRate },
    { label: "Ancillary service", value: rates.vatAncillary ?? vatRate },
    { label: "Distribution, supply, metering & adjustments", value: vatRate },
  ];

  return (
    <div className={`space-y-4 ${textSize}`}>
      <dl className="divide-y divide-white/[0.06]">
        {lines.map((line) => {
          const value = rates[line.key];
          const isCredit = value < 0;
          return (
            <div
              key={line.key}
              className={`flex items-baseline justify-between gap-4 ${rowPadding} text-white/60`}
            >
              <dt className="min-w-0">
                {line.label}
                {line.vat === "none" ? (
                  <span className="ml-1.5 text-[11px] text-white/50">no VAT</span>
                ) : null}
              </dt>
              <dd className="shrink-0 text-right tabular-nums">
                <span className={`font-semibold ${isCredit ? "text-bida" : "text-white"}`}>
                  {isCredit ? "−" : ""}₱{Math.abs(value).toFixed(4)}
                </span>
                {usageKwh > 0 ? (
                  <span className="ml-1.5 text-[11px] text-white/50">
                    ({isCredit ? "−" : ""}₱
                    {Math.abs(value * usageKwh * vatMultiplierFor(line.vat, rates, vatRate)).toFixed(2)})
                  </span>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="space-y-1.5 border-t border-white/[0.08] pt-3 text-white/60">
        <div className="flex items-baseline justify-between gap-4">
          <span className="min-w-0">Metering + supply fixed charges</span>
          <span className="shrink-0 font-semibold tabular-nums text-white">
            ₱{fixedChargesPhp.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 border-t border-white/[0.08] pt-3 text-white/60">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">VAT</p>
        {vatLines.map((line) => (
          <div key={line.label} className="flex items-baseline justify-between gap-4">
            <span className="min-w-0">{line.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-white">
              {formatPercent(line.value)}
            </span>
          </div>
        ))}
        <p className="text-[11px] leading-relaxed text-white/50">
          System loss, Universal Charge, FIT-All, GEA-All, real property tax, and the lifeline
          subsidy are not subject to VAT.
        </p>
      </div>
    </div>
  );
}
