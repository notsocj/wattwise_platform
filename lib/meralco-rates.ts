import type { SupabaseClient } from "@supabase/supabase-js";

export type MeralcoRateComponents = {
  generation: number;
  transmission: number;
  systemLoss: number;
  distribution: number;
  subsidies: number;
  governmentTaxes: number;
  universalCharges: number;
};

type MeralcoRatesRow = {
  effective_month: string;
  vat_rate: number | string;
  generation: number | string;
  transmission: number | string;
  system_loss: number | string;
  distribution: number | string;
  subsidies: number | string;
  government_taxes: number | string;
  universal_charges: number | string;
};

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

export function mapMeralcoRatesRowToComponents(
  row: MeralcoRatesRow
): MeralcoRateComponents {
  return {
    generation: toNumber(row.generation),
    transmission: toNumber(row.transmission),
    systemLoss: toNumber(row.system_loss),
    distribution: toNumber(row.distribution),
    subsidies: toNumber(row.subsidies),
    governmentTaxes: toNumber(row.government_taxes),
    universalCharges: toNumber(row.universal_charges),
  };
}

export async function getActiveMeralcoRates(supabase: SupabaseClient): Promise<{
  rates: MeralcoRateComponents;
  vatRate: number;
  effectiveMonth: string;
  source: "table";
}> {
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("meralco_rates")
    .select(
      "effective_month, vat_rate, generation, transmission, system_loss, distribution, subsidies, government_taxes, universal_charges"
    )
    .lte("effective_month", todayIso)
    .order("effective_month", { ascending: false })
    .limit(1)
    .maybeSingle<MeralcoRatesRow>();

  if (error) {
    throw new Error(`Failed to fetch meralco_rates: ${error.message || "unknown error"}`);
  }

  if (!data) {
    throw new Error(
      "No active meralco_rates row found in the database. Please add a row in the admin Rate Editor or run the seed migration."
    );
  }

  return {
    rates: mapMeralcoRatesRowToComponents(data),
    vatRate: toNumber(data.vat_rate),
    effectiveMonth: data.effective_month,
    source: "table",
  };
}

export function computeMeralcoBill(
  kWh: number,
  rates: MeralcoRateComponents,
  vatRate: number
): number {
  const subtotalPerKWh =
    rates.generation +
    rates.transmission +
    rates.systemLoss +
    rates.distribution +
    rates.subsidies +
    rates.governmentTaxes +
    rates.universalCharges;

  const subtotal = subtotalPerKWh * kWh;
  return subtotal * (1 + vatRate);
}