"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ShieldAlert, Trash2 } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import { createClient } from "@/lib/supabase/client";

type SettingsDevice = {
  id: string;
  device_name: string;
  require_approval_on_expiry: boolean | null;
  user_approved_limit_php: number | string | null;
  budget_status: string | null;
};

type SettingsClientProps = {
  billingCycleStartDay: number;
  email: string;
  devices: SettingsDevice[];
};

function formatPeso(value: number | string | null): string {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "No limit set";
  }

  return `₱${parsed.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function SettingsClient({
  billingCycleStartDay,
  email,
  devices,
}: SettingsClientProps) {
  const router = useRouter();
  const [billingCycleDraft, setBillingCycleDraft] = useState(String(billingCycleStartDay));
  const [billingCycleError, setBillingCycleError] = useState<string | null>(null);
  const [isSavingBillingCycle, setIsSavingBillingCycle] = useState(false);
  const [localDevices, setLocalDevices] = useState(devices);
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setBillingCycleDraft(String(billingCycleStartDay));
  }, [billingCycleStartDay]);

  async function saveBillingCycle() {
    const parsedDay = Number(billingCycleDraft);

    if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 28) {
      setBillingCycleError("Choose a billing start date from 1 to 28.");
      return;
    }

    setIsSavingBillingCycle(true);
    setBillingCycleError(null);
    setToast(null);

    try {
      const response = await fetch("/api/profile/billing-cycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billing_cycle_start_day: parsedDay }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          typeof payload.error === "string"
            ? payload.error
            : "We could not save your billing cycle date right now.";
        setBillingCycleError(message);
        setToast({ type: "error", message });
        return;
      }

      setToast({
        type: "success",
        message: "Billing cycle date saved.",
      });
      router.refresh();
    } catch {
      const message = "Network error while saving billing cycle date.";
      setBillingCycleError(message);
      setToast({ type: "error", message });
    } finally {
      setIsSavingBillingCycle(false);
    }
  }

  async function toggleApproval(deviceId: string, nextValue: boolean) {
    const previousDevices = localDevices;
    setPendingDeviceId(deviceId);
    setToast(null);
    setLocalDevices((current) =>
      current.map((device) =>
        device.id === deviceId
          ? { ...device, require_approval_on_expiry: nextValue }
          : device
      )
    );

    try {
      const res = await fetch(`/api/devices/${deviceId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ require_approval_on_expiry: nextValue }),
      });

      if (!res.ok) {
        setLocalDevices(previousDevices);
        setToast({
          type: "error",
          message: "We could not save that safety setting. Try again.",
        });
        return;
      }

      setToast({ type: "success", message: "Safety setting saved." });
      router.refresh();
    } catch {
      setLocalDevices(previousDevices);
      setToast({
        type: "error",
        message: "Network error while saving safety setting.",
      });
    } finally {
      setPendingDeviceId(null);
    }
  }

  async function sendPasswordReset() {
    setIsSendingReset(true);
    setToast(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setToast({
        type: "error",
        message: "We could not send the reset email right now. Try again.",
      });
    } else {
      setToast({
        type: "success",
        message: "Password reset email sent.",
      });
    }

    setIsSendingReset(false);
  }

  async function deleteAccount() {
    if (confirmDelete.trim().toUpperCase() !== "DELETE") {
      setToast({
        type: "error",
        message: "Type DELETE to confirm account deletion.",
      });
      return;
    }

    setIsDeleting(true);
    setToast(null);

    try {
      const res = await fetch("/api/account", { method: "DELETE" });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setToast({
          type: "error",
          message:
            typeof payload.error === "string"
              ? payload.error
              : "We could not delete your account right now.",
        });
        setIsDeleting(false);
        return;
      }

      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/onboarding");
      router.refresh();
    } catch {
      setToast({
        type: "error",
        message: "Network error while deleting your account.",
      });
      setIsDeleting(false);
    }
  }

  return (
    <>
      <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider">
          Billing Cycle
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          Set the Meralco reading date that starts your bill cycle. WattWise will
          use this for wallet totals, analytics forecasts, and Smart Control cutoffs.
        </p>

        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <label
            htmlFor="billing-cycle-start-day"
            className="text-[11px] font-semibold uppercase tracking-wider text-white/50"
          >
            Meralco Billing Start Date
          </label>
          <div className="mt-3 flex items-center gap-3">
            <select
              id="billing-cycle-start-day"
              value={billingCycleDraft}
              disabled={isSavingBillingCycle}
              onChange={(event) => {
                setBillingCycleDraft(event.target.value);
                if (billingCycleError) {
                  setBillingCycleError(null);
                }
              }}
              className="h-11 flex-1 rounded-xl border border-white/10 bg-black/10 px-3 text-sm font-semibold text-white outline-none transition-colors focus:border-mint/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                <option key={day} value={String(day)} className="bg-surface text-white">
                  {day}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void saveBillingCycle()}
              disabled={isSavingBillingCycle}
              className="inline-flex h-11 min-w-[104px] items-center justify-center gap-2 rounded-xl border border-mint/30 bg-mint/10 px-4 text-sm font-bold text-mint transition-colors hover:bg-mint/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingBillingCycle ? (
                <>
                  <LoadingIndicator size="sm" label="Saving" showLabel={false} />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>

          <p className={`mt-3 text-xs ${billingCycleError ? "text-danger" : "text-white/45"}`}>
            {billingCycleError
              ? billingCycleError
              : "Allowed values are 1 through 28 to match real Meralco reading windows safely."}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">
              Appearance
            </h2>
            <p className="mt-1 text-xs text-white/45">
              Theme is stored on this device and applied globally.
            </p>
          </div>
          <ThemeToggle />
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider">
          Budget Shutoff Override
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          When approval is required, WattWise will alert you after a device hits
          its approved monthly limit instead of automatically cutting power.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {localDevices.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/50">
              Add an appliance first to configure safety overrides.
            </div>
          ) : (
            localDevices.map((device) => {
              const isPending = pendingDeviceId === device.id;
              const approvalRequired = device.require_approval_on_expiry === true;

              return (
                <div
                  key={device.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">{device.device_name}</p>
                      <p className="mt-1 text-[11px] text-white/45">
                        Limit: {formatPeso(device.user_approved_limit_php)}
                      </p>
                      {device.budget_status === "approval_required" ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-naku">
                          <ShieldAlert className="h-3 w-3" />
                          Budget hit. Manual cut pending.
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => void toggleApproval(device.id, !approvalRequired)}
                      className={`relative h-7 w-14 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        approvalRequired ? "bg-naku" : "bg-mint"
                      }`}
                      aria-label={
                        approvalRequired
                          ? "Disable approval before shutoff"
                          : "Require approval before shutoff"
                      }
                    >
                      {isPending ? (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <LoadingIndicator
                            size="sm"
                            label="Saving"
                            showLabel={false}
                            spinnerClassName="border-black/30 border-t-black"
                          />
                        </span>
                      ) : (
                        <span
                          className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${
                            approvalRequired ? "translate-x-[28px]" : "translate-x-0"
                          }`}
                        />
                      )}
                    </button>
                  </div>
                  <p className="mt-3 text-[11px] text-white/40">
                    {approvalRequired
                      ? "Alert only: WattWise asks before cutting power."
                      : "Auto shutoff: relay turns off when limit is reached."}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider">
          Account
        </h2>
        <p className="mt-1 text-xs text-white/45">{email}</p>

        <button
          type="button"
          onClick={() => void sendPasswordReset()}
          disabled={isSendingReset || isDeleting}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm font-bold text-mint transition-colors hover:bg-mint/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSendingReset ? (
            <>
              <LoadingIndicator size="sm" label="Sending" showLabel={false} />
              Sending reset email...
            </>
          ) : (
            "Send Password Reset Email"
          )}
        </button>

        <div className="mt-5 rounded-xl border border-danger/25 bg-danger/10 p-4">
          <div className="flex items-start gap-2">
            <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div>
              <p className="text-sm font-bold text-danger">Delete Account</p>
              <p className="mt-1 text-xs leading-relaxed text-white/55">
                This removes your login, profile, devices, telemetry ownership,
                and cached insights through cascading database deletes.
              </p>
            </div>
          </div>
          <input
            value={confirmDelete}
            onChange={(event) => setConfirmDelete(event.target.value)}
            disabled={isDeleting}
            placeholder="Type DELETE to confirm"
            className="mt-3 w-full rounded-lg border border-danger/30 bg-black/10 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-danger"
          />
          <button
            type="button"
            onClick={() => void deleteAccount()}
            disabled={isDeleting}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-sm font-bold text-danger transition-colors hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? (
              <>
                <LoadingIndicator size="sm" label="Deleting" showLabel={false} />
                Deleting...
              </>
            ) : (
              "Delete My Account"
            )}
          </button>
        </div>
      </section>

      {toast ? (
        <div
          className={`fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-97.5 -translate-x-1/2 rounded-xl border px-4 py-3 backdrop-blur-sm ${
            toast.type === "success"
              ? "border-mint/35 bg-mint/10"
              : "border-danger/35 bg-danger/10"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-mint" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
            )}
            <p
              className={`text-sm font-semibold ${
                toast.type === "success" ? "text-mint" : "text-danger"
              }`}
            >
              {toast.message}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
