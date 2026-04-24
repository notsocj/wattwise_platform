"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import {
  X,
  QrCode,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Camera,
  Refrigerator,
  Wind,
  Tv,
  HelpCircle,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AddApplianceModalProps {
  onClose: () => void;
  onSuccess: (deviceName: string) => void;
}

type ApplianceType = "refrigerator" | "aircon" | "tv" | "other";

type AiRecommendation = {
  message: string;
  estimated_monthly_kwh: number;
  estimated_monthly_cost: number;
  suggested_budget: number;
};

const APPLIANCE_OPTIONS: {
  type: ApplianceType;
  label: string;
  icon: typeof Refrigerator;
}[] = [
  { type: "refrigerator", label: "Fridge", icon: Refrigerator },
  { type: "aircon", label: "Aircon", icon: Wind },
  { type: "tv", label: "TV", icon: Tv },
  { type: "other", label: "Other", icon: HelpCircle },
];

// Accepts colon-separated (E0:72:A1:D5:0B:68) or hyphen-separated formats
const MAC_REGEX = /^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/;
const MAC_IN_TEXT = /([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}/;

// ─── QR Scanner view (mounts/unmounts html5-qrcode on demand) ─────────────────
function QrScannerView({
  onScan,
  onCancel,
}: {
  onScan: (mac: string) => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);

  // Stable ref so the scanner callback never holds a stale closure
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let stopped = false;

    async function startScanner() {
      // Dynamic import — html5-qrcode accesses browser globals at module level
      const { Html5Qrcode } = await import("html5-qrcode");
      if (stopped || !containerRef.current) return;

      const qr = new Html5Qrcode("ww-qr-box");
      scannerRef.current = qr;

      try {
        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            const match = decodedText.match(MAC_IN_TEXT);
            if (match) {
              qr.stop().catch(() => {});
              onScanRef.current(match[0].toUpperCase());
            }
          },
          undefined
        );
        if (!stopped) setIsStarting(false);
      } catch (err) {
        if (!stopped) {
          setCameraError(
            err instanceof Error
              ? err.message
              : "Camera access denied. Please allow camera permissions."
          );
          setIsStarting(false);
        }
      }
    }

    startScanner();

    return () => {
      stopped = true;
      const qrInstance = scannerRef.current;
      scannerRef.current = null;
      if (qrInstance) {
        qrInstance
          .stop()
          .catch(() => {})
          .finally(() => {
            qrInstance.clear();
          });
      }
    };
  }, []);

  return (
    <div className="flex flex-col">
      {/* Scanner header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-sm font-bold text-gray-900 tracking-tight">
            Scan QR Code
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Point camera at the device QR label
          </p>
        </div>
      </div>

      {/* Camera viewport */}
      <div className="px-5 pt-5 pb-5">
        {cameraError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-red-50 border border-red-200 p-6 text-center">
            <Camera className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-600 font-medium">{cameraError}</p>
            <button
              type="button"
              onClick={onCancel}
              className="text-sm font-semibold text-gray-600 underline"
            >
              Enter MAC manually instead
            </button>
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden bg-black">
            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10 aspect-square">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            )}
            {/* html5-qrcode mounts its <video> element here */}
            <div
              id="ww-qr-box"
              ref={containerRef}
              className="w-full aspect-square"
            />
            {/* Viewfinder corner brackets */}
            {!isStarting && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-55 h-55 border-2 border-mint rounded-lg opacity-80" />
              </div>
            )}
          </div>
        )}
        <p className="text-[11px] text-center text-gray-400 mt-3">
          MAC address will be filled in automatically when detected
        </p>
      </div>
    </div>
  );
}

