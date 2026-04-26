"use client";

import { useState } from "react";
import { Power } from "lucide-react";

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
        // Revert on error
        setRelayState(!newState);
      }
    } catch {
      // Revert on network error
      setRelayState(!newState);
    } finally {
      setIsPending(false);
    }
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
          relayState
            ? "bg-mint/15 text-mint hover:bg-mint/25"
            : "bg-white/[0.06] text-white/30 hover:bg-white/10"
        } ${isPending ? "opacity-50" : ""}`}
        title={relayState ? "Relay ON — tap to turn off" : "Relay OFF — tap to turn on"}
      >
        <Power className="w-3.5 h-3.5" />
      </button>
    );
  }

  // Full variant for Device Detail
  return (
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
            <p className="text-[11px] text-white/40 mt-0.5">
              {relayState ? "Relay is ON" : "Relay is OFF"}
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
          } ${isPending ? "opacity-50" : ""}`}
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
  );
}
