import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Wallet,
  Power,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  computeHistoricalVariableSpendByDeviceFromDayRows,
  getActiveMeralcoRates,
  getMeralcoRatesForRange,
} from "@/lib/meralco-rates";
import RealtimeRefreshBridge from "@/components/realtime/RealtimeRefreshBridge";
import RelayToggle from "@/components/ui/RelayToggle";
import TipidTipCard from "@/components/insights/TipidTipCard";
import { getCurrentBillingCycle } from "@/lib/date-utils";

type DeviceRow = {
  id: string;
  device_name: string;
  mac_address: string;
  relay_state: boolean | null;
  owner_id: string | null;
  tenant_id: string | null;
  user_approved_limit_php: number | string | null;
};

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

const ACTIVE_READING_WINDOW_MS = 20 * 1000; // 4 missed 5-second hardware cycles before offline

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

async function fetchOwnedDeviceById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  deviceId: string,
  role: string | null | undefined
): Promise<DeviceRow | null> {
  const accessFilter =
    role === "tenant"
      ? `tenant_id.eq.${userId}`
      : `owner_id.eq.${userId},user_id.eq.${userId}`;
  const withRelayState = await supabase
    .from("devices")
    .select("id, device_name, mac_address, relay_state, owner_id, tenant_id, user_approved_limit_php")
    .eq("id", deviceId)
    .or(accessFilter)
    .maybeSingle<DeviceRow>();

  if (!withRelayState.error) {
    return withRelayState.data ?? null;
  }

  if (!hasMissingRelayStateColumnError(withRelayState.error)) {
    return null;
  }

  const withoutRelayState = await supabase
    .from("devices")
    .select("id, device_name, mac_address, owner_id, tenant_id, user_approved_limit_php")
    .eq("id", deviceId)
    .or(accessFilter)
    .maybeSingle<Omit<DeviceRow, "relay_state">>();

  if (withoutRelayState.error || !withoutRelayState.data) {
    return null;
  }

  return {
    ...withoutRelayState.data,
    relay_state: true,
  };
}

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

// --- Circular gauge component ---
function CircularGauge({
  value,
  max,
  label,
  unit,
  color = "#00E66F",
}: {
  value: number;
  max: number;
  label: string;
  unit: string;
  color?: string;
}) {
  const radius = 42;
  const stroke = 6;
  const center = 50;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center px-1">
      <div className="relative aspect-square w-full max-w-[108px]">
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full -rotate-90"
        >
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
          {/* Progress */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              filter: `drop-shadow(0 0 6px ${color}60)`,
              transition: "stroke-dashoffset 0.6s ease",
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold leading-none">{value}</span>
          <span className="mt-1 text-[11px] font-medium text-mint/70">
            {unit}
          </span>
        </div>
      </div>
      <span className="mt-2.5 text-[11px] font-semibold tracking-wider text-white/40 uppercase">
        {label}
      </span>
    </div>
  );
}

