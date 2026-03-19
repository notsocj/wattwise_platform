"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  Power,
  Wifi,
  Cpu,
  Shield,
  Wallet,
  Zap,
} from "lucide-react";

// --- Mock data (will be replaced with Supabase Realtime + device queries) ---
const MOCK_DEVICE = {
  id: "dev-1",
  name: "Master Bedroom Aircon",
  deviceCode: "WW-AC-042",
  watts: 1250,
  maxWatts: 2000,
  volts: 230,
  maxVolts: 260,
  amps: 5.4,
  maxAmps: 30,
  monthlyBudget: 1500,
  currentSpend: 1242,
  relayOn: true,
  relayState: "30A ACTIVE",
  autoTripAmps: 20,
  surgeProtectionVolts: 250,
  wifiRssi: -42,
  boardTempC: 34.2,
};

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
  const radius = 38;
  const stroke = 5;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[96px] h-[96px]">
        <svg
          width="96"
          height="96"
          viewBox="0 0 96 96"
          className="-rotate-90"
        >
          {/* Track */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
          {/* Progress */}
          <circle
            cx="48"
            cy="48"
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
          <span className="text-xl font-bold leading-none">{value}</span>
          <span className="text-[10px] text-mint/70 font-medium mt-0.5">
            {unit}
          </span>
        </div>
      </div>
      <span className="text-[10px] font-semibold tracking-wider text-white/40 uppercase mt-2">
        {label}
      </span>
    </div>
  );
}

export default function DeviceDetailPage(_props: {
  params: Promise<{ deviceId: string }>;
}) {
  const router = useRouter();
  const [device, setDevice] = useState(MOCK_DEVICE);

  const burnPercent = Math.min(
    (device.currentSpend / device.monthlyBudget) * 100,
    100
  );
  const burnColor =
    burnPercent >= 90
      ? "bg-danger"
      : burnPercent >= 70
        ? "bg-naku"
        : "bg-mint";

  const toggleRelay = () => {
    setDevice((prev) => ({ ...prev, relayOn: !prev.relayOn }));
  };

  // Wi-Fi signal quality label
  const wifiLabel =
    device.wifiRssi >= -50
      ? "Excellent"
      : device.wifiRssi >= -70
        ? "Good"
        : "Weak";

  return (
    <div className="min-h-screen bg-base text-white pb-8">
      {/* ===== Header ===== */}
      <header className="flex items-center gap-3 px-5 pt-5 pb-4">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h1 className="text-[15px] font-bold leading-tight">
            {device.name}
          </h1>
          <p className="text-[11px] text-mint/70">
            Device ID: {device.deviceCode}
          </p>
        </div>
      </header>

      <div className="px-5 flex flex-col gap-5">
        {/* ===== AI Naku! Tip ===== */}
        <div className="flex items-start gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-mint/15 flex items-center justify-center shrink-0 mt-0.5">
            <Bot className="w-4 h-4 text-mint" />
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            <span className="text-naku font-bold">Naku!</span> This Aircon is
            nearing its ₱1,500 monthly limit. Consider increasing the thermostat
            by 2 degrees to save!
          </p>
        </div>

        {/* ===== Metrology Gauges ===== */}
        <div className="flex items-center justify-around py-2">
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
        </div>

        {/* ===== Device Wallet ===== */}
        <section className="rounded-xl bg-white/[0.03] backdrop-blur border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-mint" />
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Device Wallet
              </h3>
            </div>
            <span className="text-[10px] text-white/40 font-medium">
              Monthly Cycle
            </span>
          </div>

          {/* Budget row */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/70">Monthly Budget</span>
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

        {/* ===== Massive Relay Toggle ===== */}
        <section className="flex flex-col items-center py-4">
          <button
            onClick={toggleRelay}
            className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 ${
              device.relayOn
                ? "bg-mint/15 border-2 border-mint shadow-mint-glow"
                : "bg-white/[0.04] border-2 border-white/10"
            }`}
            aria-label={device.relayOn ? "Power off" : "Power on"}
          >
            <Power
              className={`w-10 h-10 transition-colors ${
                device.relayOn ? "text-mint" : "text-white/30"
              }`}
            />
          </button>
          <p
            className={`text-sm font-bold mt-3 uppercase tracking-wider ${
              device.relayOn ? "text-mint" : "text-white/30"
            }`}
          >
            Power {device.relayOn ? "On" : "Off"}
          </p>
          <p className="text-[10px] text-mint/50 font-medium mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-mint" />
            Relay State: {device.relayState}
          </p>
        </section>

        {/* ===== Safety Thresholds ===== */}
        <section className="rounded-xl bg-white/[0.03] backdrop-blur border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-mint" />
            <h3 className="text-sm font-bold uppercase tracking-wider">
              Safety Thresholds
            </h3>
          </div>

          {/* Auto-Trip (Overload) */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/70">
                Auto-Trip (Overload)
              </span>
              <span className="text-sm font-bold text-mint">
                {device.autoTripAmps.toFixed(1)} A
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              step={0.5}
              value={device.autoTripAmps}
              onChange={(e) =>
                setDevice((prev) => ({
                  ...prev,
                  autoTripAmps: parseFloat(e.target.value),
                }))
              }
              className="w-full h-1.5 rounded-full appearance-none bg-white/[0.06] accent-mint cursor-pointer"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-white/30">Safe: 5A</span>
              <span className="text-[10px] text-white/30">Critical: 30A</span>
            </div>
          </div>

          {/* Surge Protection */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Surge Protection</span>
              <span className="text-sm font-bold text-mint">
                {device.surgeProtectionVolts} V
              </span>
            </div>
          </div>
        </section>

        {/* ===== Diagnostics Footer ===== */}
        <section className="flex items-center justify-around py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-mint" />
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">
                Wi-Fi RSSI
              </p>
              <p className="text-sm font-bold">{device.wifiRssi} dBm</p>
              <p className="text-[10px] text-bida">({wifiLabel})</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-mint" />
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">
                Board Temp
              </p>
              <p className="text-sm font-bold">{device.boardTempC} °C</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
