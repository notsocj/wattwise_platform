"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Trash2 } from "lucide-react";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import { createClient } from "@/lib/supabase/client";
import { logoutOneSignal } from "@/lib/onesignal";
import type { ShowSettingsToast } from "@/components/settings/settings-types";

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
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isDeleteConfirmed = confirmDelete.trim().toUpperCase() === "DELETE";

  async function sendPasswordReset() {
    setIsSendingReset(true);
    onToast(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      onToast({
        type: "error",
        message: "We could not send the reset email right now. Try again.",
      });
    } else {
      onToast({
        type: "success",
        message: "Password reset email sent.",
      });
    }

    setIsSendingReset(false);
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
    <section className="rounded-xl border border-white/[0.06] bg-surface p-5">
      <h2 className="text-sm font-bold uppercase tracking-wider">
        Account
      </h2>
      <p className="mt-1 text-xs text-white/45">{email}</p>

      <Link
        href="/update-password"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-bold text-white/70 transition-colors hover:border-mint/30 hover:bg-mint/10 hover:text-mint"
      >
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        Update Password
      </Link>

      <button
        type="button"
        onClick={() => void sendPasswordReset()}
        disabled={isSendingReset || isDeleting}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm font-bold text-mint transition-colors hover:bg-mint/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSendingReset ? (
          <>
            <LoadingIndicator size="sm" label="Sending" showLabel={false} />
            Sending reset email...
          </>
        ) : (
          "Send Password Reset Email"
        )}
      </button>

      {canDeleteAccount ? (
        <div className="mt-5 rounded-xl border border-danger/25 bg-danger/10 p-4">
          <div className="flex items-start gap-2">
            <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div>
              <p className="text-sm font-bold text-danger">Delete Account</p>
              <p className="mt-1 text-xs leading-relaxed text-white/55">
                This removes your login, profile, devices, telemetry ownership,
                and cached insights through cascading database deletes.
              </p>
            </div>
          </div>
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
            className="mt-3 w-full rounded-lg border border-danger/30 bg-black/10 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-danger"
          />
          <button
            type="button"
            onClick={() => void deleteAccount()}
            disabled={isDeleting || !isDeleteConfirmed}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-sm font-bold text-danger transition-colors hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? (
              <>
                <LoadingIndicator size="sm" label="Deleting" showLabel={false} />
                Deleting...
              </>
            ) : (
              "Delete My Account"
            )}
          </button>
          {deleteError ? (
            <p role="alert" className="mt-2 text-xs font-semibold text-danger">
              {deleteError}
            </p>
          ) : null}
          </div>
      ) : null}
    </section>
  );
}
