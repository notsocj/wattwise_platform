"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  HelpCircle,
  QrCode,
  Refrigerator,
  Tv,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ApplianceType } from "@/lib/constants";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import MacQrScanner from "@/components/ui/MacQrScanner";
import { pollForDeviceProfile } from "@/lib/device-profile-polling";
import { MAC_REGEX, normalizeMac } from "@/lib/mac-address";

interface AddApplianceModalProps {
  onClose: () => void;
  onSuccess: (deviceName: string) => void;
}

type AiProfile = {
  estimated_monthly_kwh: number;
  suggested_monthly_limit_php: number;
  taglish_advice: string;
  estimated_monthly_cost_php: number;
  baseline_watts: number;
  voltage_v: number | null;
  current_a: number | null;
};

type FieldErrors = Partial<{
  macAddress: string;
  deviceName: string;
  applianceType: string;
  dailyHours: string;
  approvedLimit: string;
}>;

const APPLIANCE_OPTIONS: {
  type: ApplianceType;
  label: string;
  icon: typeof Refrigerator;
}[] = [
  { type: ApplianceType.Refrigerator, label: "Fridge", icon: Refrigerator },
  { type: ApplianceType.Aircon, label: "Aircon", icon: Wind },
  { type: ApplianceType.Tv, label: "TV", icon: Tv },
  { type: ApplianceType.Other, label: "Other", icon: HelpCircle },
];

function parsePeso(value: string): number {
  return Number(value.replace(/,/g, "").trim());
}

function getApiErrorMessage(raw: string | undefined, fallback: string): string {
  const message = raw?.toLowerCase() ?? "";

  if (message.includes("fresh telemetry") || message.includes("0w")) {
    return raw ?? fallback;
  }

  if (message.includes("waiting for the device") || message.includes("drawing 0 w")) {
    return raw ?? fallback;
  }

  if (message.includes("openai")) {
    return "AI profiling is temporarily unavailable. Check OPENAI_API_KEY and try again.";
  }

  if (message.includes("meralco") || message.includes("rates")) {
    return "Meralco rates are not ready yet, so WattWise cannot profile this appliance.";
  }

  return fallback;
}

