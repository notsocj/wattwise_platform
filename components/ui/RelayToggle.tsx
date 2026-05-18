"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Power } from "lucide-react";
import LoadingIndicator from "@/components/ui/LoadingIndicator";

interface RelayToggleProps {
  deviceId: string;
  initialRelayState: boolean;
  variant?: "compact" | "full";
}

export default function RelayToggle({
  deviceId,
  initialRelayState,
  variant = "compact",
}: RelayToggleProps) {
  const [relayState, setRelayState] = useState(initialRelayState);
  const [isPending, setIsPending] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  useEffect(() => {
    if (!errorToast) {
      return;
    }

    const timer = setTimeout(() => {
      setErrorToast(null);
    }, 3500);

    return () => clearTimeout(timer);
  }, [errorToast]);

  async function handleToggle(e: React.MouseEvent) {
    // Prevent parent Link navigation when clicking the toggle
    e.preventDefault();
    e.stopPropagation();

    const newState = !relayState;

    // Optimistic update
    setRelayState(newState);
    setIsPending(true);

    try {
      const res = await fetch(`/api/devices/${deviceId}/relay`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relay_state: newState }),
      });

      if (!res.ok) {
        let errorMessage = "Unable to update relay right now. Try again.";

        try {
          const payload = (await res.json()) as { error?: string };
          if (typeof payload.error === "string" && payload.error.trim().length > 0) {
            errorMessage = payload.error;
          }
        } catch {
          // Ignore parse errors and use fallback copy.
        }

        // Revert on error
        setRelayState(!newState);
        setErrorToast(errorMessage);
      }
    } catch {
      // Revert on network error
      setRelayState(!newState);
      setErrorToast("Network error while updating relay. Check connection and retry.");
    } finally {
      setIsPending(false);
    }
  }

  const toast = errorToast ? (
    <div className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-97.5 -translate-x-1/2 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
        <p className="text-sm font-semibold text-danger">{errorToast}</p>
      </div>
    </div>
  ) : null;

  if (variant === "compact") {
    return (
      <>
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            relayState
              ? "bg-mint/15 text-mint hover:bg-mint/25"
              : "bg-white/[0.06] text-white/30 hover:bg-white/10"
          } ${isPending ? "opacity-60 cursor-not-allowed" : ""}`}
          title={relayState ? "Relay ON - tap to turn off" : "Relay OFF - tap to turn on"}
        >
          {isPending ? (
            <LoadingIndicator
              size="sm"
              label="Updating relay"
              showLabel={false}
              spinnerClassName={
                relayState
                  ? "border-mint/35 border-t-mint"
                  : "border-white/35 border-t-white"
              }
            />
          ) : (
            <Power className="w-3.5 h-3.5" />
          )}
        </button>
        {toast}
      </>
    );
  }

  // Full variant for Device Detail
  return (
    <>
      <div className="rounded-xl bg-white/[0.03] backdrop-blur border border-white/[0.06] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                relayState ? "bg-mint/15" : "bg-white/[0.06]"
              }`}
            >
              <Power
                className={`w-5 h-5 ${relayState ? "text-mint" : "text-white/30"}`}
              />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Power Control
              </h3>
              <p className="mt-0.5 text-[11px] text-white/40">
                {isPending ? (
                  <span className="inline-flex items-center gap-1.5 text-white/70">
                    <LoadingIndicator
                      size="sm"
                      label="Updating relay"
                      showLabel={false}
                      spinnerClassName="border-white/35 border-t-white"
                    />
                    Updating relay...
                  </span>
                ) : relayState ? (
                  "Relay is ON"
                ) : (
                  "Relay is OFF"
                )}
              </p>
            </div>
          </div>

          {/* Toggle switch */}
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              relayState ? "bg-mint" : "bg-white/10"
            } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
            aria-label={relayState ? "Turn relay off" : "Turn relay on"}
          >
            <span
              className={`absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                relayState ? "translate-x-[28px]" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <p className="text-[10px] text-white/30 mt-3">
          Pag naka-off, titigil ang data collection at power sa appliance.
        </p>
      </div>
      {toast}
    </>
  );
}
