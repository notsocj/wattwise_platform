"use client";

import { AlertTriangle, PencilLine, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LoadingIndicator from "@/components/ui/LoadingIndicator";

type HomeBudgetEditorProps = {
  initialBudget: number;
};

function formatBudget(value: number): string {
  return value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function HomeBudgetEditor({ initialBudget }: HomeBudgetEditorProps) {
  const router = useRouter();
  const [inputValue, setInputValue] = useState(initialBudget.toFixed(2));
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [apiToastMessage, setApiToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!apiToastMessage) {
      return;
    }

    const timer = setTimeout(() => {
      setApiToastMessage(null);
    }, 3500);

    return () => clearTimeout(timer);
  }, [apiToastMessage]);

  function openEditor() {
    setInputValue(initialBudget.toFixed(2));
    setErrorMessage(null);
    setIsOpen(true);
  }

  function closeEditor() {
    if (isSaving) {
      return;
    }

    setIsOpen(false);
    setErrorMessage(null);
  }

  async function saveBudget(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) {
      return;
    }

    const parsedBudget = Number(inputValue.replace(/,/g, "").trim());

    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      setErrorMessage("Enter a valid budget greater than 0.");
      return;
    }

    if (parsedBudget > 9_999_999.99) {
      setErrorMessage("Budget cannot exceed 9,999,999.99.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("Session expired. Please log in again.");
      setApiToastMessage("Session expired. Please log in again.");
      setIsSaving(false);
      return;
    }

    const nextBudget = Number(parsedBudget.toFixed(2));
    const { error } = await supabase
      .from("profiles")
      .update({ monthly_budget_php: nextBudget })
      .eq("id", user.id);

    if (error) {
      setErrorMessage("Unable to save budget right now. Try again.");
      setApiToastMessage("Unable to save budget right now. Try again.");
      setIsSaving(false);
      return;
    }

    setInputValue(nextBudget.toFixed(2));
    setIsOpen(false);
    setIsSaving(false);
    router.refresh();
  }

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/70">Home Budget</span>

        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">
            <span className="text-white/50 text-sm mr-0.5">₱</span>
            {formatBudget(initialBudget)}
          </span>
          <button
            type="button"
            onClick={openEditor}
            disabled={isSaving}
            aria-label="Edit home budget"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/70 transition-colors hover:border-mint/30 hover:text-mint disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PencilLine className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Set Home Budget
            </p>
            <button
              type="button"
              onClick={closeEditor}
              disabled={isSaving}
              aria-label="Close budget editor"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-white/60 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={saveBudget}>
            <label
              htmlFor="home-budget-input"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/50"
            >
              Monthly Budget (PHP)
            </label>
            <input
              id="home-budget-input"
              type="number"
              inputMode="decimal"
              min="1"
              step="0.01"
              value={inputValue}
              disabled={isSaving}
              onChange={(event) => setInputValue(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-mint/40 disabled:cursor-not-allowed disabled:opacity-60"
            />

            {errorMessage ? (
              <p className="mt-2 text-xs text-danger">{errorMessage}</p>
            ) : null}

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeEditor}
                disabled={isSaving}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/70 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-mint/30 bg-mint/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-mint transition-colors hover:bg-mint/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <LoadingIndicator size="sm" label="Saving budget" showLabel={false} />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {apiToastMessage ? (
        <div className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-97.5 -translate-x-1/2 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
            <p className="text-sm font-semibold text-danger">{apiToastMessage}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}