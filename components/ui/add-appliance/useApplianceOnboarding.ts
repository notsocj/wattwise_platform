"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ApplianceType } from "@/lib/constants";
import { pollForDeviceProfile } from "@/lib/device-profile-polling";
import { MAC_REGEX, normalizeMac } from "@/lib/mac-address";

export type AiProfile = {
  estimated_monthly_kwh: number;
  suggested_monthly_limit_php: number;
  taglish_advice: string;
  estimated_monthly_cost_php: number;
  baseline_watts: number;
  voltage_v: number | null;
  current_a: number | null;
};

export type FieldErrors = Partial<{
  macAddress: string;
  deviceName: string;
  applianceType: string;
  dailyHours: string;
  approvedLimit: string;
}>;

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
    return "AI profiling is temporarily unavailable. Try again in a few minutes.";
  }

  if (message.includes("meralco") || message.includes("rates")) {
    return "Meralco rates are not ready yet, so WattWise cannot profile this appliance.";
  }

  return fallback;
}

export function useApplianceOnboarding({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (deviceName: string) => void;
}) {
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

  // Escape backs out of the QR scanner first, then closes the modal. Never
  // close while a save/profiling request is in flight.
  const escapeHandlerRef = useRef<() => void>(() => {});

  useEffect(() => {
    escapeHandlerRef.current = () => {
      if (isBusy) return;
      if (showScanner) {
        setShowScanner(false);
        return;
      }
      handleCloseModal();
    };
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") escapeHandlerRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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

    setIsSavingDevice(true);
    setError(null);

    const supabase = createClient();

    // Already registered in this session: persist any edits made after going
    // back to step 1 so profiling runs against the current MAC, name, and type.
    if (deviceId) {
      const { error: updateError } = await supabase
        .from("devices")
        .update({
          mac_address: normalizeMac(macAddress),
          device_name: deviceName.trim(),
          appliance_type: applianceType,
        })
        .eq("id", deviceId);

      setIsSavingDevice(false);
      if (updateError) {
        setApiError(
          updateError.code === "23505"
            ? "That MAC address is already registered to another appliance."
            : "We could not save your changes. Try again."
        );
        return;
      }

      setMacAddress(normalizeMac(macAddress));
      setDeviceName(deviceName.trim());
      setStep(3);
      router.refresh();
      return;
    }

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
          !existingDevice
            ? "This device is already linked to another WattWise account. Contact support if it belongs to you."
            : existingDevice.profiled_at
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

  function handleSubmit(event: FormEvent) {
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

  function updateMacAddress(value: string) {
    setMacAddress(value);
    clearFieldError("macAddress");
  }

  function updateDeviceName(value: string) {
    setDeviceName(value);
    clearFieldError("deviceName");
  }

  function revalidateStep1Field(field: "macAddress" | "deviceName") {
    setFieldErrors((current) => ({
      ...current,
      [field]: validateStep1()[field],
    }));
  }

  function applyScannedMac(mac: string) {
    setMacAddress(mac);
    setShowScanner(false);
    clearFieldError("macAddress");
  }

  function selectApplianceType(type: ApplianceType) {
    setApplianceType(type);
    clearFieldError("applianceType");
  }

  function updateDailyHours(hours: number) {
    setDailyHours(hours);
    clearFieldError("dailyHours");
  }

  function updateApprovedLimit(value: string) {
    setApprovedLimit(value);
    clearFieldError("approvedLimit");
  }

  function goBack() {
    setStep((current) => Math.max(1, current - 1));
  }

  return {
    step,
    macAddress,
    deviceName,
    applianceType,
    dailyHours,
    approvedLimit,
    profile,
    showScanner,
    setShowScanner,
    fieldErrors,
    error,
    isBusy,
    isSavingDevice,
    isProfiling,
    isSavingProfile,
    updateMacAddress,
    updateDeviceName,
    revalidateStep1Field,
    applyScannedMac,
    selectApplianceType,
    updateDailyHours,
    updateApprovedLimit,
    goBack,
    handleCloseModal,
    handleSubmit,
  };
}
