"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, PlugZap, Power, UserPlus } from "lucide-react";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import { getBudgetToneClasses } from "@/lib/budget-policy";

type ManagerTenant = {
  id: string;
  email: string;
  full_name: string | null;
};

type ManagerDevice = {
  id: string;
  device_name: string;
  mac_address: string;
  tenant_id: string | null;
  user_approved_limit_php: number;
  relay_state: boolean;
  budget_status: string | null;
  watts: number;
  volts: number;
  amps: number;
  spend_php: number;
};

type ManagerCommandCenterProps = {
  devices: ManagerDevice[];
  tenants: ManagerTenant[];
};

function formatPeso(value: number): string {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getTenantLabel(tenants: ManagerTenant[], tenantId: string | null): string {
  if (!tenantId) {
    return "Vacant";
  }

  const tenant = tenants.find((item) => item.id === tenantId);
  return tenant?.full_name || tenant?.email || "Assigned tenant";
}

export default function ManagerCommandCenter({
  devices,
  tenants,
}: ManagerCommandCenterProps) {
  const router = useRouter();
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [credential, setCredential] = useState<{
    email: string;
    password: string;
  } | null>(null);

  async function createTenant() {
    setPending("tenant");
    setMessage(null);
    setCredential(null);

    try {
      const res = await fetch("/api/manager/create-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: tenantEmail, full_name: tenantName }),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(typeof payload.error === "string" ? payload.error : "Failed to create tenant.");
        return;
      }

      setCredential({
        email: payload.tenant.email,
        password: payload.temporary_password,
      });
      setTenantEmail("");
      setTenantName("");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function pairDevice() {
    setPending("device");
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
        setMessage(typeof payload.error === "string" ? payload.error : "Failed to update device.");
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

      {credential ? (
        <div className="rounded-xl border border-mint/35 bg-mint/10 px-4 py-3 text-sm">
          <p className="font-bold text-mint">Tenant credentials generated</p>
          <p className="mt-1 text-white/70">Email: {credential.email}</p>
          <p className="text-white/70">Temporary password: {credential.password}</p>
        </div>
      ) : null}

      <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-mint" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Create Tenant</h2>
        </div>
        <div className="grid gap-3">
          <input
            value={tenantEmail}
            onChange={(event) => setTenantEmail(event.target.value)}
            placeholder="room3@wattwise.local"
            className="rounded-xl border border-white/10 bg-black/10 px-3 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-mint/40"
          />
          <input
            value={tenantName}
            onChange={(event) => setTenantName(event.target.value)}
            placeholder="Tenant name or room label"
            className="rounded-xl border border-white/10 bg-black/10 px-3 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-mint/40"
          />
          <button
            type="button"
            onClick={() => void createTenant()}
            disabled={pending !== null || !tenantEmail}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-mint px-4 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === "tenant" ? <LoadingIndicator size="sm" showLabel={false} spinnerClassName="border-black/30 border-t-black" /> : <KeyRound className="h-4 w-4" />}
            Generate Tenant Login
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <PlugZap className="h-4 w-4 text-mint" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Pair Hardware</h2>
        </div>
        <div className="grid gap-3">
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
            onClick={() => void pairDevice()}
            disabled={pending !== null || !deviceName || !macAddress}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm font-bold text-mint disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === "device" ? <LoadingIndicator size="sm" showLabel={false} /> : <PlugZap className="h-4 w-4" />}
            Pair Unit
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider">Fleet Grid</h2>
        <div className="space-y-3">
          {devices.length === 0 ? (
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/50">
              Pair a WattWise unit to start managing tenant sub-meters.
            </p>
          ) : (
            devices.map((device) => {
              const limit = Math.max(0, device.user_approved_limit_php);
              const progress = limit > 0 ? Math.min((device.spend_php / limit) * 100, 100) : 0;
              const isPending = pending === device.id;

              return (
                <div key={device.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{device.device_name}</p>
                      <p className="mt-1 text-[11px] text-white/45">{device.mac_address}</p>
                      <p className="mt-2 text-xs text-white/60">
                        {getTenantLabel(tenants, device.tenant_id)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void updateDevice(device.id, { relay_state: !device.relay_state })}
                      disabled={isPending}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                        device.relay_state ? "bg-mint/10 text-mint" : "bg-danger/10 text-danger"
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
                    <select
                      value={device.tenant_id ?? ""}
                      onChange={(event) =>
                        void updateDevice(device.id, {
                          tenant_id: event.target.value || null,
                          user_approved_limit_php: limit || undefined,
                        })
                      }
                      disabled={isPending}
                      className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-white outline-none focus:border-mint/40"
                    >
                      <option value="" className="bg-surface text-white">Vacant</option>
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id} className="bg-surface text-white">
                          {tenant.full_name || tenant.email}
                        </option>
                      ))}
                    </select>
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
                        className={`h-full rounded-full ${getBudgetToneClasses(progress).bar}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    {device.budget_status && device.budget_status !== "ok" ? (
                      <p className="mt-2 text-[11px] font-semibold text-danger">
                        {device.budget_status === "auto_cutoff" ? "Auto cutoff active" : "100% reached · power on"}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
