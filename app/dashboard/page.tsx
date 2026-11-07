import {
  TrendingDown,
  TrendingUp,
  Minus,
  PhilippinePeso,
  Wallet,
} from "@/components/ui/icons";
import { CARD, CardHeader, CardPill } from "@/components/ui/Card";
import BottomNav from "@/components/ui/BottomNav";
import { Suspense } from "react";
import { startQuery } from "@/lib/start-query";
import { getSessionUser } from "@/lib/auth-context";
import PageHeader from "@/components/ui/PageHeader";
import HomeBudgetEditor from "@/components/ui/HomeBudgetEditor";
import DashboardLiveTelemetry from "@/components/dashboard/DashboardLiveTelemetry";
import TenantDashboardNotice from "@/components/dashboard/TenantDashboardNotice";
import BudgetAlertCard from "@/components/insights/BudgetAlertCard";
import WeekSummaryWidget from "@/components/calendar/WeekSummaryWidget";
import { redirect } from "next/navigation";
import { isFreshReading } from "@/lib/device-telemetry";
import { fetchDashboardDevices } from "@/lib/dashboard-data";
import { createClient } from "@/lib/supabase/server";
import {
  computeHistoricalVariableSpendFromDayRows,
  computeFixedChargesWithVat,
} from "@/lib/meralco-rates";
import { getActiveMeralcoRates, getMeralcoRatesForRange } from "@/lib/meralco-rates-server";
import {
  aggregateUsageByDay,
  buildWeekSummaries,
  type UsageByDeviceDayRow,
} from "@/lib/calendar-analytics";
import {
  getCurrentBillingCycle,
  getEndOfManilaDay,
  getManilaDayKey,
  getStartOfManilaDay,
} from "@/lib/date-utils";
import { isTenantRole } from "@/lib/roles";
import MeralcoBreakdownCard from "@/components/billing/MeralcoBreakdownCard";
import BudgetWarningFeed from "@/components/insights/BudgetWarningFeed";
import { getBudgetToneClasses } from "@/lib/budget-policy";

type LatestReadingRow = {
  device_id: string;
  average_watts: number | string | null;
  voltage_v: number | string | null;
  current_a: number | string | null;
  energy_kwh: number | string | null;
  recorded_at: string | null;
};

type UsageByDeviceRow = {
  device_id: string;
  usage_kwh: number | string;
};
type ProfileRow = {
  full_name: string | null;
  monthly_budget_php: number | string | null;
  billing_cycle_start_day: number | null;
  role: string | null;
};

