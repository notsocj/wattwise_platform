"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "@/components/ui/icons";
import NotificationSettings from "@/components/settings/NotificationSettings";
import AccountSection from "@/components/settings/AccountSection";
import AppearanceSection from "@/components/settings/AppearanceSection";
import AutoShutoffSection from "@/components/settings/AutoShutoffSection";
import BillingCycleSection from "@/components/settings/BillingCycleSection";
import type { SettingsDevice, SettingsToast } from "@/components/settings/settings-types";

type SettingsClientProps = {
  fullName: string | null;
  billingCycleStartDay: number;
  meralcoMonthlyKwh: number | null;
  email: string;
  role: string;
  devices: SettingsDevice[];
  oneSignalAppId: string | null;
};

const ROLE_LABEL: Record<string, string> = { user: "Homeowner", tenant: "Tenant", manager: "Manager" };

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

export default function SettingsClient({
  fullName,
  billingCycleStartDay,
  meralcoMonthlyKwh,
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

  const displayName = fullName?.trim() || email.split("@")[0];

  return (
    <>
      <div className="flex items-center gap-4 rounded-2xl border border-fg/[0.06] bg-surface p-4">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-mint/15 text-lg font-bold text-accent"
        >
          {initialsOf(displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-fg">{displayName}</p>
          <p className="truncate text-xs text-fg/50">{email}</p>
        </div>
        <span className="shrink-0 rounded-full border border-fg/10 px-2.5 py-1 text-[11px] font-medium text-fg/60">
          {ROLE_LABEL[role] ?? "Member"}
        </span>
      </div>

      {canManageHomeSettings ? (
        <BillingCycleSection
          billingCycleStartDay={billingCycleStartDay}
          meralcoMonthlyKwh={meralcoMonthlyKwh}
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
          className={`fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-97.5 -translate-x-1/2 rounded-xl border px-4 py-3 backdrop-blur-sm transition-[translate,scale,opacity] duration-200 ease-out starting:translate-y-2 starting:opacity-0 lg:bottom-8 lg:left-[calc(50%+var(--app-sidebar,0px)/2)] ${
            toast.type === "success"
              ? "border-mint/35 bg-mint/10"
              : "border-danger/35 bg-danger/10"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
            )}
            <p
              className={`text-sm font-semibold ${
                toast.type === "success" ? "text-accent" : "text-danger"
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
