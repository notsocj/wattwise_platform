"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Copy, KeyRound, UserPlus, X } from "@/components/ui/icons";
import ManagerSelect from "@/components/manager/ManagerSelect";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getBudgetToneClasses } from "@/lib/budget-policy";
import { formatPeso } from "@/lib/format";
import type { ManagerDevice, ManagerTenant } from "@/lib/manager-data";

type ManagerTenantsClientProps = {
  devices: ManagerDevice[];
  tenants: ManagerTenant[];
};

type Credential = { email: string; password: string };

const FIELD =
  "h-12 w-full rounded-full border border-fg/10 bg-shade/10 px-4 text-sm text-fg outline-none transition-colors duration-150 ease-out placeholder:text-fg/30 focus:border-mint/40";

function Spinner({ dark = false }: { dark?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`h-4 w-4 animate-spin rounded-full border-2 ${dark ? "border-ink/25 border-t-ink" : "border-fg/15 border-t-accent"}`}
    />
  );
}

/** Login details with one Copy button that copies everything the tenant needs. */
function CredentialCard({ credential, title, onClose }: { credential: Credential; title: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = `WattWise tenant login\nEmail: ${credential.email}\nTemporary password: ${credential.password}\nLog in at ${window.location.origin}/login`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard can be blocked; the password stays visible to copy by hand.
    }
  }

  return (
    <div className="rounded-2xl border border-mint/30 bg-mint/[0.07] p-4 transition-[opacity,translate] duration-200 ease-out starting:-translate-y-1 starting:opacity-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-accent">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Hide login details"
          className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg/45 transition-colors hover:text-fg"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-fg/45">Email</dt>
          <dd className="min-w-0 break-all text-fg/80">{credential.email}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-fg/45">Password</dt>
          <dd className="min-w-0 break-all font-mono font-semibold text-fg">{credential.password}</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={() => void copy()}
        className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-mint px-4 text-sm font-bold text-ink transition-[scale] duration-150 ease-out active:scale-[0.97]"
      >
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        {copied ? "Copied" : "Copy login details"}
      </button>
      <p className="mt-2 text-[11px] leading-4 text-fg/50">
        Share this privately. The tenant must set their own password on first login.
      </p>
    </div>
  );
}