export default function AddApplianceModal({
  onClose,
  onSuccess,
}: AddApplianceModalProps) {
  const router = useRouter();
  const [macAddress, setMacAddress] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [applianceType, setApplianceType] = useState<ApplianceType | null>(null);
  const [dailyHours, setDailyHours] = useState(4);
  const [approvedLimit, setApprovedLimit] = useState("");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AiProfile | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [step, setStep] = useState(1);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSavingDevice, setIsSavingDevice] = useState(false);
  const [isProfiling, setIsProfiling] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const profileAbortController = useRef<AbortController | null>(null);
  const isMounted = useRef(true);

  const isBusy = isSavingDevice || isProfiling || isSavingProfile;

  useEffect(() => {
    return () => {
      isMounted.current = false;
      profileAbortController.current?.abort();
    };
  }, []);

  function setApiError(message: string) {
    setError(message);
  }

  function handleCloseModal() {
    profileAbortController.current?.abort();
    onClose();
  }

  function clearFieldError(field: keyof FieldErrors) {
    setError(null);
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validateStep1(): FieldErrors {
    const nextErrors: FieldErrors = {};
    const normalizedMac = normalizeMac(macAddress);

    if (!normalizedMac) {
      nextErrors.macAddress =
        "Enter the MAC address printed on your WattWise device, or scan its QR code.";
    } else if (!MAC_REGEX.test(normalizedMac)) {
      nextErrors.macAddress =
        "Use 6 pairs of letters or numbers separated by colons, e.g. E0:72:A1:D5:0B:68.";
    }

    if (!deviceName.trim()) {
      nextErrors.deviceName =
        "Give this appliance a name so it is easy to recognize.";
    }

    return nextErrors;
  }

  async function handleRegisterDevice() {
    const nextErrors = validateStep1();
    if (!applianceType) {
      nextErrors.applianceType =
        "Choose the appliance type that best matches this device.";
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !applianceType) {
      setError("Please fix the highlighted fields before continuing.");
      return;
    }

    if (deviceId) {
      setStep(3);
      return;
    }

    setIsSavingDevice(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setApiError("Your session expired. Log in again before saving this appliance.");
      setIsSavingDevice(false);
      return;
    }

    const normalizedMac = normalizeMac(macAddress);
    const trimmedName = deviceName.trim();
    const { data, error: insertError } = await supabase
      .from("devices")
      .insert({
        owner_id: user.id,
        user_id: user.id,
        mac_address: normalizedMac,
        device_name: trimmedName,
        appliance_type: applianceType,
        relay_state: true,
        require_approval_on_expiry: true,
      })
      .select("id")
      .single<{ id: string }>();

    if (insertError || !data) {
      if (insertError?.code === "23505") {
        const { data: existingDevice } = await supabase
          .from("devices")
          .select("id, profiled_at")
          .eq("mac_address", normalizedMac)
          .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`)
          .maybeSingle<{ id: string; profiled_at: string | null }>();

        if (existingDevice && !existingDevice.profiled_at) {
          const { error: resumeError } = await supabase
            .from("devices")
            .update({
              device_name: trimmedName,
              appliance_type: applianceType,
              relay_state: true,
            })
            .eq("id", existingDevice.id)
            .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`);

          if (!resumeError) {
            setMacAddress(normalizedMac);
            setDeviceName(trimmedName);
            setDeviceId(existingDevice.id);
            setIsSavingDevice(false);
            setStep(3);
            router.refresh();
            return;
          }
        }

        setApiError(
          existingDevice?.profiled_at
            ? "This MAC address is already assigned to a completed appliance."
            : "This device was registered earlier, but WattWise could not resume its setup. Try again."
        );
      } else {
        setApiError("We could not register this appliance. Try again.");
      }
      setIsSavingDevice(false);
      return;
    }

    setMacAddress(normalizedMac);
    setDeviceName(trimmedName);
    setDeviceId(data.id);
    setIsSavingDevice(false);
    setStep(3);
    router.refresh();
  }

  async function handleProfileDevice() {
    if (!deviceId) {
      setApiError("Register the appliance before profiling it.");
      return;
    }

    if (!Number.isFinite(dailyHours) || dailyHours < 1 || dailyHours > 24) {
      setFieldErrors((current) => ({
        ...current,
        dailyHours: "Choose daily usage between 1 and 24 hours.",
      }));
      setError("Please fix the daily usage hours before profiling.");
      return;
    }

    setIsProfiling(true);
    setError(null);
    const abortController = new AbortController();
    profileAbortController.current?.abort();
    profileAbortController.current = abortController;

    try {
      const res = await pollForDeviceProfile(
        () =>
          fetch(`/api/devices/${deviceId}/ai-profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ daily_usage_hours: dailyHours }),
            signal: abortController.signal,
          }),
        { signal: abortController.signal }
      );

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setApiError(
          getApiErrorMessage(
            typeof payload.error === "string" ? payload.error : undefined,
            "We could not profile this appliance yet. Check the device and try again."
          )
        );
        setIsProfiling(false);
        return;
      }

      const nextProfile = (await res.json()) as AiProfile;
      setProfile(nextProfile);
      setApprovedLimit(nextProfile.suggested_monthly_limit_php.toFixed(2));
      setStep(4);
    } catch (profileError) {
      if (profileError instanceof DOMException && profileError.name === "AbortError") {
        return;
      }
      setApiError("We could not reach WattWise right now. Check your connection and try again.");
    } finally {
      if (profileAbortController.current === abortController) {
        profileAbortController.current = null;
        if (isMounted.current) {
          setIsProfiling(false);
        }
      }
    }
  }

  async function handleSaveProfile() {
    if (!deviceId || !profile) {
      setApiError("Generate an AI profile before saving.");
      return;
    }

    const parsedLimit = parsePeso(approvedLimit);
    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      setFieldErrors((current) => ({
        ...current,
        approvedLimit: "Enter a positive monthly peso limit for this appliance.",
      }));
      setError("Please fix the approved limit before saving.");
      return;
    }

    setIsSavingProfile(true);
    setError(null);

    try {
      const res = await fetch(`/api/devices/${deviceId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daily_usage_hours: dailyHours,
          suggested_monthly_limit_php: profile.suggested_monthly_limit_php,
          user_approved_limit_php: parsedLimit,
          profiled_baseline_watts: profile.baseline_watts,
          profiled_voltage_v: profile.voltage_v,
          profiled_current_a: profile.current_a,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setApiError(
          typeof payload.error === "string"
            ? payload.error
            : "We could not save this appliance profile."
        );
        setIsSavingProfile(false);
        return;
      }

      onSuccess(deviceName);
    } catch {
      setApiError("Network error while saving profile. Check connection and retry.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isBusy) return;

    if (step === 1) {
      const nextErrors = validateStep1();
      setFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        setError("Please fix the highlighted fields before continuing.");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      void handleRegisterDevice();
      return;
    }

    if (step === 3) {
      void handleProfileDevice();
      return;
    }

    void handleSaveProfile();
  }

  const stepLabels = ["Device", "Type", "Live", "Approve"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-20 pt-4 backdrop-blur-sm"
      onClick={(event) => {
        if (
          !isSavingDevice &&
          !isSavingProfile &&
          event.target === event.currentTarget
        ) {
          handleCloseModal();
        }
      }}
    >
      <div className="max-h-[85vh] w-full max-w-107.5 overflow-hidden overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {showScanner ? (
          <MacQrScanner
            onScan={(mac) => {
              setMacAddress(mac);
              setShowScanner(false);
              clearFieldError("macAddress");
            }}
            onCancel={() => setShowScanner(false)}
          />
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 pb-3 pt-5">
              <div>
                <h2 className="text-sm font-bold tracking-tight text-gray-900">
                  {step === 1 && "Add New Appliance"}
                  {step === 2 && "Choose Appliance Type"}
                  {step === 3 && "Live AI Profiling"}
                  {step === 4 && "Approve Budget Limit"}
                </h2>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  Step {step} of 4
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isSavingDevice || isSavingProfile}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-1 px-5 pt-3">
              {stepLabels.map((label, index) => (
                <div key={label} className="flex-1">
                  <div
                    className={`h-1 rounded-full transition-colors ${
                      index + 1 <= step ? "bg-mint" : "bg-gray-200"
                    }`}
                  />
                  <p
                    className={`mt-1 text-center text-[9px] font-medium ${
                      index + 1 <= step ? "text-gray-700" : "text-gray-300"
                    }`}
                  >
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5" noValidate>
              {step === 1 ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="appliance-mac-address"
                      className="text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                    >
                      MAC Address
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="appliance-mac-address"
                        value={macAddress}
                        disabled={isBusy}
                        onChange={(event) => {
                          setMacAddress(event.target.value);
                          clearFieldError("macAddress");
                        }}
                        onBlur={() =>
                          setFieldErrors((current) => ({
                            ...current,
                            macAddress: validateStep1().macAddress,
                          }))
                        }
                        placeholder="E0:72:A1:D5:0B:68"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={Boolean(fieldErrors.macAddress)}
                        aria-describedby="appliance-mac-address-message"
                        className={`flex-1 rounded-xl border bg-gray-50 px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-300 outline-none transition-colors focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 ${
                          fieldErrors.macAddress
                            ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                            : "border-gray-200 focus:border-mint focus:ring-mint/30"
                        }`}
                      />
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setShowScanner(true)}
                        className="flex w-12 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-400 transition-colors hover:border-mint/40 hover:bg-mint/5 hover:text-mint disabled:cursor-not-allowed disabled:opacity-40"
                        title="Scan QR Code"
                      >
                        <QrCode className="h-4 w-4" />
                      </button>
                    </div>
                    <p
                      id="appliance-mac-address-message"
                      className={`text-[11px] leading-snug ${
                        fieldErrors.macAddress ? "text-red-600" : "text-gray-400"
                      }`}
                    >
                      {fieldErrors.macAddress ??
                        "Find this on the device label, or use the QR scanner."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="appliance-device-name"
                      className="text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                    >
                      Appliance Name
                    </label>
                    <input
                      id="appliance-device-name"
                      value={deviceName}
                      disabled={isBusy}
                      onChange={(event) => {
                        setDeviceName(event.target.value);
                        clearFieldError("deviceName");
                      }}
                      onBlur={() =>
                        setFieldErrors((current) => ({
                          ...current,
                          deviceName: validateStep1().deviceName,
                        }))
                      }
                      placeholder="e.g. Living Room Aircon"
                      aria-invalid={Boolean(fieldErrors.deviceName)}
                      aria-describedby="appliance-device-name-message"
                      className={`rounded-xl border bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-300 outline-none transition-colors focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 ${
                        fieldErrors.deviceName
                          ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                          : "border-gray-200 focus:border-mint focus:ring-mint/30"
                      }`}
                    />
                    <p
                      id="appliance-device-name-message"
                      className={`text-[11px] leading-snug ${
                        fieldErrors.deviceName ? "text-red-600" : "text-gray-400"
                      }`}
                    >
                      {fieldErrors.deviceName ??
                        "Use a name you will recognize on the dashboard."}
                    </p>
                  </div>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <div className="grid grid-cols-2 gap-3" aria-describedby="appliance-type-message">
                    {APPLIANCE_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const isSelected = applianceType === option.type;
                      return (
                        <button
                          key={option.type}
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setApplianceType(option.type);
                            clearFieldError("applianceType");
                          }}
                          aria-pressed={isSelected}
                          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-5 transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                            isSelected
                              ? "border-mint bg-mint/5"
                              : fieldErrors.applianceType
                                ? "border-red-200 bg-red-50 hover:border-red-300"
                                : "border-gray-200 bg-gray-50 hover:border-gray-300"
                          }`}
                        >
                          <Icon className={`h-8 w-8 ${isSelected ? "text-mint" : "text-gray-400"}`} />
                          <span className={`text-sm font-semibold ${isSelected ? "text-gray-900" : "text-gray-500"}`}>
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p
                    id="appliance-type-message"
                    className={`text-[11px] leading-snug ${
                      fieldErrors.applianceType ? "text-red-600" : "text-gray-400"
                    }`}
                  >
                    {fieldErrors.applianceType ??
                      "WattWise will register this MAC first, then use live telemetry for profiling."}
                  </p>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <div className="rounded-xl border border-mint/20 bg-mint/10 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-green-700" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-green-700">
                        Device Registered
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-gray-700">
                      Registration is saved so the hardware can upload securely. Keep the
                      WattWise unit and appliance powered on while we wait for its live reading.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        Estimated Daily Hours
                      </span>
                      <span className="text-lg font-bold text-gray-900">{dailyHours}h</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={24}
                      step={1}
                      value={dailyHours}
                      disabled={isBusy}
                      onChange={(event) => {
                        setDailyHours(Number(event.target.value));
                        clearFieldError("dailyHours");
                      }}
                      className="w-full accent-mint disabled:opacity-50"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>1h</span>
                      <span>12h</span>
                      <span>24h</span>
                    </div>
                    <p className="text-[11px] leading-snug text-gray-400">
                      Use the normal daily runtime for this appliance so the AI estimate feels realistic.
                    </p>
                  </div>
                </>
              ) : null}

              {step === 4 && profile ? (
                <>
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-green-600" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-green-700">
                        AI Recommendation
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-gray-700">
                      {profile.taglish_advice}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
                      <p className="text-[10px] font-semibold uppercase text-gray-400">
                        Live W
                      </p>
                      <p className="mt-0.5 text-base font-bold text-gray-900">
                        {profile.baseline_watts.toFixed(0)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
                      <p className="text-[10px] font-semibold uppercase text-gray-400">
                        Est. kWh
                      </p>
                      <p className="mt-0.5 text-base font-bold text-gray-900">
                        {profile.estimated_monthly_kwh.toFixed(1)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-mint/30 bg-mint/10 p-3 text-center">
                      <p className="text-[10px] font-semibold uppercase text-green-700">
                        Suggested
                      </p>
                      <p className="mt-0.5 text-base font-bold text-green-700">
                        ₱{profile.suggested_monthly_limit_php.toLocaleString("en-PH")}
                      </p>
                    </div>
                  </div>

                  <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] leading-snug text-gray-500">
                    Estimated variable monthly spend: ₱
                    {profile.estimated_monthly_cost_php.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="approved-limit"
                      className="text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                    >
                      Approved Monthly Limit (PHP)
                    </label>
                    <input
                      id="approved-limit"
                      type="text"
                      inputMode="decimal"
                      value={approvedLimit}
                      disabled={isBusy}
                      onChange={(event) => {
                        setApprovedLimit(event.target.value);
                        clearFieldError("approvedLimit");
                      }}
                      aria-invalid={Boolean(fieldErrors.approvedLimit)}
                      aria-describedby="approved-limit-message"
                      className={`rounded-xl border bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-300 outline-none transition-colors focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 ${
                        fieldErrors.approvedLimit
                          ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                          : "border-gray-200 focus:border-mint focus:ring-mint/30"
                      }`}
                    />
                    <p
                      id="approved-limit-message"
                      className={`text-[11px] leading-snug ${
                        fieldErrors.approvedLimit ? "text-red-600" : "text-gray-400"
                      }`}
                    >
                      {fieldErrors.approvedLimit ??
                        "This per-appliance variable spend limit powers auto shutoff."}
                    </p>
                  </div>
                </>
              ) : null}

              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <p className="text-sm leading-snug text-red-600">{error}</p>
                </div>
              ) : null}

              <div className="flex gap-3 pt-1">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((current) => Math.max(1, current - 1))}
                    disabled={isBusy}
                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={isBusy}
                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isBusy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-mint px-4 py-3 text-sm font-bold text-base transition-all hover:bg-mint/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isBusy ? (
                    <>
                      <LoadingIndicator
                        size="sm"
                        label="Working"
                        showLabel={false}
                        spinnerClassName="border-black/30 border-t-black"
                      />
                      {isSavingDevice && "Registering..."}
                      {isProfiling && "Waiting for live data..."}
                      {isSavingProfile && "Saving..."}
                    </>
                  ) : step === 1 ? (
                    "Next"
                  ) : step === 2 ? (
                    "Register Device"
                  ) : step === 3 ? (
                    "Profile Live Reading"
                  ) : (
                    "Save Appliance"
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

    </div>
  );
}
