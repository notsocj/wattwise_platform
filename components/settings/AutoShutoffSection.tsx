"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Power, ShieldAlert } from "@/components/ui/icons";
import Switch from "@/components/ui/Switch";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsGroup";
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
      <SettingsGroup
        title="Safety"
        footer="When on, WattWise turns an appliance off once it spends its limit for the billing cycle. When off, you get an alert and the power stays on."
      >
        {localDevices.length === 0 ? (
          <p className="px-4 py-4 text-sm text-fg/50">Add an appliance first to set automatic shut-off.</p>
        ) : (
          localDevices.map((device) => {
            const isPending = pendingDeviceId === device.id;
            const autoCutoffEnabled = device.require_approval_on_expiry !== true;
            const status =
              device.budget_status === "approval_required"
                ? "100% reached, power still on"
                : device.budget_status === "auto_cutoff"
                  ? "Turned off at 100%"
                  : null;

            return (
              <SettingsRow
                key={device.id}
                icon={Power}
                title={device.device_name}
                description={
                  status ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-danger">
                      <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                      {status}
                    </span>
                  ) : (
                    formatLimit(device.user_approved_limit_php) === "No limit set"
                      ? "No spending limit set yet"
                      : `Limit: ${formatLimit(device.user_approved_limit_php)} per billing cycle`
                  )
                }
                control={
                  <Switch
                    checked={autoCutoffEnabled}
                    pending={isPending}
                    tone="warning"
                    label={`Automatic shut-off for ${device.device_name}`}
                    onChange={(value) => void toggleAutoCutoff(device.id, value)}
                  />
                }
              >
                {device.budget_status === "auto_cutoff" ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => void restorePower(device.id)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-danger/35 bg-danger/10 px-3 text-xs font-bold text-danger transition-[opacity,scale] duration-150 ease-out enabled:active:scale-[0.97] disabled:opacity-50"
                  >
                    Restore power
                  </button>
                ) : null}
              </SettingsRow>
            );
          })
        )}
      </SettingsGroup>

      {confirmDialog}
    </>
  );
}
