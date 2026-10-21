"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatPeso } from "@/lib/format";
import type { SettingsDevice, ShowSettingsToast } from "@/components/settings/settings-types";

function formatLimit(value: number | string | null): string {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "No limit set";
  }

  return formatPeso(parsed);
}

export default function AutoShutoffSection({
  devices,
  onToast,
}: {
  devices: SettingsDevice[];
  onToast: ShowSettingsToast;
}) {
  const router = useRouter();
  const [localDevices, setLocalDevices] = useState(devices);
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  async function toggleAutoCutoff(deviceId: string, enabled: boolean) {
    if (
      enabled &&
      !(await confirm({
        title: "Enable automatic shutoff?",
        description:
          "WattWise will interrupt appliance power when this device reaches 100% of its approved limit.",
        confirmLabel: "Enable shutoff",
      }))
    ) {
      return;
    }

    const previousDevices = localDevices;
    setPendingDeviceId(deviceId);
    onToast(null);
    setLocalDevices((current) =>
      current.map((device) =>
        device.id === deviceId
          ? { ...device, require_approval_on_expiry: !enabled }
          : device
      )
    );

    try {
      const res = await fetch(`/api/devices/${deviceId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_cutoff_enabled: enabled }),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLocalDevices(previousDevices);
        onToast({
          type: "error",
          message:
            typeof payload.error === "string"
              ? payload.error
              : "We could not save that safety setting. Try again.",
        });
        return;
      }

      setLocalDevices((current) =>
        current.map((device) =>
          device.id === deviceId
            ? {
                ...device,
                require_approval_on_expiry: !enabled,
                budget_status:
                  typeof payload.device?.budget_status === "string"
                    ? payload.device.budget_status
                    : device.budget_status,
              }
            : device
        )
      );

      onToast({
        type: "success",
        message: enabled
          ? "Automatic shutoff enabled."
          : "Automatic shutoff disabled. Power will remain unchanged.",
      });
      router.refresh();
    } catch {
      setLocalDevices(previousDevices);
      onToast({
        type: "error",
        message: "Network error while saving safety setting.",
      });
    } finally {
      setPendingDeviceId(null);
    }
  }

  async function restorePower(deviceId: string) {
    if (
      !(await confirm({
        title: "Restore power now?",
        description: "The appliance will turn back on within a few seconds.",
        confirmLabel: "Restore power",
      }))
    ) {
      return;
    }
    setPendingDeviceId(deviceId);
    onToast(null);
    try {
      const response = await fetch(`/api/devices/${deviceId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        onToast({
          type: "error",
          message:
            typeof payload.error === "string"
              ? payload.error
              : "Power could not be restored.",
        });
        return;
      }
      setLocalDevices((current) =>
        current.map((device) =>
          device.id === deviceId
            ? {
                ...device,
                budget_status:
                  typeof payload.device?.budget_status === "string"
                    ? payload.device.budget_status
                    : "ok",
              }
            : device
        )
      );
      onToast({ type: "success", message: "Appliance power restored." });
      router.refresh();
    } catch {
      onToast({ type: "error", message: "Network error while restoring power." });
    } finally {
      setPendingDeviceId(null);
    }
  }

  return (
    <>
      <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider">
          Automatic Shutoff at 100%
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          Choose which appliances WattWise may turn off after their approved
          billing-cycle variable-spend limit is reached.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {localDevices.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/50">
              Add an appliance first to configure safety overrides.
            </div>
          ) : (
            localDevices.map((device) => {
              const isPending = pendingDeviceId === device.id;
              const autoCutoffEnabled = device.require_approval_on_expiry !== true;

              return (
                <div
                  key={device.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">{device.device_name}</p>
                      <p className="mt-1 text-[11px] text-white/45">
                        Limit: {formatLimit(device.user_approved_limit_php)}
                      </p>
                      {device.budget_status === "approval_required" ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-danger">
                          <ShieldAlert className="h-3 w-3" />
                          100% reached. Power remains on.
                        </p>
                      ) : device.budget_status === "auto_cutoff" ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-danger">
                          <ShieldAlert className="h-3 w-3" />
                          Automatic cutoff active.
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => void toggleAutoCutoff(device.id, !autoCutoffEnabled)}
                      role="switch"
                      aria-checked={autoCutoffEnabled}
                      className={`relative h-7 w-14 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        autoCutoffEnabled ? "bg-naku" : "bg-white/15"
                      }`}
                      aria-label={`Automatic shutoff for ${device.device_name}`}
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
                            autoCutoffEnabled ? "translate-x-[28px]" : "translate-x-0"
                          }`}
                        />
                      )}
                    </button>
                  </div>
                  <p className="mt-3 text-[11px] text-white/40">
                    {autoCutoffEnabled
                      ? "Enabled: WattWise turns the relay off at 100%."
                      : "Disabled: WattWise alerts you at 100% and leaves power on."}
                  </p>
                  {device.budget_status === "auto_cutoff" ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => void restorePower(device.id)}
                      className="mt-3 w-full rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-xs font-bold text-danger disabled:opacity-50"
                    >
                      Restore Power
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>

      {confirmDialog}
    </>
  );
}
