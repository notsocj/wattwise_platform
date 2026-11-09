"use client";

import { useState } from "react";
import { formatPeso } from "@/lib/format";
import { useRouter } from "next/navigation";
import { PencilLine, PlugZap, Power, QrCode, ShieldAlert, Trash2 } from "@/components/ui/icons";
import { DEVICE_NAME_MAX_LENGTH } from "@/lib/device-edit";
import ManagerSelect from "@/components/manager/ManagerSelect";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import MacQrScanner from "@/components/ui/MacQrScanner";
import type { ManagerDevice, ManagerTenant } from "@/lib/manager-data";
import { getBudgetToneClasses } from "@/lib/budget-policy";

type ManagerRoomsClientProps = {
  devices: ManagerDevice[];
  tenants: ManagerTenant[];
};

export default function ManagerRoomsClient({
  devices,
  tenants,
}: ManagerRoomsClientProps) {
  const router = useRouter();
  const [deviceName, setDeviceName] = useState("");
  const { confirm, confirmDialog } = useConfirmDialog();
  const [macAddress, setMacAddress] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const tenantOptions = [
    { value: "", label: "Vacant" },
    ...tenants.map((tenant) => ({
      value: tenant.id,
      label: tenant.full_name || tenant.email,
    })),
  ];

  async function pairDevice() {
    setPending("new-device");
    setMessage(null);

    try {
      const res = await fetch("/api/manager/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_name: deviceName, mac_address: macAddress }),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(typeof payload.error === "string" ? payload.error : "Failed to pair device.");
        return;
      }

      setDeviceName("");
      setMacAddress("");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function updateDevice(
    deviceId: string,
    updates: {
      tenant_id?: string | null;
      user_approved_limit_php?: number;
      relay_state?: boolean;
    }
  ) {
    setPending(deviceId);
    setMessage(null);

    try {
      const res = await fetch(`/api/manager/devices/${deviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(typeof payload.error === "string" ? payload.error : "Failed to update room.");
        return;
      }

      router.refresh();
    } finally {
      setPending(null);
    }
  }

  // Rename and remove use the shared owner route, same as the homeowner Device page.
  async function sendDeviceRequest(deviceId: string, method: "PATCH" | "DELETE", body: object, fallback: string) {
    setPending(deviceId);
    setMessage(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(typeof payload.error === "string" ? payload.error : fallback);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setMessage("Network error. Check your connection and try again.");
      return false;
    } finally {
      setPending(null);
    }
  }

  async function saveRename() {
    if (!renaming) return;
    const name = renaming.name.trim();
    if (!name) {
      setMessage("Give this unit a name.");
      return;
    }
    if (await sendDeviceRequest(renaming.id, "PATCH", { device_name: name }, "Failed to rename unit.")) {
      setRenaming(null);
    }
  }

  async function removeDevice(device: ManagerDevice) {
    const confirmed = await confirm({
      title: `Remove ${device.device_name}?`,
      description:
        "This deletes the unit, its readings, and its budget history, and unassigns its tenant. It can't be undone. You can pair the hardware again later.",
      confirmLabel: "Remove unit",
      tone: "danger",
    });
    if (confirmed) await sendDeviceRequest(device.id, "DELETE", { confirmed: true }, "Failed to remove unit.");
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger transition-[opacity,translate] duration-200 ease-out starting:-translate-y-1 starting:opacity-0">
          {message}
        </div>
      ) : null}

      <section className="rounded-2xl border border-fg/[0.06] bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <PlugZap className="h-4 w-4 text-accent" />
          <h2 className="text-base font-semibold tracking-tight">
            Pair Hardware
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
          <input
            value={deviceName}
            onChange={(event) => setDeviceName(event.target.value)}
            placeholder="Room 3 Sub-meter"
            className="h-12 rounded-full border border-fg/10 bg-shade/10 px-4 text-sm text-fg placeholder:text-fg/30 outline-none transition-colors duration-150 ease-out focus:border-mint/40"
          />
          <input
            value={macAddress}
            onChange={(event) => setMacAddress(event.target.value)}
            placeholder="AA:BB:CC:DD:EE:FF"
            className="h-12 rounded-full border border-fg/10 bg-shade/10 px-4 text-sm text-fg placeholder:text-fg/30 outline-none transition-colors duration-150 ease-out focus:border-mint/40"
          />
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            disabled={pending !== null}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-fg/10 bg-fg/[0.03] px-4 text-sm font-bold text-fg/75 transition-[border-color,color,scale] duration-150 ease-out hover:border-mint/30 hover:text-accent enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <QrCode className="h-4 w-4" />
            Scan QR
          </button>
          <button
            type="button"
            onClick={() => void pairDevice()}
            disabled={pending !== null || !deviceName || !macAddress}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-mint px-5 text-sm font-bold text-ink transition-[opacity,scale] duration-150 ease-out enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending === "new-device" ? (
              <LoadingIndicator size="sm" showLabel={false} spinnerClassName="border-ink/25 border-t-ink" />
            ) : (
              <PlugZap className="h-4 w-4" />
            )}
            Pair Unit
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-fg/[0.06] bg-surface p-5">
        <h2 className="text-base font-semibold tracking-tight">
          Room Control
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-fg/45">
          Assign tenants, set hard limits, and override relays for manager-owned
          sub-meters.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {devices.length === 0 ? (
            <p className="rounded-2xl border border-fg/[0.06] bg-fg/[0.03] p-4 text-sm text-fg/50 lg:col-span-2">
              Pair a WattWise unit to start managing tenant sub-meters.
            </p>
          ) : (
            devices.map((device) => {
              const isPending = pending === device.id;
              const limit = device.user_approved_limit_php;

              return (
                <div
                  key={device.id}
                  className="rounded-2xl border border-fg/[0.06] bg-fg/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {renaming?.id === device.id ? (
                        <form
                          className="flex items-center gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void saveRename();
                          }}
                        >
                          <label className="sr-only" htmlFor={`rename-${device.id}`}>New name for {device.device_name}</label>
                          <input
                            id={`rename-${device.id}`}
                            autoFocus
                            value={renaming.name}
                            maxLength={DEVICE_NAME_MAX_LENGTH}
                            disabled={isPending}
                            onChange={(event) => setRenaming({ id: device.id, name: event.target.value })}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") setRenaming(null);
                            }}
                            className="h-10 min-w-0 flex-1 rounded-full border border-fg/10 bg-shade/10 px-4 text-sm text-fg outline-none transition-colors duration-150 ease-out focus:border-mint/40"
                          />
                          <button
                            type="submit"
                            disabled={isPending || !renaming.name.trim()}
                            className="h-10 shrink-0 rounded-full bg-mint px-4 text-xs font-bold text-ink transition-[opacity,scale] duration-150 ease-out enabled:active:scale-[0.97] disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenaming(null)}
                            className="h-10 shrink-0 rounded-full px-3 text-xs font-semibold text-fg/60 transition-colors duration-150 ease-out hover:text-fg"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <p className="truncate font-bold">{device.device_name}</p>
                      )}
                      <p className="mt-1 truncate text-[11px] text-fg/45">
                        {device.mac_address}
                      </p>
                      <p className="mt-2 text-xs text-fg/60">
                        {device.tenant_label}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          device.relay_state &&
                          !(await confirm({
                            title: `Turn off ${device.device_name}?`,
                            description: "Power to this room's appliance will be cut until it is turned back on.",
                            confirmLabel: "Turn off",
                            tone: "danger",
                          }))
                        ) {
                          return;
                        }
                        void updateDevice(device.id, { relay_state: !device.relay_state });
                      }}
                      aria-label={`${device.device_name} power is ${device.relay_state ? "on" : "off"}. Tap to turn ${device.relay_state ? "off" : "on"}.`}
                      disabled={isPending}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.95] ${
                        device.relay_state
                          ? "bg-mint/10 text-accent"
                          : "bg-fg/[0.06] text-fg/60"
                      } disabled:opacity-60`}
                    >
                      <Power className="h-3 w-3" />
                      {device.relay_state ? "ON" : "OFF"}
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-fg/60">
                    <span>{Math.round(device.watts)}W</span>
                    <span>{Math.round(device.volts)}V</span>
                    <span>{device.amps.toFixed(1)}A</span>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <ManagerSelect
                      value={device.tenant_id ?? ""}
                      options={tenantOptions}
                      ariaLabel={`Assign tenant for ${device.device_name}`}
                      disabled={isPending}
                      onChange={(nextTenantId) =>
                        void updateDevice(device.id, {
                          tenant_id: nextTenantId || null,
                          user_approved_limit_php: limit || undefined,
                        })
                      }
                    />
                    <label className="relative block">
                      <span className="sr-only">Hard limit for {device.device_name}, in pesos</span>
                      <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-fg/40">₱</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="0.01"
                      defaultValue={limit || ""}
                      placeholder="Monthly hard limit"
                      onBlur={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value) && value > 0 && value !== limit) {
                          void updateDevice(device.id, {
                            tenant_id: device.tenant_id,
                            user_approved_limit_php: value,
                          });
                        }
                      }}
                      disabled={isPending}
                      className="h-12 w-full rounded-full border border-fg/10 bg-shade/10 pl-9 pr-4 text-sm text-fg placeholder:text-fg/30 outline-none transition-colors duration-150 ease-out focus:border-mint/40"
                    />
                    </label>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRenaming({ id: device.id, name: device.device_name })}
                      disabled={isPending || renaming?.id === device.id}
                      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-fg/10 px-4 text-xs font-semibold text-fg/70 transition-[border-color,color,scale] duration-150 ease-out hover:border-mint/30 hover:text-accent enabled:active:scale-[0.97] disabled:opacity-50"
                    >
                      <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeDevice(device)}
                      disabled={isPending}
                      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-danger/25 px-4 text-xs font-semibold text-danger transition-[background-color,scale] duration-150 ease-out hover:bg-danger/10 enabled:active:scale-[0.97] disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Remove
                    </button>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-[11px] text-fg/45">
                      <span>{formatPeso(device.spend_php)} used</span>
                      <span>{limit > 0 ? formatPeso(limit) : "No hard limit"}</span>
                    </div>
                    <div className="h-2 rounded-full bg-fg/[0.06]">
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ease-out ${getBudgetToneClasses(device.progress_percent).bar}`}
                        style={{ width: `${Math.min(device.progress_percent, 100)}%` }}
                      />
                    </div>
                    {device.budget_status && device.budget_status !== "ok" ? (
                      <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-danger">
                        <ShieldAlert className="h-3 w-3" />
                        {device.budget_status === "auto_cutoff"
                          ? "Auto cutoff active"
                          : "100% reached · power on"}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {showScanner ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-6 pt-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowScanner(false);
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-fg/10 bg-surface shadow-2xl">
            <MacQrScanner
              onScan={(mac) => {
                setMacAddress(mac);
                setShowScanner(false);
                setMessage(null);
              }}
              onCancel={() => setShowScanner(false)}
            />
          </div>
        </div>
      ) : null}
      {confirmDialog}
    </div>
  );
}
