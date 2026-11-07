import { redirect } from "next/navigation";
import { startQuery } from "@/lib/start-query";
import { getSessionUser } from "@/lib/auth-context";
import PageHeader from "@/components/ui/PageHeader";
import { CARD, CardHeader } from "@/components/ui/Card";
import {
  AlertTriangle,
  CalendarClock,
  Gauge,
  LineChart,
  PlugZap,
  TrendingUp,
} from "lucide-react";
import BottomNav from "@/components/ui/BottomNav";
import BurnRateChart, {
  type BurnRatePoint,
} from "@/components/analytics/BurnRateChart";
import AnomalyAlertCard from "@/components/insights/AnomalyAlertCard";
import MeralcoBreakdownCard from "@/components/billing/MeralcoBreakdownCard";
import { createClient } from "@/lib/supabase/server";
import {
  computeHistoricalVariableSpendByDay,
  computeHistoricalVariableSpendFromDayRows,
  computeFixedChargesWithVat,
} from "@/lib/meralco-rates";
import { getActiveMeralcoRates, getMeralcoRatesForRange } from "@/lib/meralco-rates-server";
import {
  getCurrentBillingCycle,
  getEndOfManilaDay,
  getManilaDayKey,
  getStartOfManilaDay,
} from "@/lib/date-utils";