type DashboardDevice = {
  id: string;
  macAddress: string;
  name: string;
  applianceType: string | null;
  watts: number;
  volts: number;
  amps: number;
  dailyKWh: number;
  isOnline: boolean;
  isActive: boolean;
  relayState: boolean;
  recordedAt: string | null;
  budgetStatus: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toNumber(value: number | string | null): number {
  if (value === null) {
    return 0;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  // These only need the user id and the current time, so start them now and
  // await them later instead of waiting for the profile and device lookups.
  const now = new Date();
  const startOfDay = getStartOfManilaDay(now);
  const startOfYesterday = new Date(startOfDay.getTime() - DAY_MS);
  const endOfYesterday = new Date(startOfDay.getTime() - 1);
  const startOfSevenDayWindow = new Date(startOfDay.getTime() - 6 * DAY_MS);
  const endOfToday = getEndOfManilaDay(now);
  const latestReadingsPromise = startQuery(
    supabase.rpc("get_latest_device_readings", { p_user_id: user.id })
  );
  const dailyUsagePromise = startQuery(
    supabase.rpc("get_usage_kwh_by_device", {
      p_user_id: user.id,
      p_start: startOfDay.toISOString(),
      p_end: now.toISOString(),
    })
  );
  const yesterdayUsagePromise = startQuery(
    supabase.rpc("get_usage_kwh_by_device", {
      p_user_id: user.id,
      p_start: startOfYesterday.toISOString(),
      p_end: endOfYesterday.toISOString(),
    })
  );
  const sevenDayUsagePromise = startQuery(
    supabase.rpc("get_usage_kwh_by_device_day", {
      p_user_id: user.id,
      p_start: startOfSevenDayWindow.toISOString(),
      p_end: endOfToday.toISOString(),
    })
  );

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

  const [profileResult, activeRates, devicesRows] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, monthly_budget_php, billing_cycle_start_day, role")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>(),
    getActiveMeralcoRates(supabase),
    fetchDashboardDevices(supabase, user.id),
  ]);
  const profileData = profileResult.data;

  if (profileData?.role === "manager") {
    redirect("/manager");
  }

  const isTenant = isTenantRole(profileData?.role);
  const tenantHardLimit = devicesRows.reduce(
    (sum, device) => sum + toNumber(device.user_approved_limit_php),
    0
  );

  if (isTenant && devicesRows.length === 0) {
    return (
      <TenantDashboardNotice
        title="WattWise Unit not yet assigned"
        description="Your tenant account is active, but your landlord has not assigned a WattWise room unit yet. Once assigned, your live usage and billing-cycle limit will show here."
      />
    );
  }

  if (isTenant && tenantHardLimit <= 0) {
    return (
      <TenantDashboardNotice
        title="WattWise unit limit not yet set"
        description="Your assigned WattWise unit is connected to your tenant account, but your landlord has not set the hard peso limit yet. Your usage dashboard will appear after the limit is configured."
      />
    );
  }

  const deviceIds = devicesRows.map((device) => device.id);
  let billingCycleStartDay = profileData?.billing_cycle_start_day ?? 1;
  if (isTenant) {
    const ownerId = devicesRows.find((device) => device.owner_id)?.owner_id;
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

  const [
    rateRows,
    latestReadingsRes,
    dailyUsageRes,
    yesterdayUsageRes,
    cycleUsageByDayRes,
    sevenDayUsageRes,
  ] = deviceIds.length
    ? await Promise.all([
        getMeralcoRatesForRange(supabase, rateRangeStart, now),
        latestReadingsPromise,
        dailyUsagePromise,
        yesterdayUsagePromise,
        forwardedCycleUsagePromise &&
        forwardedCycle?.startDate.getTime() === billingCycle.startDate.getTime()
          ? forwardedCycleUsagePromise
          : supabase.rpc("get_usage_kwh_by_device_day", {
              p_user_id: user.id,
              p_start: billingCycle.startDate.toISOString(),
              p_end: now.toISOString(),
            }),
        sevenDayUsagePromise,
      ])
    : [
        [] as Awaited<ReturnType<typeof getMeralcoRatesForRange>>,
        { data: [] as LatestReadingRow[] },
        { data: [] as UsageByDeviceRow[] },
        { data: [] as UsageByDeviceRow[] },
        { data: [] as UsageByDeviceDayRow[] },
        { data: [] as UsageByDeviceDayRow[] },
      ];

  const latestReadings = (latestReadingsRes.data ?? []) as LatestReadingRow[];
  const dailyUsageRows = (dailyUsageRes.data ?? []) as UsageByDeviceRow[];
  const yesterdayUsageRows = (yesterdayUsageRes.data ?? []) as UsageByDeviceRow[];
  const cycleUsageByDayRows = (cycleUsageByDayRes.data ?? []) as UsageByDeviceDayRow[];
  const sevenDayUsageRows = (sevenDayUsageRes.data ?? []) as UsageByDeviceDayRow[];

  const latestWattsByDevice = new Map<string, number>();
  const latestVoltsByDevice = new Map<string, number>();
  const latestAmpsByDevice = new Map<string, number>();
  const latestRecordedAtByDevice = new Map<string, string | null>();

  for (const row of latestReadings) {
    latestWattsByDevice.set(row.device_id, Math.max(0, toNumber(row.average_watts)));
    latestVoltsByDevice.set(row.device_id, Math.max(0, toNumber(row.voltage_v ?? null)));
    latestAmpsByDevice.set(row.device_id, Math.max(0, toNumber(row.current_a ?? null)));
    latestRecordedAtByDevice.set(row.device_id, row.recorded_at);
  }

  const dailyKWhByDevice = new Map<string, number>();
  for (const row of dailyUsageRows) {
    dailyKWhByDevice.set(row.device_id, Math.max(0, toNumber(row.usage_kwh)));
  }

  const devices: DashboardDevice[] = devicesRows.map((device) => {
    const latestWatts = Math.round(latestWattsByDevice.get(device.id) ?? 0);
    const latestVolts = Math.round(latestVoltsByDevice.get(device.id) ?? 0);
    const latestAmps = latestAmpsByDevice.get(device.id) ?? null;
    const hasFreshTelemetry = isFreshReading(
      latestRecordedAtByDevice.get(device.id) ?? null
    );
    const currentWatts = hasFreshTelemetry ? latestWatts : 0;
    const currentVolts = hasFreshTelemetry ? (latestVolts > 0 ? latestVolts : 230) : 0;
    const derivedAmps =
      currentVolts > 0
        ? Number((Math.max(0, currentWatts) / currentVolts).toFixed(1))
        : 0;
    const currentAmps = hasFreshTelemetry
      ? Number((Math.max(0, latestAmps ?? derivedAmps)).toFixed(1))
      : 0;

    return {
      id: device.id,
      macAddress: device.mac_address,
      name: device.device_name,
      applianceType: device.appliance_type,
      watts: currentWatts,
      volts: currentVolts,
      amps: currentAmps,
      dailyKWh: dailyKWhByDevice.get(device.id) ?? 0,
      isOnline: hasFreshTelemetry,
      isActive: hasFreshTelemetry && currentWatts > 0,
      relayState: device.relay_state !== false,
      recordedAt: latestRecordedAtByDevice.get(device.id) ?? null,
      budgetStatus: device.budget_status,
    };
  });

  const totalDailyKWh = devices.reduce((sum, d) => sum + d.dailyKWh, 0);
  const totalDailyCostPhp = computeHistoricalVariableSpendFromDayRows(
    [{ day_key: getManilaDayKey(now), usage_kwh: totalDailyKWh }],
    rateRows
  );

  const totalYesterdayKWh = yesterdayUsageRows.reduce(
    (sum, row) => sum + Math.max(0, toNumber(row.usage_kwh)),
    0
  );
  const totalYesterdayCostPhp = computeHistoricalVariableSpendFromDayRows(
    [{ day_key: getManilaDayKey(startOfYesterday), usage_kwh: totalYesterdayKWh }],
    rateRows
  );
  const dayOverDayDeltaPhp = totalDailyCostPhp - totalYesterdayCostPhp;
  const hasSameSpend = Math.abs(dayOverDayDeltaPhp) < 0.01;
  const hasNoDailyCostYet = totalDailyCostPhp < 0.01;
  const showDailyTrend = !hasNoDailyCostYet;

  let TrendIcon = Minus;
  let trendClassName = "text-fg/50";
  let trendCopy = "No change from yesterday";

  if (!hasNoDailyCostYet && !hasSameSpend && totalYesterdayCostPhp > 0) {
    const dayOverDayPercent = Math.abs(
      (dayOverDayDeltaPhp / totalYesterdayCostPhp) * 100
    );

    if (dayOverDayDeltaPhp > 0) {
      TrendIcon = TrendingUp;
      trendClassName = "text-naku";
      trendCopy = `${dayOverDayPercent.toFixed(1)}% increase from yesterday`;
    } else {
      TrendIcon = TrendingDown;
      trendClassName = "text-bida";
      trendCopy = `${dayOverDayPercent.toFixed(1)}% decrease from yesterday`;
    }
  } else if (!hasNoDailyCostYet && !hasSameSpend && totalYesterdayCostPhp === 0) {
    TrendIcon = TrendingUp;
    trendClassName = "text-naku";
    trendCopy = "New spend today (no usage yesterday)";
  }

  const monthlyBudget = isTenant
    ? tenantHardLimit
    : toNumber(profileData?.monthly_budget_php ?? 2000);
  const safeMonthlyBudget = monthlyBudget > 0 ? monthlyBudget : 1;
  const homeCycleVariableSpendPhp = computeHistoricalVariableSpendFromDayRows(
    cycleUsageByDayRows,
    rateRows
  );
  const homeCycleUsageKwh = cycleUsageByDayRows.reduce((sum, row) => sum + Math.max(0, toNumber(row.usage_kwh)), 0);
  const homeCycleEstimatedBillPhp =
    homeCycleVariableSpendPhp +
    computeFixedChargesWithVat(activeRates.fixedMonthlyChargesPhp, activeRates.vatRate);
  const homeBurnPercent = Math.min(
    (homeCycleEstimatedBillPhp / safeMonthlyBudget) * 100,
    100
  );
  const homeBurnTone = getBudgetToneClasses(homeBurnPercent);
  const cycleStartDayKey = getManilaDayKey(billingCycle.startDate);
  const forecastLookbackDays = Math.min(7, billingCycle.elapsedDays);
  const forecastUsageRows = sevenDayUsageRows.filter((row) => row.day_key >= cycleStartDayKey);
  const weekSummaries = buildWeekSummaries({
    usageByDay: aggregateUsageByDay(sevenDayUsageRows),
    rates: activeRates.rates,
    vatRate: activeRates.vatRate,
    endDate: now,
  });
  const sevenDayVariableSpendPhp = computeHistoricalVariableSpendFromDayRows(
    forecastUsageRows,
    rateRows
  );
  const projectedCycleBill =
    (sevenDayVariableSpendPhp / Math.max(1, forecastLookbackDays)) * billingCycle.totalDays +
    computeFixedChargesWithVat(activeRates.fixedMonthlyChargesPhp, activeRates.vatRate);

  return (
    <div className="min-h-screen bg-canvas lg:min-h-0 text-fg pb-24 lg:pb-12">

      {/* ===== Header ===== */}
      <PageHeader
        title={<>Watt<span className="text-accent">Wise</span></>}
        desktopTitle={getGreeting(now, profileData?.full_name)}
        description={new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric" }).format(now)}
      />

      <div className="ww-stagger px-5 pt-[84px] flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start lg:grid-cols-12 lg:items-start lg:gap-5 lg:pt-0">
        <DashboardLiveTelemetry initialDevices={devices} canManageDevices={!isTenant}>

        {/* ===== Total Daily Cost Card ===== */}
        <div className={`${CARD} p-5 md:self-stretch lg:col-span-6 lg:p-6`}>
          <CardHeader
            icon={PhilippinePeso}
            title="Today's cost"
            aside={<CardPill>incl. {(activeRates.vatRate * 100).toFixed(0)}% VAT</CardPill>}
          />
          <p className="mt-4 text-5xl font-bold tracking-tight text-fg">
            <span className="mr-0.5 text-3xl font-semibold text-fg/50">₱</span>
            {totalDailyCostPhp.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}
          </p>
          {showDailyTrend ? (
            <div className={`mt-2 flex items-center gap-1.5 text-sm ${trendClassName}`}>
              <TrendIcon className="h-3.5 w-3.5" />
              <span className="font-medium">{trendCopy}</span>
            </div>
          ) : null}
        </div>

        {/* ===== Home Wallet Card ===== */}
        <div className={`${CARD} p-5 md:col-span-2 lg:col-span-12 lg:self-stretch lg:p-6 xl:col-span-7`}>
          <div className="mb-4">
            <CardHeader icon={Wallet} title={isTenant ? "Room wallet" : "Home wallet"} aside={<CardPill>Billing cycle</CardPill>} />
          </div>

          {isTenant ? (
            <div className="mb-4">
              <span className="text-sm text-fg/70">Landlord Hard Limit</span>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                <span className="mr-0.5 text-xl text-fg/50">₱</span>
                {monthlyBudget.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          ) : (
            <HomeBudgetEditor initialBudget={monthlyBudget} />
          )}

          <div className="mb-1.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-fg/50">Spent this cycle</span>
              <span className="text-xs text-fg/50">
                ₱ {homeCycleEstimatedBillPhp.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} so far this billing cycle
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-fg/[0.06]">
              <div
                className={`h-full origin-left rounded-full transition-[width,scale] duration-700 ease-out starting:scale-x-0 ${homeBurnTone.bar}`}
                style={{ width: `${homeBurnPercent}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-fg/40">
              {isTenant ? "Room variable energy spend" : "Variable energy spend"}: ₱ {homeCycleVariableSpendPhp.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (excludes fixed bill fees)
            </p>
            <p className="mt-1 text-xs leading-relaxed text-fg/40">
              Projected bill: ₱ {projectedCycleBill.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Based on the last {forecastLookbackDays} day{forecastLookbackDays === 1 ? "" : "s"}, with {billingCycle.remainingDays} day(s) left in your billing cycle.
            </p>
            <p className={`mt-2 text-right text-xs font-semibold ${homeBurnTone.text}`}>
              {homeBurnPercent.toFixed(1)}% of {isTenant ? "room" : "home"} budget used
            </p>
          </div>
        </div>

        <div className="md:col-span-2 lg:col-span-12 lg:self-stretch lg:[&>*]:h-full xl:col-span-5">
          <WeekSummaryWidget days={weekSummaries} />
        </div>
        {/* Alerts render nothing when there is nothing to say; empty wrappers collapse. */}
        <div className="empty:hidden md:col-span-2 lg:col-span-12">
          <BudgetAlertCard />
        </div>
        <div className="empty:hidden md:col-span-2 lg:col-span-12">
          <Suspense fallback={null}>
            <BudgetWarningFeed />
          </Suspense>
        </div>

        {/* Desktop shows connected units first; this detail card moves below them. */}
        <div className="md:col-span-2 lg:order-last lg:col-span-12">
        <MeralcoBreakdownCard rates={activeRates.rates} vatRate={activeRates.vatRate} fixedCharges={activeRates.fixedCharges} usageKwh={homeCycleUsageKwh} settingsHref={isTenant ? undefined : "/settings"} effectiveMonth={activeRates.effectiveMonth} provenance={activeRates.provenance} />
        </div>
        </DashboardLiveTelemetry>

      </div>

      {/* ===== Bottom Navigation ===== */}
      <BottomNav />
    </div>
  );
}

/** Desktop dashboard title, in Manila time: "Good evening, Caleb". */
function getGreeting(now: Date, fullName: string | null | undefined) {
  const hour = Number(new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", hourCycle: "h23" }).format(now));
  const partOfDay = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = fullName?.trim().split(/\s+/)[0];
  return firstName ? `${partOfDay}, ${firstName}` : partOfDay;
}
