import {
  TrendingDown,
  TrendingUp,
  Minus,
  Wallet,
  PlugZap,
} from "lucide-react";
import BottomNav from "@/components/ui/BottomNav";
import LogoutButton from "@/components/ui/LogoutButton";
import HomeBudgetEditor from "@/components/ui/HomeBudgetEditor";
import RealtimeRefreshBridge from "@/components/realtime/RealtimeRefreshBridge";
import DashboardLiveTelemetry from "@/components/dashboard/DashboardLiveTelemetry";
import BudgetAlertCard from "@/components/insights/BudgetAlertCard";
import WeekSummaryWidget from "@/components/calendar/WeekSummaryWidget";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeHistoricalVariableSpendFromDayRows,
  getActiveMeralcoRates,
  getMeralcoRatesForRange,
} from "@/lib/meralco-rates";
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

type DeviceRow = {
  id: string;
  device_name: string;
  mac_address: string;
  is_online: boolean | null;
  appliance_type: string | null;
  relay_state: boolean | null;
  budget_status: string | null;
  owner_id: string | null;
  tenant_id: string | null;
  user_approved_limit_php: number | string | null;
};

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

const ACTIVE_READING_WINDOW_MS = 20 * 1000; // 4 missed 5-second hardware cycles before offline
const DAY_MS = 24 * 60 * 60 * 1000;

function hasMissingRelayStateColumnError(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42703" || message.includes("relay_state");
}

async function fetchDashboardDevices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<DeviceRow[]> {
  const accessFilter = `owner_id.eq.${userId},user_id.eq.${userId},tenant_id.eq.${userId}`;
  const withRelayState = await supabase
    .from("devices")
    .select("id, device_name, mac_address, is_online, appliance_type, relay_state, budget_status, owner_id, tenant_id, user_approved_limit_php")
    .or(accessFilter)
    .order("created_at", { ascending: true });

  if (!withRelayState.error) {
    return (withRelayState.data ?? []) as DeviceRow[];
  }

  if (!hasMissingRelayStateColumnError(withRelayState.error)) {
    return [];
  }

  const withoutRelayState = await supabase
    .from("devices")
    .select("id, device_name, mac_address, is_online, appliance_type, owner_id, tenant_id, user_approved_limit_php")
    .or(accessFilter)
    .order("created_at", { ascending: true });

  if (withoutRelayState.error) {
    return [];
  }

  return (withoutRelayState.data ?? []).map((device) => ({
    ...device,
    relay_state: true,
    budget_status: "ok",
  })) as DeviceRow[];
}

