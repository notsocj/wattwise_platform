"use client";

import { Mail, Send, Smartphone } from "@/components/ui/icons";
import Switch from "@/components/ui/Switch";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsGroup";
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
    return `${channel === "push" ? "Push alerts" : "Email alerts"} aren't available yet. Budget alerts still appear in the app.`;
  }
  if (code === "no_push_subscription") {
    return "This browser isn't subscribed to push yet. Turn push alerts off and on again, then retry.";
  }
  if (code === "preference_disabled") {
    return `Turn on ${channel === "push" ? "push alerts" : "critical email"} before testing.`;
  }
  if (providerMessage) console.warn("notification test:", providerMessage);
  return `The test ${channel} could not be delivered right now. Try again in a few minutes.`;
}

async function readFunctionInvokeError(error: unknown): Promise<string> {
  if (error instanceof Error) console.warn("notification test:", error.message);
  const fallback = "The notification test could not be completed. Try again in a few minutes.";
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

  const pushNote = !appId
    ? "Push alerts aren't available yet."
    : !capability.supported
      ? "This browser doesn't support web push."
      : !capability.secureContext
        ? "Push needs HTTPS or localhost."
        : iosNeedsInstall
          ? "iPhone: Share, Add to Home Screen, open the installed app, then turn this on."
          : capability.permission === "denied"
            ? "Notifications are blocked in your browser settings."
            : preferences?.budget_push_enabled && !capability.subscribed
              ? "On for your account, but this browser isn't subscribed yet."
              : null;

  return (
    <SettingsGroup
      title="Notifications"
      footer="50% alerts stay in the app. Push goes out at 80% and 100%; email only for critical 100% events."
    >
      {isLoading ? (
        <div className="px-4 py-4">
          <LoadingIndicator size="sm" label="Loading notification settings" />
        </div>
      ) : preferences ? (
        <>
          <SettingsRow
            icon={Smartphone}
            title="Push alerts"
            description={pushNote ? <span className="text-naku">{pushNote}</span> : "When a budget reaches 80% and 100%."}
            control={
              <Switch
                checked={pushEnabledOnThisBrowser}
                disabled={!pushAvailable || (pending !== null && pending !== "push")}
                pending={pending === "push"}
                label="Budget push notifications"
                onChange={(value) => void changePush(value)}
              />
            }
          >
            {pushEnabledOnThisBrowser && capability.subscribed && pushAvailable ? (
              <TestButton sending={pending === "test-push"} disabled={pending !== null} onClick={() => void sendTest("push")}>
                Send a test push
              </TestButton>
            ) : null}
          </SettingsRow>

          <SettingsRow
            icon={Mail}
            title="Critical email"
            description="When a budget reaches 100% and needs your approval or cuts power."
            control={
              <Switch
                checked={preferences.budget_email_enabled}
                disabled={pending !== null && pending !== "email"}
                pending={pending === "email"}
                label="Critical budget email notifications"
                onChange={(value) => void changeEmail(value)}
              />
            }
          >
            {preferences.budget_email_enabled ? (
              <TestButton sending={pending === "test-email"} disabled={pending !== null} onClick={() => void sendTest("email")}>
                Send a test email
              </TestButton>
            ) : null}
          </SettingsRow>
        </>
      ) : null}

      {feedback ? (
        <p
          role={feedback.type === "error" ? "alert" : "status"}
          className={`px-4 py-3 text-xs leading-relaxed transition-opacity duration-200 ease-out starting:opacity-0 ${
            feedback.type === "success"
              ? "bg-mint/[0.06] text-accent"
              : feedback.type === "error"
                ? "bg-danger/[0.06] text-danger"
                : "bg-naku/[0.06] text-naku"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </SettingsGroup>
  );
}

function TestButton({ sending, disabled, onClick, children }: { sending: boolean; disabled: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-fg/10 px-3 text-xs font-semibold text-fg/70 transition-[color,border-color,scale,opacity] duration-150 ease-out hover:border-mint/30 hover:text-accent enabled:active:scale-[0.97] disabled:opacity-50 starting:opacity-0"
    >
      {sending ? (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-fg/15 border-t-accent" aria-hidden="true" />
      ) : (
        <Send className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {sending ? "Sending..." : children}
    </button>
  );
}
