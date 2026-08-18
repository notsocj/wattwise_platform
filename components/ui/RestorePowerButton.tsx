"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Power } from "lucide-react";

export default function RestorePowerButton({ deviceId }: { deviceId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    if (!window.confirm("Restore power to this appliance now?")) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/devices/${deviceId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          typeof payload.error === "string"
            ? payload.error
            : "Power could not be restored."
        );
        return;
      }
      router.refresh();
    } catch {
      setError("Network error while restoring power.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-danger/30 bg-danger/10 p-4">
      <p className="text-sm font-bold text-danger">Automatic cutoff active</p>
      <p className="mt-1 text-xs text-white/60">
        WattWise will not restore this appliance automatically. Raise its limit or
        disable automatic shutoff first if the limit is still reached.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => void restore()}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-danger px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        <Power className="h-4 w-4" />
        {pending ? "Restoring..." : "Restore Power"}
      </button>
      {error ? <p className="mt-2 text-xs font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