// ─── Main modal (4-step wizard) ────────────────────────────────────────────────
export default function AddApplianceModal({ onClose, onSuccess }: AddApplianceModalProps) {
  // Step 1 state — device identity
  const [macAddress, setMacAddress] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  // Step 2 state — appliance type
  const [applianceType, setApplianceType] = useState<ApplianceType | null>(null);

  // Step 3 state — daily usage hours
  const [dailyHours, setDailyHours] = useState(4);

  // Step 4 state — AI recommendation
  const [recommendation, setRecommendation] = useState<AiRecommendation | null>(null);

  // Shared state
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const handleScan = useCallback((mac: string) => {
    setMacAddress(mac);
    setShowScanner(false);
    setError(null);
  }, []);

  function handleStep1Next() {
    setError(null);
    const trimmedMac = macAddress.trim().toUpperCase();
    const trimmedName = deviceName.trim();

    if (!MAC_REGEX.test(trimmedMac)) {
      setError("Invalid MAC address. Expected format: E0:72:A1:D5:0B:68");
      return;
    }

    if (!trimmedName) {
      setError("Please enter a name for your appliance.");
      return;
    }

    setMacAddress(trimmedMac);
    setDeviceName(trimmedName);
    setStep(2);
  }

  function handleStep2Next() {
    if (!applianceType) {
      setError("Please select an appliance type.");
      return;
    }
    setError(null);
    setStep(3);
  }

  async function handleGetEstimate() {
    if (!applianceType) return;

    setError(null);
    setIsLoadingAi(true);

    try {
      const supabase = createClient();
      const { data: profileData } = await supabase
        .from("profiles")
        .select("monthly_budget_php")
        .maybeSingle();

      const homeBudget = Number(profileData?.monthly_budget_php ?? 2000);

      const res = await fetch("/api/insights/setup-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appliance_type: applianceType,
          daily_hours: dailyHours,
          home_budget: homeBudget,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error ?? "Failed to get AI recommendation.");
        return;
      }

      const data: AiRecommendation = await res.json();
      setRecommendation(data);
      setStep(4);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoadingAi(false);
    }
  }

  function handleSaveAppliance() {
    setError(null);

    startTransition(async () => {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError("Authentication error. Please log in again.");
        return;
      }

      const { error: insertError } = await supabase.from("devices").insert({
        user_id: user.id,
        mac_address: macAddress,
        device_name: deviceName,
        appliance_type: applianceType,
        daily_usage_hours: dailyHours,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          setError("This MAC address is already registered to a device.");
        } else {
          setError(insertError.message);
        }
        return;
      }

      onSuccess(deviceName);
    });
  }

  // Step progress indicator
  const stepLabels = ["Device", "Type", "Usage", "Review"];

  return (
    // pb-20 keeps the card clear of the ~64px bottom nav bar
    <div
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pt-4 pb-20 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-107.5 rounded-2xl bg-white overflow-hidden shadow-2xl max-h-[85vh] overflow-y-auto">
        {showScanner ? (
          <QrScannerView onScan={handleScan} onCancel={() => setShowScanner(false)} />
        ) : (
          <>
            {/* Header with step indicator */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-bold text-gray-900 tracking-tight">
                  {step === 1 && "Add New Appliance"}
                  {step === 2 && "What type of appliance?"}
                  {step === 3 && "AI Setup"}
                  {step === 4 && "AI Recommendation"}
                </h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Step {step} of 4
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step progress bar */}
            <div className="flex gap-1 px-5 pt-3">
              {stepLabels.map((label, i) => (
                <div key={label} className="flex-1">
                  <div
                    className={`h-1 rounded-full transition-colors ${
                      i + 1 <= step ? "bg-mint" : "bg-gray-200"
                    }`}
                  />
                  <p
                    className={`text-[9px] mt-1 text-center font-medium ${
                      i + 1 <= step ? "text-gray-700" : "text-gray-300"
                    }`}
                  >
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* ─── Step 1: MAC + Device Name ─── */}
              {step === 1 && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      MAC Address
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={macAddress}
                        onChange={(e) => setMacAddress(e.target.value)}
                        placeholder="E0:72:A1:D5:0B:68"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck={false}
                        className="flex-1 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-300 font-mono focus:outline-none focus:border-mint focus:ring-1 focus:ring-mint/30 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        title="Scan QR Code"
                        className="w-12 shrink-0 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 hover:text-mint hover:border-mint/40 hover:bg-mint/5 transition-colors"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Appliance Name
                    </label>
                    <input
                      type="text"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      placeholder="e.g. Living Room Aircon"
                      className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-mint focus:ring-1 focus:ring-mint/30 transition-colors"
                    />
                  </div>
                </>
              )}

              {/* ─── Step 2: Appliance Type Selector ─── */}
              {step === 2 && (
                <div className="grid grid-cols-2 gap-3">
                  {APPLIANCE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = applianceType === option.type;
                    return (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() => {
                          setApplianceType(option.type);
                          setError(null);
                        }}
                        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-5 transition-all ${
                          isSelected
                            ? "border-mint bg-mint/5"
                            : "border-gray-200 bg-gray-50 hover:border-gray-300"
                        }`}
                      >
                        <Icon
                          className={`w-8 h-8 ${
                            isSelected ? "text-mint" : "text-gray-400"
                          }`}
                        />
                        <span
                          className={`text-sm font-semibold ${
                            isSelected ? "text-gray-900" : "text-gray-500"
                          }`}
                        >
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ─── Step 3: Daily Usage Hours ─── */}
              {step === 3 && (
                <>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Ilang oras sa isang araw mo ginagamit ito?
                  </p>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                        Daily Hours
                      </span>
                      <span className="text-lg font-bold text-gray-900">
                        {dailyHours}h
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={24}
                      step={1}
                      value={dailyHours}
                      onChange={(e) => setDailyHours(Number(e.target.value))}
                      className="w-full accent-mint"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>1h</span>
                      <span>12h</span>
                      <span>24h</span>
                    </div>
                  </div>
                </>
              )}

              {/* ─── Step 4: AI Recommendation ─── */}
              {step === 4 && recommendation && (
                <>
                  {/* AI message card */}
                  <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-green-600" />
                      <span className="text-[10px] font-bold tracking-wider text-green-700 uppercase">
                        AI Recommendation
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {recommendation.message}
                    </p>
                  </div>

                  {/* Stats chips */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-center">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase">
                        Est. kWh/mo
                      </p>
                      <p className="text-base font-bold text-gray-900 mt-0.5">
                        {recommendation.estimated_monthly_kwh.toFixed(1)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-center">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase">
                        Est. Cost
                      </p>
                      <p className="text-base font-bold text-gray-900 mt-0.5">
                        ₱{recommendation.estimated_monthly_cost.toFixed(0)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-mint/10 border border-mint/30 p-3 text-center">
                      <p className="text-[10px] text-green-700 font-semibold uppercase">
                        Suggested
                      </p>
                      <p className="text-base font-bold text-green-700 mt-0.5">
                        ₱{recommendation.suggested_budget.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* Error banner */}
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-3.5 py-3">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 leading-snug">{error}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                {step === 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleStep1Next}
                      disabled={!macAddress.trim() || !deviceName.trim()}
                      className="flex-1 rounded-xl bg-mint px-4 py-3 text-sm font-bold text-base hover:bg-mint/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </>
                ) : step === 2 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleStep2Next}
                      disabled={!applianceType}
                      className="flex-1 rounded-xl bg-mint px-4 py-3 text-sm font-bold text-base hover:bg-mint/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </>
                ) : step === 3 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      disabled={isLoadingAi}
                      className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleGetEstimate}
                      disabled={isLoadingAi}
                      className="flex-1 rounded-xl bg-mint px-4 py-3 text-sm font-bold text-base hover:bg-mint/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoadingAi ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        "Get Estimate"
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      disabled={isPending}
                      className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAppliance}
                      disabled={isPending}
                      className="flex-1 rounded-xl bg-mint px-4 py-3 text-sm font-bold text-base hover:bg-mint/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Appliance"
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
