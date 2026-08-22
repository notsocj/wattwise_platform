"use client";

import { useEffect, useRef } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { loginOneSignal, logoutOneSignal } from "@/lib/onesignal";

type PreferenceResponse = {
  identity?: { onesignal_external_id?: string };
};

export default function OneSignalIdentityBridge({ appId }: { appId: string | null }) {
  const { user } = useSupabase();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!appId) return;

    const configuredAppId = appId;
    const controller = new AbortController();

    async function syncIdentity() {
      if (!user) {
        if (previousUserId.current) {
          await logoutOneSignal().catch(() => undefined);
          previousUserId.current = null;
        }
        return;
      }

      const response = await fetch("/api/profile/notification-preferences", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) return;

      const payload = (await response.json()) as PreferenceResponse;
      const externalId = payload.identity?.onesignal_external_id;
      if (!externalId || controller.signal.aborted) return;

      await loginOneSignal(configuredAppId, externalId);
      previousUserId.current = user.id;
    }

    void syncIdentity().catch(() => undefined);
    return () => controller.abort();
  }, [appId, user]);

  return null;
}
