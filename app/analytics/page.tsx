import { redirect } from "next/navigation";
import { AlertTriangle, CalendarClock, LineChart, TrendingUp } from "lucide-react";
import BottomNav from "@/components/ui/BottomNav";
import LogoutButton from "@/components/ui/LogoutButton";
import BurnRateChart, {
  type BurnRatePoint,
} from "@/components/analytics/BurnRateChart";
import AnomalyAlertCard from "@/components/insights/AnomalyAlertCard";
import { createClient } from "@/lib/supabase/server";
import {
  computeHistoricalVariableSpendByDay,
  computeHistoricalVariableSpendFromDayRows,
  getActiveMeralcoRates,
  getMeralcoRatesForRange,
} from "@/lib/meralco-rates";
import {
  getCurrentBillingCycle,
  getEndOfManilaDay,
  getManilaDayKey,
  getStartOfManilaDay,
} from "@/lib/date-utils";

type ProfileRow = {
  monthly_budget_php: number | string | null;
  billing_cycle_start_day: number | null;
};

type UsageByDeviceDayRow = {
  device_id: string;
  day_key: string;
  usage_kwh: number | string;
};

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDayLabel(dayKey: string): string {
  const [, month, day] = dayKey.split("-");
  return `${month}/${day}`;
}

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const now = new Date();
  const startOfToday = getStartOfManilaDay(now);
  const startOfSevenDayWindow = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  const endOfToday = getEndOfManilaDay(now);

  const [activeRates, { data: profile }] =
    await Promise.all([
      getActiveMeralcoRates(supabase),
      supabase
        .from("profiles")
        .select("monthly_budget_php, billing_cycle_start_day")
        .eq("id", user.id)
        .maybeSingle<ProfileRow>(),
    ]);
  const billingCycle = getCurrentBillingCycle(
    profile?.billing_cycle_start_day ?? 1,
    now
  );
  const rateRangeStart =
    billingCycle.startDate.getTime() < startOfSevenDayWindow.getTime()
      ? billingCycle.startDate
      : startOfSevenDayWindow;
  const [rateRows, cycleUsageByDayRes, sevenDayUsageRes] = await Promise.all([
    getMeralcoRatesForRange(supabase, rateRangeStart, now),
    supabase.rpc("get_usage_kwh_by_device_day", {
      p_user_id: user.id,
      p_start: billingCycle.startDate.toISOString(),
      p_end: now.toISOString(),
    }),
    supabase.rpc("get_usage_kwh_by_device_day", {
      p_user_id: user.id,
      p_start: startOfSevenDayWindow.toISOString(),
      p_end: endOfToday.toISOString(),
    }),
  ]);

  const monthlyBudget = Math.max(1, toNumber(profile?.monthly_budget_php ?? 2000));
  const cycleUsageByDayRows = (cycleUsageByDayRes.data ?? []) as UsageByDeviceDayRow[];
  const sevenDayRows = (sevenDayUsageRes.data ?? []) as UsageByDeviceDayRow[];
  const actualCycleVariableSpend = computeHistoricalVariableSpendFromDayRows(
    cycleUsageByDayRows,
    rateRows
  );
  const cycleEstimatedBill =
    actualCycleVariableSpend +
    activeRates.fixedMonthlyChargesPhp * (1 + activeRates.vatRate);

  const kWhByDay = new Map<string, number>();
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(startOfSevenDayWindow);
    date.setDate(startOfSevenDayWindow.getDate() + index);
    const dayKey = getManilaDayKey(date);
    kWhByDay.set(dayKey, 0);
  }

  for (const row of sevenDayRows) {
    kWhByDay.set(
      row.day_key,
      (kWhByDay.get(row.day_key) ?? 0) + Math.max(0, toNumber(row.usage_kwh))
    );
  }
  const costByDay = computeHistoricalVariableSpendByDay(sevenDayRows, rateRows);

  const chartData: BurnRatePoint[] = Array.from(kWhByDay.entries()).map(
    ([dayKey, kwh]) => ({
      day: toDayLabel(dayKey),
      kwh: Number(kwh.toFixed(2)),
      cost: Number((costByDay.get(dayKey) ?? 0).toFixed(2)),
    })
  );

  const cycleStartDayKey = getManilaDayKey(billingCycle.startDate);
  const forecastLookbackDays = Math.min(7, billingCycle.elapsedDays);
  const forecastRows = sevenDayRows.filter((row) => row.day_key >= cycleStartDayKey);
  const forecastVariableSpend = computeHistoricalVariableSpendFromDayRows(
    forecastRows,
    rateRows
  );
  const avgDailyVariableCost = forecastVariableSpend / Math.max(1, forecastLookbackDays);
  const projectedVariableSpend = avgDailyVariableCost * billingCycle.totalDays;
  const projectedCycleBill =
    projectedVariableSpend +
    activeRates.fixedMonthlyChargesPhp * (1 + activeRates.vatRate);
  const remainingBudgetForVariable = Math.max(
    0,
    monthlyBudget - activeRates.fixedMonthlyChargesPhp * (1 + activeRates.vatRate)
  );
  const projectedHitDay =
    avgDailyVariableCost > 0 && projectedCycleBill >= monthlyBudget
      ? Math.min(
          billingCycle.totalDays,
          Math.ceil(remainingBudgetForVariable / avgDailyVariableCost)
        )
      : null;
  const burnPercent = Math.min((cycleEstimatedBill / monthlyBudget) * 100, 100);
  const remainingDays = billingCycle.remainingDays;

  return (
    <div className="min-h-screen bg-base pb-24 text-white">
      <header className="fixed top-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-b border-white/5 bg-base/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-5 pb-4 pt-5">
          <div className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-mint" />
            <h1 className="text-lg font-bold tracking-tight">Burn Analytics</h1>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="flex flex-col gap-4 px-5 pt-[84px]">
        <section className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-surface p-5">
          <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-mint/60" />
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/50">
            Projected Billing Cycle Bill
          </p>
          <p className="text-5xl font-bold tracking-tight">
            <span className="mr-0.5 text-3xl font-semibold text-white/50">₱</span>
            {projectedCycleBill.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="mt-2 text-sm text-white/55">
            Based on the last {forecastLookbackDays} day{forecastLookbackDays === 1 ? "" : "s"}, with {remainingDays} day(s) left in your billing cycle.
          </p>
        </section>

        <AnomalyAlertCard />

        <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">
                7-Day Financial Velocity
              </h2>
              <p className="mt-1 text-xs text-white/45">
                Uses bounded RPC aggregates, not raw unbounded telemetry scans.
              </p>
            </div>
            <TrendingUp className="h-5 w-5 text-mint" />
          </div>
          <BurnRateChart data={chartData} />
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-surface p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
              Billing Cycle To Date
            </p>
            <p className="mt-2 text-2xl font-bold">
              ₱{cycleEstimatedBill.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="mt-1 text-[11px] text-white/40">
              Variable: ₱{actualCycleVariableSpend.toFixed(2)}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-surface p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
              Burn Rate
            </p>
            <p className="mt-2 text-2xl font-bold">{burnPercent.toFixed(1)}%</p>
            <p className="mt-1 text-[11px] text-white/40">
              Of ₱{monthlyBudget.toLocaleString("en-PH")} home budget
            </p>
          </div>
        </section>

        <section
          className={`rounded-xl border p-5 ${
            projectedHitDay
              ? "border-naku/25 bg-naku/10"
              : "border-mint/25 bg-mint/10"
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            {projectedHitDay ? (
              <AlertTriangle className="h-4 w-4 text-naku" />
            ) : (
              <CalendarClock className="h-4 w-4 text-mint" />
            )}
            <h2
              className={`text-sm font-bold uppercase tracking-wider ${
                projectedHitDay ? "text-naku" : "text-mint"
              }`}
            >
              Forecast
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-white/70">
            {projectedHitDay
              ? `Trending to hit your ₱${monthlyBudget.toLocaleString("en-PH")} budget around day ${projectedHitDay} of this billing cycle. Naku, ease up on high-watt appliances before then.`
              : `Bida, current trend stays within your ₱${monthlyBudget.toLocaleString("en-PH")} budget for this billing cycle.`}
          </p>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
