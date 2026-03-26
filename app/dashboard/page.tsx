"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Zap,
  TrendingDown,
  TrendingUp,
  Activity,
  Bot,
  ChevronRight,
  Plus,
  Power,
  Wind,
  Tv,
  Refrigerator,
} from "lucide-react";
import BottomNav from "@/components/ui/BottomNav";
import { computeMeralcoBill } from "@/lib/meralco-rates";

// --- Mock data (will be replaced with Supabase Realtime in Phase 1) ---
const MOCK_DEVICES = [
  {
    id: "dev-1",
    name: "Master Bedroom Aircon",
    watts: 850,
    dailyKWh: 8.4,
    isOnline: true,
    relayOn: true,
    icon: Wind,
  },
  {
    id: "dev-2",
    name: "Kitchen Fridge",
    watts: 120,
    dailyKWh: 2.2,
    isOnline: true,
    relayOn: true,
    icon: Refrigerator,
  },
  {
    id: "dev-3",
    name: "Entertainment Hub",
    watts: 280,
    dailyKWh: 3.1,
    isOnline: true,
    relayOn: true,
    icon: Tv,
  },
];

const MOCK_AI_TIP = 'Overall usage is 10% lower today, Bida!';

// --- Slide-to-confirm threshold in pixels ---
const SLIDE_THRESHOLD = 200;

export default function DashboardPage() {
  const [devices, setDevices] = useState(MOCK_DEVICES);
  const [slideX, setSlideX] = useState(0);
  const [isSlidingActive, setIsSlidingActive] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);

  const totalWatts = devices.reduce((sum, d) => sum + (d.relayOn ? d.watts : 0), 0);

  const totalDailyKWh = devices.reduce(
    (sum, d) => sum + (d.relayOn ? d.dailyKWh : 0),
    0
  );
  const totalDailyCostPhp = computeMeralcoBill(totalDailyKWh);

  // --- Relay toggle (optimistic, mock) ---
  const toggleRelay = useCallback((deviceId: string) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId ? { ...d, relayOn: !d.relayOn } : d
      )
    );
  }, []);

  // --- Slide-to-power-off gesture handlers ---
  const handleSlideStart = useCallback((clientX: number) => {
    startXRef.current = clientX;
    setIsSlidingActive(true);
  }, []);

  const handleSlideMove = useCallback(
    (clientX: number) => {
      if (!isSlidingActive) return;
      const delta = Math.max(0, clientX - startXRef.current);
      setSlideX(Math.min(delta, SLIDE_THRESHOLD));
    },
    [isSlidingActive]
  );

  const handleSlideEnd = useCallback(() => {
    if (slideX >= SLIDE_THRESHOLD) {
      // Power off all devices
      setDevices((prev) => prev.map((d) => ({ ...d, relayOn: false })));
    }
    setSlideX(0);
    setIsSlidingActive(false);
  }, [slideX]);

  return (
    <div className="min-h-screen bg-base text-white pb-24">
      {/* ===== Header ===== */}
      <header className="flex items-center gap-2 px-5 pt-5 pb-4">
        <Zap className="w-5 h-5 text-mint fill-mint" />
        <h1 className="text-lg font-bold tracking-tight">
          Watt<span className="text-mint">Wise</span>
        </h1>
      </header>

      <div className="px-5 flex flex-col gap-4">
        {/* ===== Total Live Wattage Card ===== */}
        <div className="relative rounded-xl bg-surface border border-white/5 p-5 overflow-hidden">
          {/* Mint left accent */}
          <div className="absolute left-0 inset-y-0 w-1 bg-mint/60 rounded-r-full" />
          <div className="flex items-start justify-between">
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
              <div className="flex items-center gap-1.5 mt-2 text-bida text-sm">
                <TrendingDown className="w-3.5 h-3.5" />
                <span className="font-medium">5% lower than usual</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
              <Activity className="w-5 h-5 text-mint" />
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
          <div className="flex items-center gap-1.5 mt-2 text-naku text-sm">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="font-medium">2% increase from yesterday</span>
          </div>
        </div>

        {/* ===== AI Tip Banner ===== */}
        <Link
          href="/insights"
          className="flex items-center gap-3 rounded-xl bg-mint/10 border border-mint/20 px-4 py-3 group transition-colors hover:bg-mint/15"
        >
          <div className="w-9 h-9 rounded-full bg-mint/20 flex items-center justify-center shrink-0">
            <Bot className="w-4.5 h-4.5 text-mint" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold tracking-wider text-mint/70 uppercase">
              Wattbot Tip
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
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-semibold leading-tight mb-1 line-clamp-2">
                      {device.name}
                    </p>
                    <p className="text-xs text-white/50">
                      {device.relayOn ? `${device.watts}W active` : "Off"}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleRelay(device.id);
                      }}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        device.relayOn ? "bg-mint" : "bg-white/10"
                      }`}
                      aria-label={`Toggle ${device.name} relay`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                          device.relayOn ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </Link>
              );
            })}

            {/* Add Appliance Tile */}
            <button className="rounded-xl border border-dashed border-white/10 p-4 flex flex-col items-center justify-center min-h-[130px] text-white/30 hover:text-white/50 hover:border-white/20 transition-colors">
              <div className="w-10 h-10 rounded-xl border border-dashed border-current flex items-center justify-center mb-2">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider">
                Add Appliance
              </span>
            </button>
          </div>
        </section>

        {/* ===== Slide to Power Off All ===== */}
        <div className="mt-4 mb-2">
          <div
            ref={slideRef}
            className="relative w-full h-14 rounded-2xl bg-danger/10 border border-danger/20 overflow-hidden select-none touch-none"
            onMouseDown={(e) => handleSlideStart(e.clientX)}
            onMouseMove={(e) => handleSlideMove(e.clientX)}
            onMouseUp={handleSlideEnd}
            onMouseLeave={() => {
              if (isSlidingActive) handleSlideEnd();
            }}
            onTouchStart={(e) =>
              handleSlideStart(e.touches[0].clientX)
            }
            onTouchMove={(e) =>
              handleSlideMove(e.touches[0].clientX)
            }
            onTouchEnd={handleSlideEnd}
          >
            {/* Track label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-xs font-bold tracking-widest text-danger/70 uppercase">
                Slide to Power Off All
              </span>
            </div>
            {/* Slider thumb */}
            <div
              className="absolute top-1.5 left-1.5 w-11 h-11 rounded-xl bg-danger flex items-center justify-center transition-shadow"
              style={{
                transform: `translateX(${slideX}px)`,
                boxShadow:
                  slideX > 0
                    ? "0 0 20px rgba(239, 68, 68, 0.5)"
                    : "none",
              }}
            >
              <Power className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* ===== Bottom Navigation ===== */}
      <BottomNav />
    </div>
  );
}
