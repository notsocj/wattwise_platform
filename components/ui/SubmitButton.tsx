import { Check } from "lucide-react";

export type SubmitStatus = "idle" | "loading" | "success";

type SubmitButtonProps = {
  status: SubmitStatus;
  idleLabel: string;
  loadingLabel: string;
  successLabel: string;
  /** Extra reason to block submitting while idle (e.g. empty required fields). */
  disabled?: boolean;
  className?: string;
};

const LAYER = "col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-[opacity,translate,filter] duration-200 ease-out";
const HIDDEN = "pointer-events-none translate-y-1.5 opacity-0 blur-[2px]";

/**
 * Full-width form submit button that shows what the form is doing: idle,
 * processing (spinner) and done (check). The three labels share one grid cell
 * and crossfade, so the button never changes size between states.
 */
export default function SubmitButton({
  status,
  idleLabel,
  loadingLabel,
  successLabel,
  disabled = false,
  className = "",
}: SubmitButtonProps) {
  const busy = status !== "idle";

  return (
    <button
      type="submit"
      disabled={busy || disabled}
      aria-busy={status === "loading"}
      className={`grid w-full rounded-full bg-mint py-4 text-[17px] font-bold text-ink transition-[scale,opacity] duration-150 ease-out enabled:active:scale-[0.97] ${
        busy ? "cursor-progress" : "disabled:cursor-not-allowed disabled:opacity-60"
      } ${className}`}
    >
      <span aria-hidden={status !== "idle"} className={`${LAYER} ${status === "idle" ? "" : HIDDEN}`}>
        {idleLabel}
      </span>
      <span aria-hidden="true" className={`${LAYER} ${status === "loading" ? "" : HIDDEN}`}>
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/25 border-t-ink" />
        {loadingLabel}
      </span>
      <span aria-hidden="true" className={`${LAYER} ${status === "success" ? "" : HIDDEN}`}>
        <Check className="h-5 w-5" strokeWidth={3} />
        {successLabel}
      </span>
      {/* Announces the processing and done states to screen readers. */}
      <span className="sr-only" role="status" aria-live="polite">
        {status === "loading" ? loadingLabel : status === "success" ? successLabel : ""}
      </span>
    </button>
  );
}
