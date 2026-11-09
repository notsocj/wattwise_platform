import Link from "next/link";
import { startQuery } from "@/lib/start-query";
import { getSessionUser } from "@/lib/auth-context";
import { CARD, CardHeader, CardPill } from "@/components/ui/Card";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Wallet,
  Power,
} from "@/components/ui/icons";
import { isFreshReading } from "@/lib/device-telemetry";
import { fetchOwnedDeviceById } from "@/lib/dashboard-data";
import { createClient } from "@/lib/supabase/server";
import {
  computeHistoricalVariableSpendByDeviceFromDayRows,
  computeFixedChargesWithVat,
} from "@/lib/meralco-rates";
import { getActiveMeralcoRates, getMeralcoRatesForRange } from "@/lib/meralco-rates-server";
import RealtimeRefreshBridge from "@/components/realtime/RealtimeRefreshBridge";
import RelayToggle from "@/components/ui/RelayToggle";
import DeviceAutomationsCard, { type DeviceAutomationRow } from "@/components/dashboard/DeviceAutomationsCard";
import DeviceSettingsCard from "@/components/dashboard/DeviceSettingsCard";
import TelemetryFreshnessBadge from "@/components/dashboard/TelemetryFreshnessBadge";
import CircularGauge from "@/components/dashboard/CircularGauge";
import RestorePowerButton from "@/components/ui/RestorePowerButton";
import TipidTipCard from "@/components/insights/TipidTipCard";
import { getCurrentBillingCycle, getManilaDayKey } from "@/lib/date-utils";
import { getBudgetProgressPercent, getBudgetToneClasses } from "@/lib/budget-policy";

type ProfileRow = {
  monthly_budget_php: number | string | null;
  billing_cycle_start_day: number | null;
  role: string | null;
};

type EnergyLogRow = {
  energy_kwh: number | string;
  average_watts: number | string | null;
  voltage_v: number | string | null;
  current_a: number | string | null;
  recorded_at: string | null;
};

type LegacyEnergyLogRow = {
  energy_kwh: number | string;
  average_watts: number | string | null;
  recorded_at: string | null;
};

type UsageByDeviceRow = {
  device_id: string;
  usage_kwh: number | string;
  day_key: string;
};

type UsagePeriodRow = {
  period_key: "hour" | "day" | "week" | "month";
  usage_kwh: number | string;
};

type DeviceMonthUsageRow = {
  variable_spend_php: number | string;
};

type DeviceViewModel = {
  id: string;
  name: string;
  deviceCode: string;
  watts: number;
  isOnline: boolean;
  isActive: boolean;
  maxWatts: number;
  volts: number;
  maxVolts: number;
  amps: number;
  maxAmps: number;
  monthlyBudget: number;
  variableSpendPhp: number;
  estimatedBillPhp: number;
  fixedFeeSharePhp: number;
};

