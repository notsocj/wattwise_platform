import { DollarSign } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeVariableRatePerKwh,
  mapMeralcoRatesRowToComponents,
  MERALCO_RATE_SELECT,
  type MeralcoRatesRow,
} from "@/lib/meralco-rates";
export default async function AdminRatesPage() {
  const { data } = await createAdminClient()
    .from("meralco_rates")
    .select(MERALCO_RATE_SELECT)
    .order("effective_month", { ascending: false })
    .limit(24)
    .returns<MeralcoRatesRow[]>();
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <DollarSign className="h-6 w-6 text-mint" />
        <h1 className="text-2xl font-bold">Meralco Rates</h1>
      </div>
      <p className="mb-6 text-white/50">
        Rate history is sourced from the synchronized Meralco table. Creation and edits are audited
        through the admin API.
      </p>
      <div className="overflow-x-auto rounded-lg border border-white/10 bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-white/50">
            <tr>
              {[
                "Effective month",
                "Generation",
                "Transmission",
                "Ancillary",
                "System loss",
                "Distribution",
                "Supply",
                "Metering",
                "Adjustments",
                "VAT",
                "Fixed charges",
                "₱/kWh incl. VAT",
              ].map((h) => (
                <th key={h} className="p-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => {
              const components = mapMeralcoRatesRowToComponents(r);
              const adjustments =
                components.awatAdjustment +
                components.regulatoryResetAdjustment +
                components.lifelineRateAdjustment +
                components.seniorCitizenSubsidy +
                components.rptCharge +
                components.geaAll +
                components.lifelineSubsidy;
              return (
                <tr key={r.effective_month} className="border-b border-white/5">
                  <td className="p-4">{r.effective_month}</td>
                  <td className="p-4">₱{Number(r.generation).toFixed(4)}</td>
                  <td className="p-4">₱{Number(r.transmission).toFixed(4)}</td>
                  <td className="p-4">₱{Number(r.ancillary_service).toFixed(4)}</td>
                  <td className="p-4">₱{Number(r.system_loss).toFixed(4)}</td>
                  <td className="p-4">₱{Number(r.distribution).toFixed(4)}</td>
                  <td className="p-4">₱{Number(r.supply_rate).toFixed(4)}</td>
                  <td className="p-4">₱{Number(r.metering_rate).toFixed(4)}</td>
                  <td className="p-4">₱{adjustments.toFixed(4)}</td>
                  <td className="p-4">
                    {(Number(r.vat_rate) * 100).toFixed(2)}%
                    {components.vatGeneration !== null ? (
                      <span className="block text-xs text-white/50">
                        Gen {(components.vatGeneration * 100).toFixed(2)}%
                      </span>
                    ) : null}
                  </td>
                  <td className="p-4">
                    ₱{(Number(r.metering_charge) + Number(r.supply_charge)).toFixed(2)}
                  </td>
                  <td className="p-4 font-semibold">
                    ₱{computeVariableRatePerKwh(components, Number(r.vat_rate)).toFixed(4)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