function toNumber(value: number | string | null): number {
  if (value === null) {
    return 0;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function isFreshReading(recordedAt: string | null): boolean {
  if (!recordedAt) {
    return false;
  }

  const timestamp = new Date(recordedAt).getTime();

  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= ACTIVE_READING_WINDOW_MS;
}

function TenantDashboardNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="min-h-screen bg-base pb-24 text-white">
      <header className="fixed top-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-b border-white/5 bg-base/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-5 pb-4 pt-5">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight">
              Watt<span className="text-mint">Wise</span>
            </h1>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="flex min-h-screen items-center px-5 pt-[84px]">
        <section className="w-full rounded-xl border border-white/[0.06] bg-surface p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-mint/10">
            <PlugZap className="h-7 w-7 text-mint" />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight">{title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/55">
            {description}
          </p>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profileResult, activeRates, devicesRows] = await Promise.all([
    supabase
      .from("profiles")
      .select("monthly_budget_php, billing_cycle_start_day, role")
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
  const realtimeDeviceKeys = Array.from(
    new Set(
      devicesRows.flatMap((device) => [device.id, device.mac_address]).filter(Boolean)
    )
  );

  const now = new Date();
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
  const startOfDay = getStartOfManilaDay(now);
  const startOfYesterday = new Date(startOfDay.getTime() - DAY_MS);
  const endOfYesterday = new Date(startOfDay.getTime() - 1);
  const startOfSevenDayWindow = new Date(startOfDay.getTime() - 6 * DAY_MS);
  const endOfToday = getEndOfManilaDay(now);
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
        supabase.rpc("get_latest_device_readings", {
          p_user_id: user.id,
        }),
        supabase.rpc("get_usage_kwh_by_device", {
          p_user_id: user.id,
          p_start: startOfDay.toISOString(),
          p_end: now.toISOString(),
        }),
        supabase.rpc("get_usage_kwh_by_device", {
          p_user_id: user.id,
          p_start: startOfYesterday.toISOString(),
          p_end: endOfYesterday.toISOString(),
        }),
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
  let trendClassName = "text-white/50";
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
    activeRates.fixedMonthlyChargesPhp * (1 + activeRates.vatRate);
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
    activeRates.fixedMonthlyChargesPhp * (1 + activeRates.vatRate);

  return (
    <div className="min-h-screen bg-base text-white pb-24">
      <RealtimeRefreshBridge deviceKeys={realtimeDeviceKeys} />

      {/* ===== Header ===== */}
      <header className="fixed top-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-b border-white/5 bg-base/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight">
              Watt<span className="text-mint">Wise</span>
            </h1>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="px-5 pt-[84px] flex flex-col gap-4">
        <DashboardLiveTelemetry initialDevices={devices} canManageDevices={!isTenant}>

        {/* ===== Total Daily Cost Card ===== */}
        <div className="relative rounded-xl bg-surface border border-white/5 p-5 overflow-hidden">
          {/* Mint left accent */}
          <div className="absolute left-0 inset-y-0 w-1 bg-mint/60 rounded-r-full" />
          <p className="text-[11px] font-semibold tracking-widest text-white/50 uppercase mb-1">
            Total Daily Cost
          </p>
          <p className="text-5xl font-bold tracking-tight text-white">
            <span className="text-3xl font-semibold text-white/50 mr-0.5">
              ₱
            </span>
            {totalDailyCostPhp.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}
          </p>
          {showDailyTrend ? (
            <div className={`flex items-center gap-1.5 mt-2 text-sm ${trendClassName}`}>
              <TrendIcon className="w-3.5 h-3.5" />
              <span className="font-medium">{trendCopy}</span>
            </div>
          ) : null}
          <p className="text-[10px] text-white/40 mt-2">
            VAT: {(activeRates.vatRate * 100).toFixed(2)}%
          </p>
        </div>

        {/* ===== Home Wallet Card ===== */}
        <div className="relative rounded-xl bg-white/[0.03] backdrop-blur border border-white/[0.06] p-5 overflow-hidden">
          <div className="absolute left-0 inset-y-0 w-1 bg-mint/60 rounded-r-full" />

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-mint" />
              <h2 className="text-[13px] font-bold uppercase tracking-wider">
                Home Wallet
              </h2>
            </div>
            <span className="text-[10px] text-white/40 font-medium">
              Billing Cycle
            </span>
          </div>

          {isTenant ? (
            <div className="mb-4">
              <span className="text-sm text-white/70">Landlord Hard Limit</span>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                <span className="mr-0.5 text-xl text-white/50">₱</span>
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
              <span className="text-xs text-white/40">Home Burn Rate</span>
              <span className="text-xs text-white/50">
                ₱ {homeCycleEstimatedBillPhp.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} so far this billing cycle
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${homeBurnTone.bar}`}
                style={{ width: `${homeBurnPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-white/40 mt-1.5">
              {isTenant ? "Room variable energy spend" : "Variable energy spend"}: ₱ {homeCycleVariableSpendPhp.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (excludes fixed bill fees)
            </p>
            <p className="text-[10px] text-white/40 mt-1.5">
              Projected bill: ₱ {projectedCycleBill.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Based on the last {forecastLookbackDays} day{forecastLookbackDays === 1 ? "" : "s"}, with {billingCycle.remainingDays} day(s) left in your billing cycle.
            </p>
            <p
              className={`text-[10px] font-semibold tracking-wider mt-1.5 text-right uppercase ${homeBurnTone.text}`}
            >
              {homeBurnPercent.toFixed(1)}% of home budget consumed
            </p>
          </div>
        </div>

        <WeekSummaryWidget days={weekSummaries} />
        <BudgetAlertCard />
        <BudgetWarningFeed />

        <MeralcoBreakdownCard rates={activeRates.rates} vatRate={activeRates.vatRate} fixedCharges={activeRates.fixedCharges} usageKwh={homeCycleUsageKwh} effectiveMonth={activeRates.effectiveMonth} provenance={activeRates.provenance} />
        </DashboardLiveTelemetry>

      </div>

      {/* ===== Bottom Navigation ===== */}
      <BottomNav />
    </div>
  );
}