export default function ManagerTenantsClient({ devices, tenants }: ManagerTenantsClientProps) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newCredential, setNewCredential] = useState<Credential | null>(null);
  // Reissued temporary passwords, by tenant id; kept only in this page's memory.
  const [reissued, setReissued] = useState<Record<string, Credential>>({});
  const roomOptions = [
    { value: "", label: "No room assigned" },
    ...devices.map((device) => ({ value: device.id, label: device.device_name })),
  ];

  async function createTenant() {
    setPending("tenant");
    setMessage(null);
    setNewCredential(null);
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
      setNewCredential({ email: payload.tenant.email, password: payload.temporary_password });
      setTenantEmail("");
      setTenantName("");
      router.refresh();
    } catch {
      setMessage("Couldn't reach WattWise. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  async function reissuePassword(tenant: ManagerTenant) {
    const confirmed = await confirm({
      title: "Create a new temporary password?",
      description: `${tenant.full_name || tenant.email} hasn't set a password yet. Any temporary password you shared before will stop working.`,
      confirmLabel: "Create password",
    });
    if (!confirmed) return;

    setPending(`password:${tenant.id}`);
    setMessage(null);
    try {
      const res = await fetch(`/api/manager/tenants/${tenant.id}/temporary-password`, { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(typeof payload.error === "string" ? payload.error : "Could not create a temporary password.");
        if (res.status === 409) router.refresh();
        return;
      }
      setReissued((current) => ({
        ...current,
        [tenant.id]: { email: payload.email, password: payload.temporary_password },
      }));
    } catch {
      setMessage("Couldn't reach WattWise. Check your connection and try again.");
    } finally {
      setPending(null);
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
          setMessage(typeof payload.error === "string" ? payload.error : "Failed to clear the current tenant assignment.");
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
              targetDevice && targetDevice.user_approved_limit_php > 0 ? targetDevice.user_approved_limit_php : undefined,
          }),
        });
        if (!assignRes.ok) {
          const payload = await assignRes.json().catch(() => ({}));
          setMessage(typeof payload.error === "string" ? payload.error : "Failed to assign tenant to room.");
          return;
        }
      }

      router.refresh();
    } catch {
      setMessage("Couldn't reach WattWise. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger transition-[opacity,translate] duration-200 ease-out starting:-translate-y-1 starting:opacity-0"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{message}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss" className="shrink-0 text-danger/70 hover:text-danger">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <section className="rounded-2xl border border-fg/[0.06] bg-surface p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mint/10 text-accent">
            <UserPlus className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight">Create a tenant login</h2>
            <p className="text-xs text-fg/45">WattWise makes a temporary password you can share.</p>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void createTenant();
          }}
          className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]"
        >
          <label className="block">
            <span className="sr-only">Tenant email</span>
            <input
              type="email"
              value={tenantEmail}
              onChange={(event) => setTenantEmail(event.target.value)}
              placeholder="Tenant email"
              autoComplete="off"
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className="sr-only">Tenant name or room label</span>
            <input
              value={tenantName}
              onChange={(event) => setTenantName(event.target.value)}
              placeholder="Name or room label (optional)"
              autoComplete="off"
              className={FIELD}
            />
          </label>
          <button
            type="submit"
            disabled={pending !== null || !tenantEmail.trim()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-mint px-5 text-sm font-bold text-ink transition-[opacity,scale] duration-150 ease-out enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending === "tenant" ? <Spinner dark /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
            {pending === "tenant" ? "Creating..." : "Create login"}
          </button>
        </form>

        {newCredential ? (
          <div className="mt-4">
            <CredentialCard credential={newCredential} title="Tenant login created" onClose={() => setNewCredential(null)} />
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-fg/[0.06] bg-surface p-5">
        <h2 className="text-base font-semibold tracking-tight">Tenants</h2>
        <p className="mt-1 text-xs leading-relaxed text-fg/45">
          Move tenants between rooms. Tenants can see their room&apos;s usage but can&apos;t change limits or relays.
        </p>

        <div className="mt-4 space-y-3">
          {tenants.length === 0 ? (
            <p className="rounded-2xl border border-fg/[0.06] bg-fg/[0.03] p-4 text-sm text-fg/50">
              Create a tenant login to start assigning renters to room meters.
            </p>
          ) : (
            tenants.map((tenant) => {
              const assignedDevice = devices.find((device) => device.tenant_id === tenant.id);
              const isAssigning = pending === tenant.id;
              const isIssuing = pending === `password:${tenant.id}`;
              const credential = reissued[tenant.id];
              const limit = assignedDevice?.user_approved_limit_php ?? 0;
              const progress = assignedDevice ? Math.min(assignedDevice.progress_percent, 100) : 0;

              return (
                <article key={tenant.id} className="rounded-2xl border border-fg/[0.06] bg-fg/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{tenant.full_name || tenant.email}</p>
                      <p className="mt-0.5 truncate text-xs text-fg/45">{tenant.email}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        assignedDevice ? "bg-mint/10 text-accent" : "bg-fg/[0.06] text-fg/55"
                      }`}
                    >
                      {assignedDevice ? "Assigned" : "Vacant"}
                    </span>
                  </div>

                  {tenant.must_update_password ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-naku/[0.08] px-3 py-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-naku">
                        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                        Hasn&apos;t set a password yet
                      </p>
                      {credential ? null : (
                        <button
                          type="button"
                          onClick={() => void reissuePassword(tenant)}
                          disabled={pending !== null}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-naku/30 px-3 text-xs font-bold text-naku transition-[background-color,scale,opacity] duration-150 ease-out hover:bg-naku/10 enabled:active:scale-[0.97] disabled:opacity-50"
                        >
                          {isIssuing ? <Spinner /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                          Temporary password
                        </button>
                      )}
                    </div>
                  ) : null}

                  {credential ? (
                    <div className="mt-3">
                      <CredentialCard
                        credential={credential}
                        title="New temporary password"
                        onClose={() =>
                          setReissued((current) => {
                            const next = { ...current };
                            delete next[tenant.id];
                            return next;
                          })
                        }
                      />
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-3">
                    <ManagerSelect
                      value={assignedDevice?.id ?? ""}
                      disabled={isAssigning}
                      options={roomOptions}
                      ariaLabel={`Room for ${tenant.full_name || tenant.email}`}
                      onChange={(nextDeviceId) => void assignTenant(tenant.id, nextDeviceId)}
                    />
                    {assignedDevice ? (
                      <div>
                        <div className="mb-1.5 flex justify-between text-[11px] text-fg/50">
                          <span>{formatPeso(assignedDevice.spend_php)} used this cycle</span>
                          <span>{limit > 0 ? `Limit ${formatPeso(limit)}` : "No hard limit"}</span>
                        </div>
                        <div className="h-2 rounded-full bg-fg/[0.06]">
                          <div
                            className={`h-full rounded-full transition-[width] duration-500 ease-out ${getBudgetToneClasses(assignedDevice.progress_percent).bar}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="px-1 text-xs text-fg/40">Pick a room to start tracking this tenant&apos;s spend.</p>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
      {confirmDialog}
    </div>
  );
}
