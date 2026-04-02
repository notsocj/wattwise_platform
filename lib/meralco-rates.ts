import type { SupabaseClient } from "@supabase/supabase-js";

export type MeralcoRateComponents = {
  generation: number;
  transmission: number;
  systemLoss: number;
  distribution: number;
  universalCharges: number;
  fitAll: number;
};

export type MeralcoFixedCharges = {
  meteringCharge: number;
  supplyCharge: number;
};

type MeralcoRatesRow = {
  effective_month: string;
  vat_rate: number | string;
  generation: number | string;
  transmission: number | string;
  system_loss: number | string;
  distribution: number | string;
  universal_charges: number | string;
  fit_all: number | string;
  metering_charge: number | string;
  supply_charge: number | string;
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
    universalCharges: toNumber(row.universal_charges),
    fitAll: toNumber(row.fit_all),
  };
}

export async function getActiveMeralcoRates(supabase: SupabaseClient): Promise<{
  rates: MeralcoRateComponents;
  fixedCharges: MeralcoFixedCharges;
  fixedMonthlyChargesPhp: number;
  vatRate: number;
  effectiveMonth: string;
  source: "table";
}> {
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("meralco_rates")
    .select(
      "effective_month, vat_rate, generation, transmission, system_loss, distribution, universal_charges, fit_all, metering_charge, supply_charge"
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
    fixedCharges: {
      meteringCharge: toNumber(data.metering_charge),
      supplyCharge: toNumber(data.supply_charge),
    },
    fixedMonthlyChargesPhp:
      toNumber(data.metering_charge) + toNumber(data.supply_charge),
    vatRate: toNumber(data.vat_rate),
    effectiveMonth: data.effective_month,
    source: "table",
  };
}

export function computeMeralcoBill(
  kWh: number,
  rates: MeralcoRateComponents,
  vatRate: number,
  options?: {
    fixedChargesPhp?: number;
  }
): number {
  const subtotalPerKWh =
    rates.generation +
    rates.transmission +
    rates.systemLoss +
    rates.distribution +
    rates.universalCharges +
    rates.fitAll;

  const variableCharges = subtotalPerKWh * kWh;
  const fixedCharges = Math.max(0, options?.fixedChargesPhp ?? 0);
  const preVatTotal = variableCharges + fixedCharges;

  return preVatTotal * (1 + vatRate);
}