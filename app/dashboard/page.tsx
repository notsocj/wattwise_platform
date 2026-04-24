import Link from "next/link";
import {
  TrendingDown,
  TrendingUp,
  Minus,
  ChevronRight,
  Wind,
  Tv,
  Refrigerator,
  Wallet,
  HelpCircle,
} from "lucide-react";
import BottomNav from "@/components/ui/BottomNav";
import LogoutButton from "@/components/ui/LogoutButton";
import HomeBudgetEditor from "@/components/ui/HomeBudgetEditor";
import AddApplianceTile from "@/components/ui/AddApplianceTile";
import RealtimeRefreshBridge from "@/components/realtime/RealtimeRefreshBridge";
import RelayToggle from "@/components/ui/RelayToggle";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeMeralcoBill,
  getActiveMeralcoRates,
} from "@/lib/meralco-rates";

const MOCK_AI_TIP = 'Overall usage is 10% lower today, Bida!';

type DeviceRow = {
  id: string;
  device_name: string;
  mac_address: string;
  is_online: boolean | null;
  appliance_type: string | null;
  relay_state: boolean | null;
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
};

type DashboardDevice = {
  id: string;
  name: string;
  watts: number;
  volts: number;
  amps: number;
  dailyKWh: number;
  isOnline: boolean;
  isActive: boolean;
  icon: typeof Wind;
  relayState: boolean;
};

const ACTIVE_READING_WINDOW_MS = 5 * 60 * 1000;

