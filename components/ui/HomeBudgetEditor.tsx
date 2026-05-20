"use client";

import { PencilLine, X } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { AlertTriangle, PencilLine, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingIndicator from "@/components/ui/LoadingIndicator";
import SuccessToast from "@/components/ui/SuccessToast";
import { createClient } from "@/lib/supabase/client";

type HomeBudgetEditorProps = {
  initialBudget: number;
};

function formatBudget(value: number): string {
  return value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseBudgetInput(value: string): number {
  return Number(value.replace(/,/g, "").trim());
}

function validateBudgetInput(value: string): string | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "Enter your monthly budget amount in pesos.";
  }

  const parsedBudget = parseBudgetInput(trimmedValue);

  if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
    return "Use a budget greater than 0, like 2500 or 2500.50.";
  }

  if (parsedBudget > 9_999_999.99) {
    return "Budget cannot exceed PHP 9,999,999.99.";
  }

  return null;
}

export default function HomeBudgetEditor({ initialBudget }: HomeBudgetEditorProps) {
  const router = useRouter();
  const [inputValue, setInputValue] = useState(initialBudget.toFixed(2));
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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

  async function saveBudget(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSaving) {
      return;
    }

    const validationMessage = validateBudgetInput(inputValue);

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    const parsedBudget = parseBudgetInput(inputValue);
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setApiToastMessage(null);

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      const message = "Session expired. Please log in again.";
      setErrorMessage(message);
      setApiToastMessage(message);
      setIsSaving(false);
      return;
    }

    const nextBudget = Number(parsedBudget.toFixed(2));
    const { error } = await supabase
      .from("profiles")
      .update({ monthly_budget_php: nextBudget })
      .eq("id", user.id);

    if (error) {
      const message =
        "We could not save your budget right now. Your current budget is unchanged.";
      setErrorMessage(message);
      setApiToastMessage(message);
      setIsSaving(false);
      return;
    }

    setInputValue(nextBudget.toFixed(2));
    setIsOpen(false);
    setIsSaving(false);
    setSuccessMessage("Home budget updated.");
    router.refresh();
  }

  return (
    <>
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

          <form onSubmit={saveBudget} noValidate>
            <label
              htmlFor="home-budget-input"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/50"
            >
              Monthly Budget (PHP)
            </label>
            <input
              id="home-budget-input"
              type="text"
              inputMode="decimal"
              value={inputValue}
              disabled={isSaving}
              onChange={(event) => {
                setInputValue(event.target.value);
                if (errorMessage) {
                  setErrorMessage(null);
                }
              }}
              onBlur={() => setErrorMessage(validateBudgetInput(inputValue))}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby="home-budget-message"
              className={`w-full rounded-lg border bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                errorMessage
                  ? "border-danger/70 focus:border-danger"
                  : "border-white/10 focus:border-mint/40"
              }`}
            />

            {errorMessage ? (
              <p id="home-budget-message" className="mt-2 text-xs text-danger">
                {errorMessage}
              </p>
            ) : (
              <p id="home-budget-message" className="mt-2 text-xs text-white/40">
                Enter your expected monthly bill limit, e.g. PHP 2,500.
              </p>
            )}

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
                      <LoadingIndicator
                        size="sm"
                        label="Saving budget"
                        showLabel={false}
                      />
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
              <p className="text-sm font-semibold text-danger">
                {apiToastMessage}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <SuccessToast
        message={successMessage}
        onDismiss={() => setSuccessMessage(null)}
      />
    </>
  );
}

