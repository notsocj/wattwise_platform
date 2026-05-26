"use client";

import { Trash2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AccountDeletionCardProps = {
  className?: string;
};

const CONFIRMATION_TEXT = "DELETE";

export default function AccountDeletionCard({
  className,
}: AccountDeletionCardProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isConfirmed = useMemo(
    () => confirmationInput.trim().toUpperCase() === CONFIRMATION_TEXT,
    [confirmationInput]
  );

  function openPanel() {
    setIsOpen(true);
    setErrorMessage(null);
  }

  function closePanel() {
    if (isDeleting) {
      return;
    }

    setIsOpen(false);
    setConfirmationInput("");
    setErrorMessage(null);
  }

  async function handleDeleteAccount(event: React.FormEvent) {
    event.preventDefault();
    if (isDeleting || !isConfirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: CONFIRMATION_TEXT }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setErrorMessage(body?.error ?? "Unable to delete account right now.");
      setIsDeleting(false);
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div
      className={
        className ??
        "rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur"
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-danger" aria-hidden="true" />
            <h3 className="text-sm font-semibold tracking-wide text-white">
              Account Deletion
            </h3>
          </div>
          <p className="mt-2 text-xs text-white/60">
            This permanently deletes your account and energy history. This action cannot
            be undone.
          </p>
        </div>
        <button
          type="button"
          onClick={openPanel}
          className="inline-flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-danger transition-colors hover:bg-danger/20"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete Account
        </button>
      </div>

      {isOpen ? (
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-base/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
            Data Deletion Policy
          </p>
          <ul className="mt-2 space-y-2 text-xs text-white/60">
            <li>
              We immediately delete your profile, paired devices, AI insights, and
              energy logs from the primary database.
            </li>
            <li>
              Your authentication account is removed right away, so logins stop
              immediately.
            </li>
            <li>
              Managed infrastructure backups may retain encrypted snapshots for a
              limited time for disaster recovery before they are purged automatically.
            </li>
          </ul>

          <form onSubmit={handleDeleteAccount} className="mt-4">
            <label
              htmlFor="delete-account-confirmation"
              className="block text-[11px] font-semibold uppercase tracking-wider text-white/50"
            >
              Type {CONFIRMATION_TEXT} to confirm
            </label>
            <input
              id="delete-account-confirmation"
              type="text"
              value={confirmationInput}
              onChange={(event) => setConfirmationInput(event.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-danger/50"
            />

            {errorMessage ? (
              <p className="mt-2 text-xs text-danger">{errorMessage}</p>
            ) : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closePanel}
                disabled={isDeleting}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/70 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isDeleting || !isConfirmed}
                className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-danger transition-colors hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