type ProfileRow = {
  monthly_budget_php: number | string | null;
  billing_cycle_start_day: number | null;
  role: string | null;
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

function TenantBurnNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="min-h-screen bg-canvas lg:min-h-0 pb-24 text-fg lg:pb-12">
      <PageHeader icon={LineChart} title="Burn Analytics" description="How fast you're spending this billing cycle, and where it's heading." />

      <main className="flex min-h-screen items-center px-5 lg:min-h-[60vh] pt-[84px] lg:pt-0">
        <section className="w-full rounded-2xl border border-fg/[0.06] bg-surface p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-mint/10">
            <PlugZap className="h-7 w-7 text-accent" />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight">{title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-fg/55">
            {description}
          </p>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const now = new Date();
  const startOfToday = getStartOfManilaDay(now);
  const startOfSevenDayWindow = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  const endOfToday = getEndOfManilaDay(now);

  const sevenDayUsagePromise = startQuery(
    supabase.rpc("get_usage_kwh_by_device_day", {
      p_user_id: user.id,
      p_start: startOfSevenDayWindow.toISOString(),
      p_end: endOfToday.toISOString(),
    })
  );
  const tenantDevicesPromise =
    user.role === "tenant"
      ? startQuery(
          supabase
            .from("devices")
            .select("owner_id, user_approved_limit_php")
            .eq("tenant_id", user.id)
        )
      : null;
  // Owners bill on their own cycle day, which the middleware forwards; start
  // that query now and use it below only if the profile agrees.
  const forwardedCycle =
    user.role && user.role !== "tenant" && user.billingCycleStartDay
      ? getCurrentBillingCycle(user.billingCycleStartDay, now)
      : null;
  const forwardedCycleUsagePromise = forwardedCycle
    ? startQuery(
        supabase.rpc("get_usage_kwh_by_device_day", {
          p_user_id: user.id,
          p_start: forwardedCycle.startDate.toISOString(),
          p_end: now.toISOString(),
        })
      )
    : null;

  const [profileResult, activeRates] = await Promise.all([
    supabase
      .from("profiles")
      .select("monthly_budget_php, billing_cycle_start_day, role")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>(),
    getActiveMeralcoRates(supabase),
  ]);
  const profile = profileResult.data;
  const isTenant = profile?.role === "tenant";
  let monthlyBudget = Math.max(1, toNumber(profile?.monthly_budget_php ?? 2000));
  let billingCycleStartDay = profile?.billing_cycle_start_day ?? 1;

  if (isTenant) {
    const { data: assignedDevices } = await (tenantDevicesPromise ??
      supabase
        .from("devices")
        .select("owner_id, user_approved_limit_php")
        .eq("tenant_id", user.id));
    const tenantLimit = (assignedDevices ?? []).reduce(
      (sum, device) => sum + toNumber(device.user_approved_limit_php),
      0
    );
    const ownerId = assignedDevices?.find((device) => device.owner_id)?.owner_id;

    if (!assignedDevices?.length) {
      return (
        <TenantBurnNotice
          title="WattWise Unit not yet assigned"
          description="Your landlord has not assigned a WattWise room unit yet. Burn Analytics will appear once your tenant account has an assigned unit."
        />
      );
    }

    if (tenantLimit <= 0) {
      return (
        <TenantBurnNotice
          title="WattWise unit limit not yet set"
          description="Your assigned WattWise unit does not have a landlord hard limit yet. Burn projections will appear after the limit is configured."
        />
      );
    }

    if (tenantLimit > 0) {
      monthlyBudget = tenantLimit;
    }

    if (ownerId) {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("billing_cycle_start_day")
        .eq("id", ownerId)
        .maybeSingle<{ billing_cycle_start_day: number | null }>();
      billingCycleStartDay = ownerProfile?.billing_cycle_start_day ?? billingCycleStartDay;
    }
  }

  const billingCycle = getCurrentBillingCycle(billingCycleStartDay, now);
  const rateRangeStart =
    billingCycle.startDate.getTime() < startOfSevenDayWindow.getTime()
      ? billingCycle.startDate
      : startOfSevenDayWindow;
  const [rateRows, cycleUsageByDayRes, sevenDayUsageRes] = await Promise.all([
    getMeralcoRatesForRange(supabase, rateRangeStart, now),
    forwardedCycleUsagePromise &&
    forwardedCycle?.startDate.getTime() === billingCycle.startDate.getTime()
      ? forwardedCycleUsagePromise
      : supabase.rpc("get_usage_kwh_by_device_day", {
          p_user_id: user.id,
          p_start: billingCycle.startDate.toISOString(),
          p_end: now.toISOString(),
        }),
    sevenDayUsagePromise,
  ]);

  const cycleUsageByDayRows = (cycleUsageByDayRes.data ?? []) as UsageByDeviceDayRow[];
  const cycleUsageKwh = cycleUsageByDayRows.reduce((sum, row) => sum + Math.max(0, toNumber(row.usage_kwh)), 0);
  const sevenDayRows = (sevenDayUsageRes.data ?? []) as UsageByDeviceDayRow[];
  const actualCycleVariableSpend = computeHistoricalVariableSpendFromDayRows(
    cycleUsageByDayRows,
    rateRows
  );
  const cycleEstimatedBill =
    actualCycleVariableSpend +
    computeFixedChargesWithVat(activeRates.fixedMonthlyChargesPhp, activeRates.vatRate);

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
    computeFixedChargesWithVat(activeRates.fixedMonthlyChargesPhp, activeRates.vatRate);
  const remainingBudgetForVariable = Math.max(
    0,
    monthlyBudget - computeFixedChargesWithVat(activeRates.fixedMonthlyChargesPhp, activeRates.vatRate)
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
    <div className="min-h-screen bg-canvas lg:min-h-0 pb-24 text-fg lg:pb-12">
      <PageHeader icon={LineChart} title="Burn Analytics" description="How fast you're spending this billing cycle, and where it's heading." />

      <main className="ww-stagger flex flex-col gap-4 px-5 pt-[84px] lg:grid lg:grid-cols-12 lg:items-start lg:gap-5 lg:pt-0">
        <section className={`${CARD} p-5 lg:order-1 lg:col-span-8 lg:self-stretch lg:p-6`}>
          <div className="mb-4">
            <CardHeader icon={Gauge} title="Projected bill this cycle" />
          </div>
          <p className="text-5xl font-bold tracking-tight">
            <span className="mr-0.5 text-3xl font-semibold text-fg/50">₱</span>
            {projectedCycleBill.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="mt-2 text-sm text-fg/55">
            Based on the last {forecastLookbackDays} day{forecastLookbackDays === 1 ? "" : "s"}, with {remainingDays} day(s) left in your billing cycle.
          </p>
        </section>

        <div className="empty:hidden lg:col-span-12">
          <AnomalyAlertCard />
        </div>

        <div className="lg:order-5 lg:col-span-12">
        <MeralcoBreakdownCard rates={activeRates.rates} vatRate={activeRates.vatRate} fixedCharges={activeRates.fixedCharges} usageKwh={cycleUsageKwh} settingsHref={isTenant ? undefined : "/settings"} effectiveMonth={activeRates.effectiveMonth} provenance={activeRates.provenance} />
        </div>

        <section className={`${CARD} p-5 lg:order-3 lg:col-span-8 lg:p-6`}>
          <div className="mb-4">
            <CardHeader icon={TrendingUp} title="Daily spend, last 7 days" />
          </div>
          <BurnRateChart data={chartData} />
        </section>

        <section className="grid grid-cols-2 gap-3 lg:order-4 lg:col-span-4 lg:grid-cols-1 lg:gap-5">
          <div className={`${CARD} p-4 lg:p-6`}>
            <p className="text-sm font-medium text-fg/60">Cycle to date</p>
            <p className="mt-2 text-2xl font-bold">
              ₱{cycleEstimatedBill.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="mt-1 text-[11px] text-fg/40">
              Variable: ₱{actualCycleVariableSpend.toFixed(2)}
            </p>
          </div>

          <div className={`${CARD} p-4 lg:p-6`}>
            <p className="text-sm font-medium text-fg/60">Budget used</p>
            <p className="mt-2 text-2xl font-bold">{burnPercent.toFixed(1)}%</p>
            <p className="mt-1 text-[11px] text-fg/40">
              Of ₱{monthlyBudget.toLocaleString("en-PH")} home budget
            </p>
          </div>
        </section>

        <section
          className={`rounded-2xl border p-5 lg:order-2 lg:col-span-4 lg:self-stretch lg:p-6 ${
            projectedHitDay
              ? "border-naku/20 bg-naku/[0.07]"
              : "border-mint/20 bg-mint/[0.06]"
          }`}
        >
          <div className="mb-3 flex items-center gap-2">
            {projectedHitDay ? (
              <AlertTriangle className="h-4 w-4 text-naku" />
            ) : (
              <CalendarClock className="h-4 w-4 text-accent" />
            )}
            <h2 className={`text-sm font-semibold ${projectedHitDay ? "text-naku" : "text-accent"}`}>Forecast</h2>
          </div>
          <p className="text-sm leading-relaxed text-fg/70">
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