function toNumber(value: number | string | null): number {
  if (value === null) {
    return 0;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function toFiniteNumber(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export default async function DeviceDetailPage(props: {
  params: Promise<{ deviceId: string }>;
}) {
  const { deviceId } = await props.params;

  const supabase = await createClient();

  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const now = new Date();

  const profilePromise = startQuery(
    supabase
      .from("profiles")
      .select("monthly_budget_php, billing_cycle_start_day, role")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>()
  );
  // The middleware forwards the role, so the device lookup need not wait for
  // the profile; fall back to the profile's role if it is missing.
  const role = user.role ?? (await profilePromise).data?.role ?? null;
  const isTenant = role === "tenant";
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

  const [{ data: profileData }, activeRates, deviceData, devicesCountRes] = await Promise.all([
    profilePromise,
    getActiveMeralcoRates(supabase),
    fetchOwnedDeviceById(supabase, user.id, deviceId, role),
    supabase
      .from("devices")
      .select("id", { count: "exact", head: true })
      .or(
        isTenant
          ? `tenant_id.eq.${user.id}`
          : `owner_id.eq.${user.id},user_id.eq.${user.id}`
      ),
  ]);

  if (!deviceData) {
    redirect("/dashboard");
  }

  let billingCycleStartDay = profileData?.billing_cycle_start_day ?? 1;
  if (isTenant && deviceData.owner_id) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("billing_cycle_start_day")
      .eq("id", deviceData.owner_id)
      .maybeSingle<{ billing_cycle_start_day: number | null }>();
    billingCycleStartDay = ownerProfile?.billing_cycle_start_day ?? billingCycleStartDay;
  }

  const billingCycle = getCurrentBillingCycle(billingCycleStartDay, now);

  const [rateRows, usageByDeviceDayRes, usagePeriodsRes, monthUsageRes, latestTelemetryResult, automationsRes] = await Promise.all([
    getMeralcoRatesForRange(supabase, billingCycle.startDate, now),
    forwardedCycleUsagePromise &&
    forwardedCycle?.startDate.getTime() === billingCycle.startDate.getTime()
      ? forwardedCycleUsagePromise
      : supabase.rpc("get_usage_kwh_by_device_day", {
          p_user_id: user.id,
          p_start: billingCycle.startDate.toISOString(),
          p_end: now.toISOString(),
        }),
    supabase.rpc("get_device_usage_periods", {
      p_user_id: user.id,
      p_device_id: deviceData.id,
      p_now: now.toISOString(),
    }),
    supabase
      .from("device_month_usage")
      .select("variable_spend_php")
      .eq("device_id", deviceData.id)
      .eq("month_start", getManilaDayKey(billingCycle.startDate))
      .maybeSingle<DeviceMonthUsageRow>(),
    supabase
      .from("energy_logs")
      .select("energy_kwh, average_watts, voltage_v, current_a, recorded_at")
      .in("device_id", [deviceData.id, deviceData.mac_address])
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle<EnergyLogRow>(),
    // Scheduled turn-offs: active ones plus those that ended in the last day.
    isTenant
      ? Promise.resolve({ data: [] as DeviceAutomationRow[] })
      : supabase
          .from("device_automations")
          .select("id,trigger_type,run_at,threshold,ends_at,status,consumed_kwh,consumed_php,executed_at,ended_at")
          .eq("device_id", deviceData.id)
          .or(`status.eq.active,ended_at.gte.${new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()}`)
          .order("created_at", { ascending: false })
          .limit(6)
          .returns<DeviceAutomationRow[]>(),
  ]);

  let latestLog: EnergyLogRow | null = null;

  if (latestTelemetryResult.error) {
    const { data: legacyLogData } = await supabase
      .from("energy_logs")
      .select("energy_kwh, average_watts, recorded_at")
      .in("device_id", [deviceData.id, deviceData.mac_address])
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle<LegacyEnergyLogRow>();

    latestLog = legacyLogData
      ? {
          ...legacyLogData,
          voltage_v: null,
          current_a: null,
        }
      : null;
  } else {
    latestLog = latestTelemetryResult.data ?? null;
  }

  const hasFreshTelemetry = isFreshReading(latestLog?.recorded_at ?? null);

  const watts = hasFreshTelemetry
    ? Math.round(toNumber(latestLog?.average_watts ?? 0))
    : 0;
  const voltageReading = hasFreshTelemetry
    ? toFiniteNumber(latestLog?.voltage_v ?? null)
    : null;
  const currentReading = hasFreshTelemetry
    ? toFiniteNumber(latestLog?.current_a ?? null)
    : null;
  const volts = hasFreshTelemetry
    ? Math.round(Math.max(0, voltageReading ?? 230))
    : 0;
  const amps = hasFreshTelemetry
    ? Number(
        Math.max(0, currentReading ?? (volts > 0 ? watts / volts : 0)).toFixed(1)
      )
    : 0;
  const monthlyBudget =
    toNumber(deviceData.user_approved_limit_php) ||
    toNumber(profileData?.monthly_budget_php ?? 2000);
  const usageByDeviceRows = (usageByDeviceDayRes.data ?? []) as UsageByDeviceRow[];
  const deviceCount = Math.max(1, devicesCountRes.count ?? 1);
  const cycleKWhByDevice = new Map<string, number>();
  for (const row of usageByDeviceRows) {
    cycleKWhByDevice.set(
      row.device_id,
      (cycleKWhByDevice.get(row.device_id) ?? 0) + Math.max(0, toNumber(row.usage_kwh))
    );
  }
  const billingCycleKWh = Math.max(0, cycleKWhByDevice.get(deviceData.id) ?? 0);
  const periodUsage = new Map<string, number>();
  for (const row of (usagePeriodsRes.data ?? []) as UsagePeriodRow[]) {
    periodUsage.set(row.period_key, Math.max(0, toNumber(row.usage_kwh)));
  }
  const usageSummary = [
    { label: "This hour", value: periodUsage.get("hour") ?? 0 },
    { label: "Today", value: periodUsage.get("day") ?? 0 },
    { label: "This week", value: periodUsage.get("week") ?? 0 },
    { label: "This month", value: periodUsage.get("month") ?? 0 },
    { label: "Billing cycle", value: billingCycleKWh },
  ];

  const totalBillingCycleKWhAcrossHome = Array.from(cycleKWhByDevice.values()).reduce(
    (sum, usageKwh) => sum + Math.max(0, usageKwh),
    0
  );

  const fixedFeeSharePhp = totalBillingCycleKWhAcrossHome > 0
    ? activeRates.fixedMonthlyChargesPhp * (billingCycleKWh / totalBillingCycleKWhAcrossHome)
    : activeRates.fixedMonthlyChargesPhp / deviceCount;

  const variableSpendByDevice = computeHistoricalVariableSpendByDeviceFromDayRows(
    usageByDeviceRows,
    rateRows
  );
  const variableSpendPhp = monthUsageRes.data
    ? Math.max(0, toNumber(monthUsageRes.data.variable_spend_php))
    : variableSpendByDevice.get(deviceData.id) ?? 0;

  const estimatedBillPhp =
    variableSpendPhp + computeFixedChargesWithVat(fixedFeeSharePhp, activeRates.vatRate);

  const device: DeviceViewModel = {
    id: deviceData.id,
    name: deviceData.device_name,
    deviceCode: `WW-${deviceData.id.slice(0, 8).toUpperCase()}`,
    watts,
    isOnline: hasFreshTelemetry,
    isActive: hasFreshTelemetry && watts > 0,
    maxWatts: 2000,
    volts,
    maxVolts: 260,
    amps,
    maxAmps: 30,
    monthlyBudget,
    variableSpendPhp,
    estimatedBillPhp,
    fixedFeeSharePhp,
  };

  const safeMonthlyBudget = device.monthlyBudget > 0 ? device.monthlyBudget : 1;

  const burnPercent = getBudgetProgressPercent(
    device.variableSpendPhp,
    safeMonthlyBudget
  );
  const burnTone = getBudgetToneClasses(burnPercent);

  return (
    <div className="min-h-screen bg-canvas lg:min-h-0 text-fg pb-8">
      <RealtimeRefreshBridge deviceKeys={[deviceData.id, deviceData.mac_address]} />

      {/* ===== Header ===== */}
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 lg:ww-enter lg:pb-8 lg:pt-10">
        <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-fg/[0.06] bg-fg/[0.03] text-fg/70 transition-colors hover:text-accent lg:hidden"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          {/* Desktop: breadcrumb back to Home instead of a back button. */}
          <nav aria-label="Breadcrumb" className="mb-2 hidden items-center gap-1.5 text-sm text-fg/45 lg:flex">
            <Link href="/dashboard" className="transition-colors hover:text-fg">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span aria-current="page" className="truncate text-fg/70">{device.name}</span>
          </nav>
          <h1 className="text-lg font-bold leading-tight tracking-tight lg:text-[32px] lg:font-semibold lg:tracking-tighter">
            {device.name}
          </h1>
          <p className="text-[11px] text-fg/60 lg:mt-1.5 lg:text-sm">
            Device ID: {device.deviceCode} • <span className={`inline-flex items-center gap-1 ${deviceData.relay_state !== false ? "text-accent" : "text-fg/60"}`}>
              <Power className={`w-3 h-3 ${deviceData.relay_state !== false ? "text-accent" : "text-fg/50"}`} />
              {deviceData.relay_state !== false ? "ON" : "OFF"}
            </span>{" "}
            • <TelemetryFreshnessBadge recordedAt={latestLog?.recorded_at ?? null} />
          </p>
        </div>
        </div>
      </header>

      <div className="ww-stagger px-5 pb-8 flex min-h-[calc(100vh-88px)] flex-col gap-5 lg:grid lg:min-h-0 lg:grid-cols-12 lg:items-start">
        <div className="empty:hidden lg:col-span-12">
          <TipidTipCard />
        </div>

        {/* ===== Metrology Gauges ===== */}
        <section className="grid flex-1 grid-cols-3 items-center rounded-2xl border border-fg/[0.06] bg-surface px-2 py-8 lg:col-span-12 xl:col-span-7 xl:row-span-2 lg:self-stretch lg:px-6">
          <CircularGauge
            value={device.watts}
            max={device.maxWatts}
            label="Power"
            unit="WATTS"
          />
          <CircularGauge
            value={device.volts}
            max={device.maxVolts}
            label="Voltage"
            unit="VOLTS"
          />
          <CircularGauge
            value={device.amps}
            max={device.maxAmps}
            label="Current"
            unit="AMPS"
          />
        </section>

        <section className={`${CARD} p-5 lg:order-last lg:col-span-12 lg:p-6`}>
          <CardHeader icon={Activity} title="Actual kWh usage" aside={<CardPill>Metered</CardPill>} />
          <p className="mb-4 mt-2 text-xs text-fg/45">Derived from positive changes in this appliance&apos;s cumulative PZEM meter reading.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {usageSummary.map((period) => (
              <div key={period.label} className="rounded-xl border border-fg/[0.05] bg-fg/[0.02] px-3 py-3">
                <p className="text-xs font-medium text-fg/45">{period.label}</p>
                <p className="mt-1 text-lg font-bold text-fg">{period.value.toFixed(3)} <span className="text-xs font-medium text-accent/75">kWh</span></p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== Power Control (Relay) ===== */}
        {isTenant ? null : (
          <div className="flex flex-col gap-5 lg:col-span-6 xl:col-span-5">
            {deviceData.budget_status === "auto_cutoff" ? (
              <RestorePowerButton deviceId={device.id} />
            ) : null}
            <RelayToggle
              deviceId={device.id}
              initialRelayState={deviceData.relay_state !== false}
              variant="full"
            />
            <DeviceAutomationsCard deviceId={device.id} rows={automationsRes.data ?? []} />
            <DeviceSettingsCard
              deviceId={device.id}
              name={deviceData.device_name}
              applianceType={deviceData.appliance_type}
              applianceDetail={deviceData.appliance_detail}
              macAddress={deviceData.mac_address}
            />
          </div>
        )}

        {/* ===== Appliance Burn Rate ===== */}
        <section className={`${CARD} p-5 lg:col-span-6 lg:p-6 xl:col-span-5`}>
          <div className="mb-4">
            <CardHeader icon={Wallet} title="Billing cycle" aside={<CardPill>Device limit</CardPill>} />
          </div>

          {/* Budget row */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-fg/70">Smart Control Limit</span>
            <span className="text-lg font-bold">
              <span className="text-fg/50 text-sm mr-0.5">₱</span>
              {device.monthlyBudget.toLocaleString()}
            </span>
          </div>

          {/* Burn rate */}
          <div className="mb-1.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-fg/40">
                Smart Control variable spend
              </span>
              <span className="text-xs text-fg/50">
                ₱ {device.variableSpendPhp.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} this billing cycle
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-fg/[0.06]">
              <div
                className={`h-full origin-left rounded-full transition-[width,scale] duration-700 ease-out starting:scale-x-0 ${burnTone.bar}`}
                style={{ width: `${Math.min(burnPercent, 100)}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-fg/40">
              Variable spend: ₱ {device.variableSpendPhp.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Fixed-fee share: ₱ {device.fixedFeeSharePhp.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className={`mt-2 text-right text-xs font-semibold ${burnTone.text}`}>
              {burnPercent.toFixed(1)}% of budget used
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
