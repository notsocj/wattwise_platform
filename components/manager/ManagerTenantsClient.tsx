"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, UserPlus } from "lucide-react";
import ManagerSelect from "@/components/manager/ManagerSelect";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import type { ManagerDevice, ManagerTenant } from "@/lib/manager-data";

type ManagerTenantsClientProps = {
  devices: ManagerDevice[];
  tenants: ManagerTenant[];
};

function formatPeso(value: number): string {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ManagerTenantsClient({
  devices,
  tenants,
}: ManagerTenantsClientProps) {
  const router = useRouter();
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [credential, setCredential] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [copiedCredential, setCopiedCredential] = useState(false);
  const roomOptions = [
    { value: "", label: "No room assigned" },
    ...devices.map((device) => ({
      value: device.id,
      label: device.device_name,
    })),
  ];

  async function createTenant() {
    setPending("tenant");
    setMessage(null);
    setCredential(null);
    setCopiedCredential(false);

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

  async function copyCredential() {
    if (!credential) {
      return;
    }

    const text = `WattWise tenant login\nEmail: ${credential.email}\nTemporary password: ${credential.password}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedCredential(true);
      window.setTimeout(() => setCopiedCredential(false), 2200);
    } catch {
      setMessage("Could not copy credentials. Please copy them manually.");
    }
  }

  async function assignTenant(tenantId: string, nextDeviceId: string) {
    setPending(tenantId);
    setMessage(null);

    const currentDevice = devices.find((device) => device.tenant_id === tenantId);

    try {
      if (currentDevice && currentDevice.id !== nextDeviceId) {
        const clearRes = await fetch(`/api/manager/devices/${currentDevice.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenant_id: null }),
        });

        if (!clearRes.ok) {
          const payload = await clearRes.json().catch(() => ({}));
          setMessage(
            typeof payload.error === "string"
              ? payload.error
              : "Failed to clear the current tenant assignment."
          );
          return;
        }
      }

      if (nextDeviceId) {
        const targetDevice = devices.find((device) => device.id === nextDeviceId);
        const assignRes = await fetch(`/api/manager/devices/${nextDeviceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: tenantId,
            user_approved_limit_php:
              targetDevice && targetDevice.user_approved_limit_php > 0
                ? targetDevice.user_approved_limit_php
                : undefined,
          }),
        });

        if (!assignRes.ok) {
          const payload = await assignRes.json().catch(() => ({}));
          setMessage(
            typeof payload.error === "string"
              ? payload.error
              : "Failed to assign tenant to room."
          );
          return;
        }
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
        <div className="rounded-xl border border-mint/35 bg-mint/10 p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-mint">Tenant credentials generated</p>
              <p className="mt-1 break-all text-white/70">
                Email: {credential.email}
              </p>
              <p className="break-all text-white/70">
                Temporary password: {credential.password}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyCredential()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-mint/30 bg-mint/10 px-3 py-2 text-xs font-bold text-mint transition-colors hover:bg-mint/15"
            >
              {copiedCredential ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copiedCredential ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}

      <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-mint" />
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Create Tenant
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
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
            {pending === "tenant" ? (
              <LoadingIndicator
                size="sm"
                showLabel={false}
                spinnerClassName="border-black/30 border-t-black"
              />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Generate Login
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider">
          Tenant Assignments
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          Move tenants between rooms without giving them edit access to limits or
          relay controls.
        </p>

        <div className="mt-4 space-y-3">
          {tenants.length === 0 ? (
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/50">
              Create a tenant account to start assigning renters to room meters.
            </p>
          ) : (
            tenants.map((tenant) => {
              const assignedDevice = devices.find(
                (device) => device.tenant_id === tenant.id
              );
              const isPending = pending === tenant.id;

              return (
                <div
                  key={tenant.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">
                        {tenant.full_name || tenant.email}
                      </p>
                      <p className="mt-1 truncate text-xs text-white/45">
                        {tenant.email}
                      </p>
                      {tenant.must_update_password ? (
                        <p className="mt-2 text-[11px] font-semibold text-naku">
                          Must update temporary password
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/55">
                      {assignedDevice ? "Assigned" : "Vacant"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
                    <ManagerSelect
                      value={assignedDevice?.id ?? ""}
                      disabled={isPending}
                      options={roomOptions}
                      ariaLabel={`Assign room for ${tenant.full_name || tenant.email}`}
                      onChange={(nextDeviceId) =>
                        void assignTenant(tenant.id, nextDeviceId)
                      }
                    />
                    <div className="rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2 text-xs text-white/50">
                      {assignedDevice
                        ? `${formatPeso(assignedDevice.spend_php)} / ${formatPeso(
                            assignedDevice.user_approved_limit_php
                          )}`
                        : "No active room spend"}
                    </div>
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