function getDeviceIcon(applianceType: string | null, deviceName: string) {
  // Prefer appliance_type from DB (set during AI onboarding)
  if (applianceType) {
    switch (applianceType) {
      case "aircon":
        return Wind;
      case "refrigerator":
        return Refrigerator;
      case "tv":
        return Tv;
      case "other":
        return HelpCircle;
    }
  }

  // Fallback: match by device name for legacy devices
  const label = deviceName.toLowerCase();

  if (label.includes("aircon") || label.includes("ac") || label.includes("fan")) {
    return Wind;
  }

  if (label.includes("fridge") || label.includes("freezer") || label.includes("ref")) {
    return Refrigerator;
  }

  return Tv;
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

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: devicesData }, { data: profileData }, activeRates] = await Promise.all([
    supabase
      .from("devices")
      .select("id, device_name, mac_address, is_online, appliance_type, relay_state")
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("monthly_budget_php")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>(),
    getActiveMeralcoRates(supabase),
  ]);

  const devicesRows = (devicesData ?? []) as DeviceRow[];
  const deviceIds = devicesRows.map((device) => device.id);
  const realtimeDeviceKeys = Array.from(
    new Set(
      devicesRows.flatMap((device) => [device.id, device.mac_address]).filter(Boolean)
    )
  );

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfDay);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const endOfYesterday = new Date(startOfDay);
  endOfYesterday.setMilliseconds(-1);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const now = new Date();

  const [latestReadingsRes, dailyUsageRes, yesterdayUsageRes, monthlyUsageRes] = deviceIds.length
    ? await Promise.all([
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
        supabase.rpc("get_usage_kwh_by_device", {
          p_user_id: user.id,
          p_start: startOfMonth.toISOString(),
          p_end: now.toISOString(),
        }),
      ])
    : [
        { data: [] as LatestReadingRow[] },
        { data: [] as UsageByDeviceRow[] },
        { data: [] as UsageByDeviceRow[] },
        { data: [] as UsageByDeviceRow[] },
      ];

  const latestReadings = (latestReadingsRes.data ?? []) as LatestReadingRow[];
  const dailyUsageRows = (dailyUsageRes.data ?? []) as UsageByDeviceRow[];
  const yesterdayUsageRows = (yesterdayUsageRes.data ?? []) as UsageByDeviceRow[];
  const monthlyUsageRows = (monthlyUsageRes.data ?? []) as UsageByDeviceRow[];

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

  const monthlyKWhByDevice = new Map<string, number>();
  for (const row of monthlyUsageRows) {
    monthlyKWhByDevice.set(row.device_id, Math.max(0, toNumber(row.usage_kwh)));
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
      name: device.device_name,
      watts: currentWatts,
      volts: currentVolts,
      amps: currentAmps,
      dailyKWh: dailyKWhByDevice.get(device.id) ?? 0,
      isOnline: hasFreshTelemetry,
      isActive: hasFreshTelemetry && currentWatts > 0,
      icon: getDeviceIcon(device.appliance_type, device.device_name),
      relayState: device.relay_state !== false,
    };
  });

  const totalWatts = devices.reduce((sum, d) => sum + d.watts, 0);
  const onlineDeviceCount = devices.filter((device) => device.isOnline).length;

  const totalDailyKWh = devices.reduce((sum, d) => sum + d.dailyKWh, 0);
  const totalDailyCostPhp = computeMeralcoBill(
    totalDailyKWh,
    activeRates.rates,
    activeRates.vatRate
  );

  const totalYesterdayKWh = yesterdayUsageRows.reduce(
    (sum, row) => sum + Math.max(0, toNumber(row.usage_kwh)),
    0
  );
  const totalYesterdayCostPhp = computeMeralcoBill(
    totalYesterdayKWh,
    activeRates.rates,
    activeRates.vatRate
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

  const monthlyBudget = toNumber(profileData?.monthly_budget_php ?? 2000);
  const safeMonthlyBudget = monthlyBudget > 0 ? monthlyBudget : 1;
  const totalMonthlyKWh = Array.from(monthlyKWhByDevice.values()).reduce(
    (sum, usageKwh) => sum + usageKwh,
    0
  );
  const homeMonthlyVariableSpendPhp = computeMeralcoBill(
    totalMonthlyKWh,
    activeRates.rates,
    activeRates.vatRate
  );
  const homeMonthlyEstimatedBillPhp = computeMeralcoBill(
    totalMonthlyKWh,
    activeRates.rates,
    activeRates.vatRate,
    {
      fixedChargesPhp: activeRates.fixedMonthlyChargesPhp,
    }
  );
  const homeBurnPercent = Math.min(
    (homeMonthlyEstimatedBillPhp / safeMonthlyBudget) * 100,
    100
  );
  const homeBurnColor =
    homeBurnPercent >= 90
      ? "bg-danger"
      : homeBurnPercent >= 70
        ? "bg-naku"
        : "bg-mint";

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
        {/* ===== Total Live Wattage Card ===== */}
        <div className="relative rounded-xl bg-surface border border-white/5 p-5 overflow-hidden">
          {/* Mint left accent */}
          <div className="absolute left-0 inset-y-0 w-1 bg-mint/60 rounded-r-full" />
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-white/50 uppercase mb-1">
              Total Live Wattage
            </p>
            <p className="text-5xl font-bold tracking-tight text-white">
              {totalWatts.toLocaleString()}
              <span className="text-lg font-medium text-white/50 ml-1">
                W
              </span>
            </p>
            <div className="mt-2 text-bida text-sm">
              <span className="font-medium">{onlineDeviceCount} device(s) online live</span>
            </div>
          </div>
        </div>

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
              Monthly Cycle
            </span>
          </div>

          <HomeBudgetEditor initialBudget={monthlyBudget} />

          <div className="mb-1.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40">Home Burn Rate</span>
              <span className="text-xs text-white/50">
                ₱ {homeMonthlyEstimatedBillPhp.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} est. bill (incl fixed fees)
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${homeBurnColor}`}
                style={{ width: `${homeBurnPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-white/40 mt-1.5">
              Variable energy spend: ₱ {homeMonthlyVariableSpendPhp.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (excludes fixed monthly fees)
            </p>
            <p
              className={`text-[10px] font-semibold tracking-wider mt-1.5 text-right uppercase ${
                homeBurnPercent >= 90
                  ? "text-danger"
                  : homeBurnPercent >= 70
                    ? "text-naku"
                    : "text-bida"
              }`}
            >
              {homeBurnPercent.toFixed(1)}% of home budget consumed
            </p>
          </div>
        </div>

        {/* ===== AI Tip Banner ===== */}
        <Link
          href="/insights"
          className="flex items-center gap-3 rounded-xl bg-mint/10 border border-mint/20 px-4 py-3 group transition-colors hover:bg-mint/15"
        >
          <div className="w-9 h-9 flex items-center justify-center shrink-0">
            <img src="/wattwise_mascot.png" alt="Bubolt" className="w-5 h-5 object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold tracking-wider text-mint/70 uppercase">
              Bubolt Tip
            </p>
            <p className="text-sm text-white/80 leading-snug truncate">
              &ldquo;{MOCK_AI_TIP}&rdquo;
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-mint/50 group-hover:text-mint transition-colors shrink-0" />
        </Link>

        {/* ===== Connected Units ===== */}
        <section className="mt-2">
          <h2 className="text-[11px] font-semibold tracking-widest text-white/50 uppercase mb-3">
            Connected Units
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {devices.map((device) => {
              const Icon = device.icon;
              return (
                <Link
                  key={device.id}
                  href={`/dashboard/${device.id}`}
                  className="relative rounded-xl bg-surface border border-white/5 p-4 flex flex-col justify-between min-h-[130px] transition-colors hover:border-mint/20 overflow-hidden"
                >
                  {/* Mint left accent */}
                  <div className="absolute left-0 inset-y-0 w-1 bg-mint/50 rounded-r-full" />
                  <div className="flex items-start justify-between">
                    <div className="w-8 h-8 rounded-lg bg-mint/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-mint" />
                    </div>
                    <RelayToggle
                      deviceId={device.id}
                      initialRelayState={device.relayState}
                      variant="compact"
                    />
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-semibold leading-tight mb-1 line-clamp-2">
                      {device.name}
                    </p>
                    <div className="text-[11px]">
                      <p
                        className={device.isOnline ? "text-bida" : "text-white/40"}
                      >
                        {device.isOnline ? "Online" : "Offline"}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}

            {/* Add Appliance Tile */}
            <AddApplianceTile />
          </div>
        </section>

      </div>

      {/* ===== Bottom Navigation ===== */}
      <BottomNav />
    </div>
  );
}
