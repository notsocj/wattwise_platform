import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, hasAdminClientConfig } from "@/lib/supabase/admin";
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

export async function getActiveMeralcoRates(supabase: SupabaseClient): Promise<ActiveMeralcoRates> {
  return selectActiveMeralcoRates(await loadRateRows(supabase));
}

export async function getMeralcoRateHistory(
  supabase: SupabaseClient,
  limit = 24
): Promise<HistoricalMeralcoRateRow[]> {
  return selectMeralcoRateHistory(await loadRateRows(supabase), limit);
}

export async function getMeralcoRatesForRange(
  supabase: SupabaseClient,
  startDate: Date,
  endDate: Date
): Promise<HistoricalMeralcoRateRow[]> {
  return selectMeralcoRatesForRange(await loadRateRows(supabase), startDate, endDate);
}
