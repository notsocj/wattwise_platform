"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlugZap, Power, QrCode, ShieldAlert } from "lucide-react";
import ManagerSelect from "@/components/manager/ManagerSelect";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import MacQrScanner from "@/components/ui/MacQrScanner";
import type { ManagerDevice, ManagerTenant } from "@/lib/manager-data";

type ManagerRoomsClientProps = {
  devices: ManagerDevice[];
  tenants: ManagerTenant[];
};

function formatPeso(value: number): string {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ManagerRoomsClient({
  devices,
  tenants,
}: ManagerRoomsClientProps) {
  const router = useRouter();
  const [deviceName, setDeviceName] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {message}
        </div>
      ) : null}

      <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <PlugZap className="h-4 w-4 text-mint" />
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Pair Hardware
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
          <input
            value={deviceName}
            onChange={(event) => setDeviceName(event.target.value)}
            placeholder="Room 3 Sub-meter"
            className="rounded-xl border border-white/10 bg-black/10 px-3 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-mint/40"
          />
          <input
            value={macAddress}
            onChange={(event) => setMacAddress(event.target.value)}
            placeholder="AA:BB:CC:DD:EE:FF"
            className="rounded-xl border border-white/10 bg-black/10 px-3 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-mint/40"
          />
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            disabled={pending !== null}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-bold text-white/75 transition-colors hover:border-mint/30 hover:text-mint disabled:cursor-not-allowed disabled:opacity-60"
          >
            <QrCode className="h-4 w-4" />
            Scan QR
          </button>
          <button
            type="button"
            onClick={() => void pairDevice()}
            disabled={pending !== null || !deviceName || !macAddress}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm font-bold text-mint disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === "new-device" ? (
              <LoadingIndicator size="sm" showLabel={false} />
            ) : (
              <PlugZap className="h-4 w-4" />
            )}
            Pair Unit
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider">
          Room Control
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          Assign tenants, set hard limits, and override relays for manager-owned
          sub-meters.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {devices.length === 0 ? (
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/50 lg:col-span-2">
              Pair a WattWise unit to start managing tenant sub-meters.
            </p>
          ) : (
            devices.map((device) => {
              const isPending = pending === device.id;
              const limit = device.user_approved_limit_php;

              return (
                <div
                  key={device.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{device.device_name}</p>
                      <p className="mt-1 truncate text-[11px] text-white/45">
                        {device.mac_address}
                      </p>
                      <p className="mt-2 text-xs text-white/60">
                        {device.tenant_label}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void updateDevice(device.id, {
                          relay_state: !device.relay_state,
                        })
                      }
                      disabled={isPending}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                        device.relay_state
                          ? "bg-mint/10 text-mint"
                          : "bg-danger/10 text-danger"
                      } disabled:opacity-60`}
                    >
                      <Power className="h-3 w-3" />
                      {device.relay_state ? "ON" : "OFF"}
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-white/60">
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
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      defaultValue={limit || ""}
                      placeholder="Hard limit in PHP"
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
                      className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-mint/40"
                    />
                  </div>

                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-[11px] text-white/45">
                      <span>{formatPeso(device.spend_php)} used</span>
                      <span>{limit > 0 ? formatPeso(limit) : "No hard limit"}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full ${
                          device.progress_percent >= 100
                            ? "bg-danger"
                            : device.progress_percent >= 80
                              ? "bg-naku"
                              : "bg-mint"
                        }`}
                        style={{ width: `${device.progress_percent}%` }}
                      />
                    </div>
                    {device.budget_status && device.budget_status !== "ok" ? (
                      <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-naku">
                        <ShieldAlert className="h-3 w-3" />
                        {device.budget_status === "auto_cutoff"
                          ? "Auto cutoff active"
                          : "Approval required"}
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
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
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
    </div>
  );
}
