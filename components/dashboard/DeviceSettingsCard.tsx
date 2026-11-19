"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Settings, Trash2 } from "@/components/ui/icons";
import { CARD, CardHeader } from "@/components/ui/Card";
import FormAlert from "@/components/ui/FormAlert";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import SubmitButton, { type SubmitStatus } from "@/components/ui/SubmitButton";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { APPLIANCE_OPTIONS, ApplianceDetailField } from "@/components/ui/add-appliance/ApplianceTypeStep";
import { DEVICE_NAME_MAX_LENGTH } from "@/lib/device-edit";

/** Owner-only card on the Device page: rename, change type, or remove the unit. */
export default function DeviceSettingsCard({
  deviceId,
  name,
  applianceType,
  applianceDetail,
  macAddress,
}: {
  deviceId: string;
  name: string;
  applianceType: string | null;
  applianceDetail: string | null;
  macAddress: string;
}) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [draftName, setDraftName] = useState(name);
  const [draftType, setDraftType] = useState(applianceType);
  const [draftDetail, setDraftDetail] = useState(applianceDetail ?? "");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = draftName.trim();
  const needsDetail = draftType === "other";
  const changed =
    trimmed !== name ||
    draftType !== applianceType ||
    (needsDetail && draftDetail.trim() !== (applianceDetail ?? ""));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) {
      setError("Give this unit a name.");
      return;
    }
    if (needsDetail && !draftDetail.trim()) {
      setError("Tell us what this appliance is, for example Electric fan.");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_name: trimmed,
          ...(draftType ? { appliance_type: draftType, appliance_detail: needsDetail ? draftDetail : null } : {}),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof payload.error === "string" ? payload.error : "We couldn't save the changes. Try again.");
        setStatus("idle");
        return;
      }
      setDraftName(payload.device?.device_name ?? trimmed);
      setStatus("success");
      router.refresh();
      window.setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setError("Network error. Check your connection and try again.");
      setStatus("idle");
    }
  }

  async function remove() {
    const confirmed = await confirm({
      title: `Remove ${name}?`,
      description:
        "This deletes the unit and all of its readings, budget history, and scheduled turn-offs. It can't be undone. You can add the hardware again later with its MAC address.",
      confirmLabel: "Remove unit",
      tone: "danger",
    });
    if (!confirmed) return;

    setRemoving(true);
    setError(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof payload.error === "string" ? payload.error : "We couldn't remove this unit. Try again.");
        setRemoving(false);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
      setRemoving(false);
    }
  }

  const busy = status !== "idle" || removing;

  return (
    <section className={`${CARD} p-5 lg:p-6`}>
      <div className="mb-4">
        <CardHeader icon={Settings} title="Unit settings" />
      </div>

      <form onSubmit={save} noValidate>
        <FormAlert message={error} />

        <label htmlFor="device-settings-name" className="mb-1.5 block text-xs font-medium text-fg/60">
          Name
        </label>
        <input
          id="device-settings-name"
          value={draftName}
          maxLength={DEVICE_NAME_MAX_LENGTH}
          disabled={busy}
          onChange={(event) => {
            setDraftName(event.target.value);
            setError(null);
          }}
          className="h-12 w-full rounded-full border border-fg/10 bg-shade/10 px-4 text-sm text-fg placeholder:text-fg/30 outline-none transition-colors duration-150 ease-out focus:border-mint/40 disabled:opacity-60"
        />

        <p id="device-settings-type-label" className="mb-1.5 mt-4 text-xs font-medium text-fg/60">
          Appliance type
        </p>
        <div role="group" aria-labelledby="device-settings-type-label" className="grid grid-cols-4 gap-2">
          {APPLIANCE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = draftType === option.type;
            return (
              <button
                key={option.type}
                type="button"
                aria-pressed={selected}
                disabled={busy}
                onClick={() => setDraftType(option.type)}
                className={`flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-semibold transition-[border-color,background-color,color,scale] duration-150 ease-out enabled:active:scale-[0.97] disabled:opacity-60 ${
                  selected ? "border-mint bg-mint/5 text-fg" : "border-fg/10 bg-fg/[0.03] text-fg/60 hover:border-fg/20"
                }`}
              >
                <Icon className={`h-5 w-5 ${selected ? "text-accent" : "text-fg/50"}`} aria-hidden="true" />
                {option.label}
              </button>
            );
          })}
        </div>

        {needsDetail ? (
          <div className="mt-4">
            <ApplianceDetailField
              id="device-settings-detail"
              value={draftDetail}
              error={undefined}
              disabled={busy}
              onChange={(value) => {
                setDraftDetail(value);
                setError(null);
              }}
            />
          </div>
        ) : null}

        <p className="mt-4 text-xs text-fg/50">
          MAC address <span className="font-mono text-fg/70">{macAddress}</span>
        </p>

        <SubmitButton
          status={status}
          idleLabel="Save changes"
          loadingLabel="Saving…"
          successLabel="Saved"
          disabled={!changed || !trimmed || (needsDetail && !draftDetail.trim()) || removing}
          className="mt-5"
        />
      </form>

      <div className="mt-5 border-t border-fg/[0.06] pt-4">
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          className="flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left transition-[opacity,scale] duration-150 ease-out enabled:active:scale-[0.99] disabled:opacity-60"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
            {removing ? <LoadingIndicator size="sm" showLabel={false} /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-danger">{removing ? "Removing…" : "Remove unit"}</span>
            <span className="mt-0.5 block text-xs text-fg/50">Deletes this unit and its readings from your account</span>
          </span>
        </button>
      </div>
      {confirmDialog}
    </section>
  );
}
