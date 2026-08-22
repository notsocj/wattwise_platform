"use client";

import { Bell, Mail, Send, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import {
  getBrowserPushCapability,
  isInstalledPwa,
  isIosBrowser,
  loginOneSignal,
  optInOneSignal,
  optOutOneSignal,
  readOneSignalPushCapability,
  type PushCapability,
} from "@/lib/onesignal";
import { createClient } from "@/lib/supabase/client";

type Preferences = {
  budget_push_enabled: boolean;
  budget_email_enabled: boolean;
};

type PreferenceResponse = {
  preferences: Preferences;
  identity: { onesignal_external_id: string };
  availability: { push: boolean; email: string };
};

type Feedback = { type: "success" | "error" | "info"; message: string } | null;

function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-14 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-mint" : "bg-white/15"
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${
          checked ? "translate-x-[28px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function friendlyTestResult(
  channel: "push" | "email",
  status?: string,
  code?: string,
  providerMessage?: string
) {
  if (status === "sent") {
    return channel === "push"
      ? "Test push sent. Check this device's notifications."
      : "Test email sent. Check your inbox and spam folder.";
  }

  if (code === "provider_not_configured") {
    return `${channel === "push" ? "OneSignal" : "Resend"} keys are not configured yet. The app remains safe to use.`;
  }
  if (code === "no_push_subscription") {
    return "OneSignal could not find an active subscription for this browser yet.";
  }
  if (code === "preference_disabled") {
    return `Turn on ${channel === "push" ? "push alerts" : "critical email"} before testing.`;
  }
  if (providerMessage) return providerMessage;
  return `The test ${channel} could not be delivered right now.`;
}

async function readFunctionInvokeError(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : "The notification test could not be completed.";
  const context = error && typeof error === "object" && "context" in error
    ? (error as { context?: unknown }).context
    : null;
  if (!context || typeof context !== "object" || !("clone" in context)) return fallback;

  try {
    const response = (context as Response).clone();
    const payload = (await response.json()) as { error?: string; retry_after_seconds?: number };
    if (payload.retry_after_seconds) {
      return `Please wait ${payload.retry_after_seconds} second${payload.retry_after_seconds === 1 ? "" : "s"} before testing again.`;
    }
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export default function NotificationSettings({ appId }: { appId: string | null }) {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [externalId, setExternalId] = useState<string | null>(null);
  const [capability, setCapability] = useState<PushCapability>(() =>
    getBrowserPushCapability()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [pending, setPending] = useState<"push" | "email" | "test-push" | "test-email" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const iosNeedsInstall = isIosBrowser() && !isInstalledPwa();
  const pushAvailable = Boolean(appId) && capability.supported && capability.secureContext;
  const pushEnabledOnThisBrowser = Boolean(
    preferences?.budget_push_enabled && capability.subscribed
  );

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/profile/notification-preferences", {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as Partial<PreferenceResponse> & {
          error?: string;
        };
        if (!response.ok || !payload.preferences || !payload.identity) {
          throw new Error(payload.error ?? "Notification settings are unavailable.");
        }

        setPreferences(payload.preferences);
        setExternalId(payload.identity.onesignal_external_id);

        if (appId && capability.supported && capability.secureContext) {
          await loginOneSignal(appId, payload.identity.onesignal_external_id);
          const nextCapability = await readOneSignalPushCapability(appId);
          if (!controller.signal.aborted) setCapability(nextCapability);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setFeedback({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Notification settings are unavailable right now.",
          });
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [appId, capability.secureContext, capability.supported]);

  async function patchPreference(update: Partial<Preferences>): Promise<Preferences> {
    const response = await fetch("/api/profile/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    const payload = (await response.json().catch(() => ({}))) as Partial<PreferenceResponse> & {
      error?: string;
    };
    if (!response.ok || !payload.preferences) {
      throw new Error(payload.error ?? "We could not save that notification setting.");
    }
    setPreferences(payload.preferences);
    return payload.preferences;
  }

  async function changePush(enabled: boolean) {
    if (!appId || !externalId || !preferences) return;
    setPending("push");
    setFeedback(null);

    try {
      if (enabled) {
        if (iosNeedsInstall) {
          setFeedback({
            type: "info",
            message: "On iPhone, add WattWise to your Home Screen first, then enable alerts from the installed app.",
          });
          return;
        }
        if (!capability.supported || !capability.secureContext) {
          setFeedback({
            type: "error",
            message: "This browser cannot receive web push notifications in its current mode.",
          });
          return;
        }
        if (capability.permission === "denied") {
          setFeedback({
            type: "error",
            message: "Notifications are blocked in browser settings. Allow them there, then try again.",
          });
          return;
        }

        const nextCapability = await optInOneSignal(appId, externalId);
        await patchPreference({ budget_push_enabled: true });
        setCapability(nextCapability);
        setFeedback({ type: "success", message: "Budget push alerts are enabled on this browser." });
      } else {
        await patchPreference({ budget_push_enabled: false });
        const nextCapability = await optOutOneSignal(appId);
        setCapability(nextCapability);
        setFeedback({ type: "success", message: "Budget push alerts are turned off." });
      }
    } catch (error) {
      setCapability(getBrowserPushCapability());
      const permissionDenied =
        error instanceof Error && error.message === "permission_not_granted";
      setFeedback({
        type: "error",
        message: permissionDenied
          ? "Notification permission was not granted. You can try again anytime."
          : "We could not update push alerts right now. Please try again.",
      });
    } finally {
      setPending(null);
    }
  }

  async function changeEmail(enabled: boolean) {
    if (!preferences) return;
    setPending("email");
    setFeedback(null);
    try {
      await patchPreference({ budget_email_enabled: enabled });
      setFeedback({
        type: "success",
        message: enabled ? "Critical budget emails are enabled." : "Critical budget emails are turned off.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "We could not update email alerts right now.",
      });
    } finally {
      setPending(null);
    }
  }

  async function sendTest(channel: "push" | "email") {
    setPending(channel === "push" ? "test-push" : "test-email");
    setFeedback(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("dispatch-budget-notifications", {
        body: { mode: "test", channel },
      });
      if (error) throw new Error(await readFunctionInvokeError(error));

      const result = (data ?? {}) as {
        status?: string;
        code?: string;
        message?: string;
        error?: string;
      };
      if (result.error) throw new Error(result.error);
      const sent = result.status === "sent";
      setFeedback({
        type: sent ? "success" : "info",
        message: friendlyTestResult(channel, result.status, result.code, result.message),
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error
          ? error.message
          : "The notification test could not be completed.",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-mint" />
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider">Budget Notifications</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/45">
            50% stays in-app. At 80% WattWise can send a push; critical 100% events can also send email.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <LoadingIndicator size="sm" label="Loading notification settings" />
        </div>
      ) : preferences ? (
        <div className="mt-4 flex flex-col gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
                <div>
                  <p className="text-sm font-bold">Push alerts at 80% and 100%</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                    Permission is requested only when you turn this on.
                  </p>
                </div>
              </div>
              <Toggle
                checked={pushEnabledOnThisBrowser}
                disabled={pending !== null || !pushAvailable}
                label="Budget push notifications"
                onChange={(value) => void changePush(value)}
              />
            </div>

            {!appId ? (
              <p className="mt-3 text-[11px] text-naku">OneSignal App ID has not been added yet.</p>
            ) : !capability.supported ? (
              <p className="mt-3 text-[11px] text-naku">This browser does not support web push.</p>
            ) : !capability.secureContext ? (
              <p className="mt-3 text-[11px] text-naku">Push requires HTTPS or localhost.</p>
            ) : iosNeedsInstall ? (
              <p className="mt-3 text-[11px] text-naku">
                iPhone: Share → Add to Home Screen, open the installed WattWise app, then enable alerts.
              </p>
            ) : capability.permission === "denied" ? (
              <p className="mt-3 text-[11px] text-naku">Blocked in browser settings.</p>
            ) : preferences.budget_push_enabled && !capability.subscribed ? (
              <p className="mt-3 text-[11px] text-naku">Preference is on, but this browser is not subscribed yet.</p>
            ) : null}

            <button
              type="button"
              disabled={
                pending !== null ||
                !pushEnabledOnThisBrowser ||
                !capability.subscribed ||
                !pushAvailable
              }
              onClick={() => void sendTest("push")}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-mint/25 bg-mint/10 px-3 py-2 text-xs font-bold text-mint disabled:cursor-not-allowed disabled:opacity-45"
            >
              {pending === "test-push" ? (
                <LoadingIndicator size="sm" label="Sending" showLabel={false} />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send Test Push
            </button>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
                <div>
                  <p className="text-sm font-bold">Critical email at 100%</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                    Enabled by default for approval-required and automatic-cutoff events.
                  </p>
                </div>
              </div>
              <Toggle
                checked={preferences.budget_email_enabled}
                disabled={pending !== null}
                label="Critical budget email notifications"
                onChange={(value) => void changeEmail(value)}
              />
            </div>

            <button
              type="button"
              disabled={pending !== null || !preferences.budget_email_enabled}
              onClick={() => void sendTest("email")}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-mint/25 bg-mint/10 px-3 py-2 text-xs font-bold text-mint disabled:cursor-not-allowed disabled:opacity-45"
            >
              {pending === "test-email" ? (
                <LoadingIndicator size="sm" label="Sending" showLabel={false} />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send Test Email
            </button>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <p
          role={feedback.type === "error" ? "alert" : "status"}
          className={`mt-3 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
            feedback.type === "success"
              ? "border-mint/25 bg-mint/10 text-mint"
              : feedback.type === "error"
                ? "border-danger/25 bg-danger/10 text-danger"
                : "border-naku/25 bg-naku/10 text-naku"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </section>
  );
}
