"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for destructive or safety-critical actions only. */
  tone?: "default" | "danger";
};

type PendingConfirm = ConfirmOptions & { resolve: (confirmed: boolean) => void };

/**
 * In-app replacement for window.confirm:
 *   const { confirm, confirmDialog } = useConfirmDialog();
 *   if (!(await confirm({ title: "Turn off?" }))) return;
 *   ...render {confirmDialog} somewhere in the component.
 */
export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => setPending({ ...options, resolve }));
  }

  function settle(confirmed: boolean) {
    pending?.resolve(confirmed);
    setPending(null);
  }

  const confirmDialog = pending ? <ConfirmDialog {...pending} onSettle={settle} /> : null;

  return { confirm, confirmDialog };
}

function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onSettle,
}: ConfirmOptions & { onSettle: (confirmed: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onSettleRef = useRef(onSettle);

  useEffect(() => {
    onSettleRef.current = onSettle;
  });

  // Focus the safe choice once on open; Escape cancels.
  useEffect(() => {
    cancelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onSettleRef.current(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-4 pb-[max(16px,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center"
      onClick={(event) => {
        // Portal events still bubble through the React tree (e.g. a parent
        // <Link> card), so contain every click here.
        event.stopPropagation();
        event.preventDefault();
        if (event.target === event.currentTarget) onSettle(false);
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? "confirm-dialog-description" : undefined}
        className="w-full max-w-[398px] rounded-2xl border border-white/10 bg-surface p-5 shadow-2xl"
      >
        <h2 id="confirm-dialog-title" className="text-base font-bold text-white">
          {title}
        </h2>
        {description ? (
          <div id="confirm-dialog-description" className="mt-2 text-sm leading-relaxed text-white/60">
            {description}
          </div>
        ) : null}
        <div className="mt-5 flex gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onSettle(false)}
            className="h-11 flex-1 rounded-xl border border-white/10 text-sm font-semibold text-white/80 transition-colors hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onSettle(true)}
            className={`h-11 flex-1 rounded-xl text-sm font-bold transition-colors ${
              tone === "danger"
                ? "bg-danger text-white hover:bg-danger/90"
                : "bg-mint text-ink hover:bg-mint/90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
