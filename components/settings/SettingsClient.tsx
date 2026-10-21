"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import NotificationSettings from "@/components/settings/NotificationSettings";
import AccountSection from "@/components/settings/AccountSection";
import AppearanceSection from "@/components/settings/AppearanceSection";
import AutoShutoffSection from "@/components/settings/AutoShutoffSection";
import BillingCycleSection from "@/components/settings/BillingCycleSection";
import type { SettingsDevice, SettingsToast } from "@/components/settings/settings-types";

type SettingsClientProps = {
  billingCycleStartDay: number;
  email: string;
  role: string;
  devices: SettingsDevice[];
  oneSignalAppId: string | null;
};

export default function SettingsClient({
  billingCycleStartDay,
  email,
  role,
  devices,
  oneSignalAppId,
}: SettingsClientProps) {
  const [toast, setToast] = useState<SettingsToast | null>(null);
  const canManageHomeSettings = role !== "tenant";

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <>
      {canManageHomeSettings ? (
        <BillingCycleSection
          billingCycleStartDay={billingCycleStartDay}
          onToast={setToast}
        />
      ) : null}

      <AppearanceSection />

      <NotificationSettings appId={oneSignalAppId} />

      {canManageHomeSettings ? (
        <AutoShutoffSection devices={devices} onToast={setToast} />
      ) : null}

      <AccountSection
        email={email}
        canDeleteAccount={canManageHomeSettings}
        onToast={setToast}
      />

      {toast ? (
        <div
          className={`fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-97.5 -translate-x-1/2 rounded-xl border px-4 py-3 backdrop-blur-sm ${
            toast.type === "success"
              ? "border-mint/35 bg-mint/10"
              : "border-danger/35 bg-danger/10"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-mint" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
            )}
            <p
              className={`text-sm font-semibold ${
                toast.type === "success" ? "text-mint" : "text-danger"
              }`}
            >
              {toast.message}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
