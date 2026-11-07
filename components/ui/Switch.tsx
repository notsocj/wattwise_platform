"use client";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  /** Shows a spinner in the knob while a change is being saved. */
  pending?: boolean;
  /** Track colour when on. "warning" is for safety switches such as automatic shut-off. */
  tone?: "accent" | "warning";
};

/**
 * On/off switch. The knob slides (translate, 200ms strong ease-out) and
 * squeezes slightly while pressed, so a tap feels acknowledged before the
 * request finishes.
 */
export default function Switch({ checked, onChange, label, disabled = false, pending = false, tone = "accent" }: SwitchProps) {
  const onColor = tone === "warning" ? "bg-naku" : "bg-mint";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      onClick={() => onChange(!checked)}
      className={`group relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint disabled:cursor-not-allowed ${
        checked ? onColor : "bg-fg/15"
      } ${disabled && !pending ? "opacity-50" : ""}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm transition-[translate,scale] duration-200 ease-out group-enabled:group-active:scale-90 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      >
        {pending ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink/20 border-t-ink" aria-hidden="true" />
        ) : null}
      </span>
    </button>
  );
}
