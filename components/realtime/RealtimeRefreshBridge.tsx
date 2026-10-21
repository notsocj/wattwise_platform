"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type RealtimeRefreshBridgeProps = {
  deviceKeys: string[];
  throttleMs?: number;
  pollMs?: number;
};

const DEFAULT_THROTTLE_MS = 1200;
const DEFAULT_POLL_MS = 0;

function sanitizeChannelKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
}

export default function RealtimeRefreshBridge({
  deviceKeys,
  throttleMs = DEFAULT_THROTTLE_MS,
  pollMs = DEFAULT_POLL_MS,
}: RealtimeRefreshBridgeProps) {
  const router = useRouter();

  // A string key keeps the subscription stable across router.refresh(), which
  // hands this component a new array every time.
  const keySignature = Array.from(
    new Set(deviceKeys.map((key) => key.trim()).filter((key) => key.length > 0))
  ).join("|");

  useEffect(() => {
    const normalizedKeys = keySignature ? keySignature.split("|") : [];
    if (normalizedKeys.length === 0) {
      return;
    }

    const supabase = createClient();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let disposed = false;
    let lastRefreshAt = 0;
    let missedWhileHidden = false;

    const scheduleRefresh = () => {
      if (disposed) {
        return;
      }

      // Hidden tabs skip refreshes and catch up once when shown again.
      if (document.visibilityState === "hidden") {
        missedWhileHidden = true;
        return;
      }

      const now = Date.now();
      const elapsed = now - lastRefreshAt;

      if (elapsed >= throttleMs) {
        lastRefreshAt = now;
        router.refresh();
        return;
      }

      if (timeoutId !== null) {
        return;
      }

      timeoutId = setTimeout(() => {
        timeoutId = null;

        if (disposed) {
          return;
        }

        lastRefreshAt = Date.now();
        router.refresh();
      }, throttleMs - elapsed);
    };

    const channels = normalizedKeys.map((key, index) => {
      const channelName = `energy-live-${sanitizeChannelKey(key)}-${index}`;

      return supabase
        .channel(channelName)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "energy_logs",
          filter: `device_id=eq.${key}`,
        }, scheduleRefresh)
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "energy_logs",
          filter: `device_id=eq.${key}`,
        }, scheduleRefresh)
        .subscribe();
    });

    if (pollMs > 0) {
      intervalId = setInterval(scheduleRefresh, pollMs);
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && missedWhileHidden) {
        missedWhileHidden = false;
        scheduleRefresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      if (intervalId !== null) {
        clearInterval(intervalId);
      }

      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [keySignature, pollMs, router, throttleMs]);

  return null;
}