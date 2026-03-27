import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  computeMeralcoBill,
  getActiveMeralcoRates,
} from "@/lib/meralco-rates";

type DeviceRow = {
  id: string;
  device_name: string;
};

type ProfileRow = {
  monthly_budget_php: number | string | null;
};

type EnergyLogRow = {
  energy_kwh: number | string;
  average_watts: number | string | null;
};

type DeviceViewModel = {
  id: string;
  name: string;
  deviceCode: string;
  watts: number;
  maxWatts: number;
  volts: number;
  maxVolts: number;
  amps: number;
  maxAmps: number;
  monthlyBudget: number;
  currentSpend: number;
};

function toNumber(value: number | string | null): number {
  if (value === null) {
    return 0;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
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

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const [{ data: deviceData }, { data: profileData }, { data: logsData }, activeRates] =
    await Promise.all([
      supabase
        .from("devices")
        .select("id, device_name")
        .eq("id", deviceId)
        .eq("user_id", user.id)
        .maybeSingle<DeviceRow>(),
      supabase
        .from("profiles")
        .select("monthly_budget_php")
        .eq("id", user.id)
        .maybeSingle<ProfileRow>(),
      supabase
        .from("energy_logs")
        .select("energy_kwh, average_watts")
        .eq("device_id", deviceId)
        .gte("recorded_at", startOfMonth.toISOString())
        .lte("recorded_at", endOfToday.toISOString())
        .order("recorded_at", { ascending: false })
        .limit(100),
      getActiveMeralcoRates(supabase),
    ]);

  if (!deviceData) {
    redirect("/dashboard");
  }

  const logs = (logsData ?? []) as EnergyLogRow[];
  const latestLog = logs[0];

  const watts = Math.round(toNumber(latestLog?.average_watts ?? 0));
  const volts = 230;
  const amps = Number((watts / volts).toFixed(1));
  const monthlyBudget = toNumber(profileData?.monthly_budget_php ?? 2000);
  const monthlyKWh = logs.reduce((sum, log) => sum + toNumber(log.energy_kwh), 0);
  const currentSpend = computeMeralcoBill(
    monthlyKWh,
    activeRates.rates,
    activeRates.vatRate
  );

  const device: DeviceViewModel = {
    id: deviceData.id,
    name: deviceData.device_name,
    deviceCode: `WW-${deviceData.id.slice(0, 8).toUpperCase()}`,
    watts,
    maxWatts: 2000,
    volts,
    maxVolts: 260,
    amps,
    maxAmps: 30,
    monthlyBudget,
    currentSpend,
  };

  const safeMonthlyBudget = device.monthlyBudget > 0 ? device.monthlyBudget : 1;

  const burnPercent = Math.min(
    (device.currentSpend / safeMonthlyBudget) * 100,
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
          <p className="text-[11px] text-mint/70">
            Device ID: {device.deviceCode}
          </p>
        </div>
        </div>
        {/* Logout intentionally omitted on Device Detail page */}
      </header>

      <div className="px-5 pb-8 flex min-h-[calc(100vh-88px)] flex-col gap-5">
        {/* ===== AI Naku! Tip ===== */}
        <div className="flex items-start gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-mint/15 flex items-center justify-center shrink-0 mt-0.5">
            <Bot className="w-4 h-4 text-mint" />
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            <span className="text-naku font-bold">Naku!</span> This unit is
            currently at ₱{device.currentSpend.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {" "}out of a ₱{device.monthlyBudget.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {" "}home monthly budget.
          </p>
        </div>

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

        {/* ===== Appliance Burn Rate ===== */}
        <section className="rounded-xl bg-white/[0.03] backdrop-blur border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-mint" />
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Appliance Burn Rate
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
                Burn Rate (Real-time)
              </span>
              <span className="text-xs text-white/50">
                ₱ {device.currentSpend.toLocaleString()} used
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${burnColor}`}
                style={{ width: `${burnPercent}%` }}
              />
            </div>
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