export default async function DeviceDetailPage(props: {
  params: Promise<{ deviceId: string }>;
}) {
  const { deviceId } = await props.params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const now = new Date();

  const [{ data: profileData }, activeRates] = await Promise.all([
    supabase
      .from("profiles")
      .select("monthly_budget_php, billing_cycle_start_day, role")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>(),
    getActiveMeralcoRates(supabase),
  ]);
  const isTenant = profileData?.role === "tenant";
  const [deviceData, devicesCountRes] = await Promise.all([
    fetchOwnedDeviceById(supabase, user.id, deviceId, profileData?.role),
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

  const [rateRows, usageByDeviceDayRes, usagePeriodsRes] = await Promise.all([
    getMeralcoRatesForRange(supabase, billingCycle.startDate, now),
    supabase.rpc("get_usage_kwh_by_device_day", {
      p_user_id: user.id,
      p_start: billingCycle.startDate.toISOString(),
      p_end: now.toISOString(),
    }),
    supabase.rpc("get_device_usage_periods", {
      p_user_id: user.id,
      p_device_id: deviceData.id,
      p_now: now.toISOString(),
    }),
  ]);

  const latestTelemetryResult = await supabase
    .from("energy_logs")
    .select("energy_kwh, average_watts, voltage_v, current_a, recorded_at")
    .in("device_id", [deviceData.id, deviceData.mac_address])
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle<EnergyLogRow>();

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
  const monthlyBudget = isTenant
    ? toNumber(deviceData.user_approved_limit_php) || toNumber(profileData?.monthly_budget_php ?? 2000)
    : toNumber(profileData?.monthly_budget_php ?? 2000);
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
  const variableSpendPhp = variableSpendByDevice.get(deviceData.id) ?? 0;

  const estimatedBillPhp =
    variableSpendPhp + fixedFeeSharePhp * (1 + activeRates.vatRate);

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

  const burnPercent = Math.min(
    (device.estimatedBillPhp / safeMonthlyBudget) * 100,
    100
  );
  const burnColor =
    burnPercent >= 90
      ? "bg-danger"
      : burnPercent >= 70
        ? "bg-naku"
        : "bg-mint";

  return (
    <div className="min-h-screen bg-base text-white pb-8">
      <RealtimeRefreshBridge deviceKeys={[deviceData.id, deviceData.mac_address]} />

      {/* ===== Header ===== */}
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <div>
          <h1 className="text-[15px] font-bold leading-tight">
            {device.name}
          </h1>
          <p className="text-[11px] text-white/60">
            Device ID: {device.deviceCode} • <span className={`inline-flex items-center gap-1 ${deviceData.relay_state !== false ? "text-mint" : "text-white/60"}`}>
              <Power className={`w-3 h-3 ${deviceData.relay_state !== false ? "text-mint" : "text-white/30"}`} />
              {deviceData.relay_state !== false ? "ON" : "OFF"}
            </span>
          </p>
        </div>
        </div>
      </header>

      <div className="px-5 pb-8 flex min-h-[calc(100vh-88px)] flex-col gap-5">
        <TipidTipCard />

        {/* ===== Metrology Gauges ===== */}
        <section className="grid flex-1 grid-cols-3 items-center rounded-2xl border border-white/[0.06] bg-white/[0.02] px-2 py-8">
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

        <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider">Actual kWh usage</h3>
            <span className="text-[10px] font-medium uppercase tracking-wider text-mint/70">Metered</span>
          </div>
          <p className="mb-4 text-xs text-white/45">Derived from positive changes in this appliance&apos;s cumulative PZEM meter reading.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {usageSummary.map((period) => (
              <div key={period.label} className="rounded-lg bg-black/15 px-3 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-white/40">{period.label}</p>
                <p className="mt-1 text-lg font-bold text-white">{period.value.toFixed(3)} <span className="text-xs font-medium text-mint/75">kWh</span></p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== Power Control (Relay) ===== */}
        {isTenant ? null : (
          <RelayToggle
            deviceId={device.id}
            initialRelayState={deviceData.relay_state !== false}
            variant="full"
          />
        )}

        {/* ===== Appliance Burn Rate ===== */}
        <section className="rounded-xl bg-white/[0.03] backdrop-blur border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-mint" />
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Appliance Billing Cycle
              </h3>
            </div>
            <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">
              Set Budget On Home
            </span>
          </div>

          {/* Budget row */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/70">Home Budget (View Only)</span>
            <span className="text-lg font-bold">
              <span className="text-white/50 text-sm mr-0.5">₱</span>
              {device.monthlyBudget.toLocaleString()}
            </span>
          </div>

          {/* Burn rate */}
          <div className="mb-1.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40">
                Estimated Appliance Bill
              </span>
              <span className="text-xs text-white/50">
                ₱ {device.estimatedBillPhp.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} this billing cycle
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${burnColor}`}
                style={{ width: `${burnPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-white/40 mt-1.5">
              Variable spend: ₱ {device.variableSpendPhp.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Fixed-fee share: ₱ {device.fixedFeeSharePhp.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p
              className={`text-[10px] font-semibold tracking-wider mt-1.5 text-right uppercase ${
                burnPercent >= 90
                  ? "text-danger"
                  : burnPercent >= 70
                    ? "text-naku"
                    : "text-bida"
              }`}
            >
              {burnPercent.toFixed(1)}% of budget consumed
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
