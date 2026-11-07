"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function CancelAutomationButton({ deviceId, automationId }: { deviceId: string; automationId: string }) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    const confirmed = await confirm({
      title: "Cancel this turn-off?",
      description: "The device keeps running as normal.",
      confirmLabel: "Cancel turn-off",
      cancelLabel: "Keep it",
    });
    if (!confirmed) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/devices/${deviceId}/automations/${automationId}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Couldn't cancel it. Try again.");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't cancel it. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        onClick={cancel}
        disabled={pending}
        className="inline-flex h-8 items-center rounded-lg border border-fg/10 px-3 text-xs font-semibold text-fg/70 transition-[color,border-color,scale] duration-150 ease-out hover:border-fg/20 hover:text-fg active:scale-[0.97] disabled:opacity-60"
      >
        {pending ? "Cancelling..." : "Cancel"}
      </button>
      {error ? <p role="alert" className="mt-1 max-w-48 text-[11px] text-danger">{error}</p> : null}
      {confirmDialog}
    </div>
  );
}
