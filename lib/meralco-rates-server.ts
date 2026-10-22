import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, hasAdminClientConfig } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth-context";
import { applyHouseholdTier, type HouseholdUsage } from "@/lib/meralco-bill";
import {
  MERALCO_RATE_SELECT,
  selectActiveMeralcoRates,
  selectMeralcoRateHistory,
  selectMeralcoRatesForRange,
  type ActiveMeralcoRates,
  type HistoricalMeralcoRateRow,
  type MeralcoRatesRow,
} from "@/lib/meralco-rates";

export const MERALCO_RATES_CACHE_TAG = "meralco-rates";

async function fetchAllRateRows(supabase: SupabaseClient): Promise<MeralcoRatesRow[]> {
  const { data, error } = await supabase
    .from("meralco_rates")
    .select(MERALCO_RATE_SELECT)
    .order("effective_month", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch meralco_rates: ${error.message || "unknown error"}`);
  }

  return (data ?? []) as MeralcoRatesRow[];
}

// Rates change about once a month (written by the sync-meralco-rates Edge
// Function), so share them across requests and refresh hourly. The active row
// is still chosen per request from today's Manila date. Reads use the
// service-role client because the cache must not depend on a user's cookies.
const getCachedRateRows = unstable_cache(
  async () => fetchAllRateRows(createAdminClient()),
  ["meralco-rates-all-rows"],
  { revalidate: 3600, tags: [MERALCO_RATES_CACHE_TAG] }
);

// cache() takes no arguments so every caller in one request shares the result
// (callers each pass their own client object, which would defeat the key).
const getSharedRateRows = cache(async (): Promise<MeralcoRatesRow[] | null> =>
  hasAdminClientConfig() ? getCachedRateRows() : null
);

async function loadRateRows(supabase: SupabaseClient): Promise<MeralcoRatesRow[]> {
  try {
    const rows = await getSharedRateRows();
    if (rows) return rows;
  } catch (error) {
    console.warn("meralco rates cache unavailable; reading directly", error);
  }
  return fetchAllRateRows(supabase);
}

/**
 * The signed-in user's household monthly kWh (their Meralco bill setting, or
 * monitored usage projected over the billing cycle), once per request. It
 * picks the distribution tier and energy tax; null means the base tier.
 */
export const getHouseholdUsage = cache(async (): Promise<HouseholdUsage | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_household_usage");
  if (error) {
    console.warn("household usage unavailable; using the base distribution tier", error.message);
    return null;
  }

  const row = (data as Array<{ monthly_kwh: number | string; source: string }> | null)?.[0];
  const monthlyKwh = Number(row?.monthly_kwh);
  if (!row || !Number.isFinite(monthlyKwh) || monthlyKwh <= 0) return null;
  return { monthlyKwh, source: row.source === "bill" ? "bill" : "projected" };
});

/** Admin callers pass a specific owner's household instead of the viewer's. */
type HouseholdOption = { household?: HouseholdUsage | null };

async function resolveHousehold(options?: HouseholdOption): Promise<HouseholdUsage | null> {
  return options && "household" in options ? (options.household ?? null) : getHouseholdUsage();
}

function withHousehold<T extends { rates: ActiveMeralcoRates["rates"] }>(
  row: T,
  household: HouseholdUsage | null
): T {
  return { ...row, rates: applyHouseholdTier(row.rates, household) };
}

export async function getActiveMeralcoRates(
  supabase: SupabaseClient,
  options?: HouseholdOption
): Promise<ActiveMeralcoRates> {
  const [rows, household] = await Promise.all([loadRateRows(supabase), resolveHousehold(options)]);
  return withHousehold(selectActiveMeralcoRates(rows), household);
}

export async function getMeralcoRateHistory(
  supabase: SupabaseClient,
  limit = 24,
  options?: HouseholdOption
): Promise<HistoricalMeralcoRateRow[]> {
  const [rows, household] = await Promise.all([loadRateRows(supabase), resolveHousehold(options)]);
  return selectMeralcoRateHistory(rows, limit).map((row) => withHousehold(row, household));
}

export async function getMeralcoRatesForRange(
  supabase: SupabaseClient,
  startDate: Date,
  endDate: Date,
  options?: HouseholdOption
): Promise<HistoricalMeralcoRateRow[]> {
  const [rows, household] = await Promise.all([loadRateRows(supabase), resolveHousehold(options)]);
  return selectMeralcoRatesForRange(rows, startDate, endDate).map((row) =>
    withHousehold(row, household)
  );
}
