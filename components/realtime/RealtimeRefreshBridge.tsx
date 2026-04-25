"use client";

import { useEffect, useMemo } from "react";
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

  const normalizedKeys = useMemo(
    () =>
      Array.from(
        new Set(
          deviceKeys
            .map((key) => key.trim())
            .filter((key) => key.length > 0)
        )
      ),
    [deviceKeys]
  );

  useEffect(() => {
    if (normalizedKeys.length === 0) {
      return;
    }

    const supabase = createClient();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let disposed = false;
    let lastRefreshAt = 0;

    const scheduleRefresh = () => {
      if (disposed) {
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

    return () => {
      disposed = true;

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
  }, [normalizedKeys, pollMs, router, throttleMs]);

  return null;
}