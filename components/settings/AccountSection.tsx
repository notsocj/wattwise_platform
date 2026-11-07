"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, KeyRound, LogOut, Mail, Smartphone, Trash2 } from "@/components/ui/icons";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useLogout } from "@/components/ui/LogoutButton";
import { SETTINGS_ACTION_ROW, SettingsGroup } from "@/components/settings/SettingsGroup";
import { createClient } from "@/lib/supabase/client";
import { logoutOneSignal } from "@/lib/onesignal";
import type { ShowSettingsToast } from "@/components/settings/settings-types";

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-fg/15 border-t-accent" aria-hidden="true" />;
}

function RowIcon({ icon: Icon, tone = "default" }: { icon: typeof KeyRound; tone?: "default" | "danger" }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
        tone === "danger" ? "bg-danger/10 text-danger" : "bg-mint/10 text-accent"
      }`}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </span>
  );
}

export default function AccountSection({
  email,
  canDeleteAccount,
  onToast,
}: {
  email: string;
  canDeleteAccount: boolean;
  onToast: ShowSettingsToast;
}) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirmDialog();
  const { logout, pending: logoutPending } = useLogout();
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isDeleteConfirmed = confirmDelete.trim().toUpperCase() === "DELETE";
  const busy = isDeleting || logoutPending !== null;

  async function sendPasswordReset() {
    setIsSendingReset(true);
    onToast(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    onToast(
      error
        ? { type: "error", message: "We could not send the reset email right now. Try again." }
        : { type: "success", message: `Password reset email sent to ${email}.` }
    );
    setIsSendingReset(false);
  }

  async function confirmLogout(scope: "local" | "global") {
    const confirmed = await confirm(
      scope === "local"
        ? { title: "Log out of WattWise?", description: "You can log back in any time with your email and password.", confirmLabel: "Log out" }
        : {
            title: "Log out of all devices?",
            description: "This ends your session on every phone and browser, including this one.",
            confirmLabel: "Log out everywhere",
            tone: "danger",
          }
    );
    if (confirmed) await logout(scope);
  }

  async function deleteAccount() {
    if (!isDeleteConfirmed) {
      setDeleteError("Type DELETE to confirm account deletion.");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/account", { method: "DELETE" });

      if (!res.ok) {
        setDeleteError("We could not delete your account right now. Try again in a moment.");
        setIsDeleting(false);
        return;
      }

      // Only drop this browser's push identity once the account is gone.
      await logoutOneSignal().catch(() => undefined);
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/onboarding");
      router.refresh();
    } catch {
      setDeleteError("Network error while deleting your account. Check your connection and retry.");
      setIsDeleting(false);
    }
  }

  return (
    <>
      <SettingsGroup title="Account">
        <Link href="/update-password" className={SETTINGS_ACTION_ROW}>
          <RowIcon icon={KeyRound} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-fg">Change password</span>
            <span className="mt-0.5 block text-xs text-fg/50">Set a new password for this account</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-fg/30" aria-hidden="true" />
        </Link>

        <button type="button" onClick={() => void sendPasswordReset()} disabled={isSendingReset || busy} className={SETTINGS_ACTION_ROW}>
          <RowIcon icon={Mail} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-fg">Email me a reset link</span>
            <span className="mt-0.5 block truncate text-xs text-fg/50">{email}</span>
          </span>
          {isSendingReset ? <Spinner /> : <ChevronRight className="h-4 w-4 shrink-0 text-fg/30" aria-hidden="true" />}
        </button>

        <button type="button" onClick={() => void confirmLogout("local")} disabled={busy} className={SETTINGS_ACTION_ROW}>
          <RowIcon icon={LogOut} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-fg">{logoutPending === "local" ? "Logging out..." : "Log out"}</span>
            <span className="mt-0.5 block text-xs text-fg/50">Sign out of WattWise on this device</span>
          </span>
          {logoutPending === "local" ? <Spinner /> : null}
        </button>

        <button type="button" onClick={() => void confirmLogout("global")} disabled={busy} className={SETTINGS_ACTION_ROW}>
          <RowIcon icon={Smartphone} tone="danger" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-danger">
              {logoutPending === "global" ? "Logging out everywhere..." : "Log out of all devices"}
            </span>
            <span className="mt-0.5 block text-xs text-fg/50">Use this if you lost a phone or shared your login</span>
          </span>
          {logoutPending === "global" ? <Spinner /> : null}
        </button>
      </SettingsGroup>

      {canDeleteAccount ? (
        <SettingsGroup title="Danger zone" tone="danger">
          <button
            type="button"
            onClick={() => setShowDelete((value) => !value)}
            aria-expanded={showDelete}
            aria-controls="delete-account-panel"
            className={SETTINGS_ACTION_ROW}
          >
            <RowIcon icon={Trash2} tone="danger" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-danger">Delete account</span>
              <span className="mt-0.5 block text-xs text-fg/50">Permanently remove your account and devices</span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-fg/30 transition-[rotate] duration-200 ease-out ${showDelete ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {showDelete ? (
            <div
              id="delete-account-panel"
              className="px-4 pb-4 pt-3 transition-[opacity,translate] duration-200 ease-out starting:-translate-y-1 starting:opacity-0"
            >
              <p className="text-xs leading-relaxed text-fg/55">
                This removes your login, profile, devices, and saved insights. It can&apos;t be undone.
              </p>
              <label htmlFor="confirm-delete-account" className="sr-only">
                Type DELETE to confirm account deletion
              </label>
              <input
                id="confirm-delete-account"
                value={confirmDelete}
                onChange={(event) => {
                  setConfirmDelete(event.target.value);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                autoComplete="off"
                placeholder="Type DELETE to confirm"
                className="mt-3 h-11 w-full rounded-full border border-danger/30 bg-shade/10 px-4 text-sm text-fg outline-none transition-colors placeholder:text-fg/30 focus:border-danger"
              />
              <button
                type="button"
                onClick={() => void deleteAccount()}
                disabled={isDeleting || !isDeleteConfirmed}
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-danger px-4 text-sm font-bold text-white transition-[opacity,scale] duration-150 ease-out enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDeleting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                    Deleting...
                  </>
                ) : (
                  "Delete my account"
                )}
              </button>
              {deleteError ? (
                <p role="alert" className="mt-2 text-xs font-semibold text-danger">
                  {deleteError}
                </p>
              ) : null}
            </div>
          ) : null}
        </SettingsGroup>
      ) : null}

      {confirmDialog}
    </>
  );
}
