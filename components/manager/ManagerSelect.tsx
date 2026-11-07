"use client";

import { useId, useState } from "react";
import { Check, ChevronDown } from "@/components/ui/icons";

export type ManagerSelectOption = {
  value: string;
  label: string;
};

type ManagerSelectProps = {
  value: string;
  options: ManagerSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel: string;
};

/** In-app picker (no native select): a pill trigger and a menu that scales in from it. */
export default function ManagerSelect({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
}: ManagerSelectProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className={`flex h-12 w-full items-center justify-between gap-3 rounded-full border bg-shade/10 px-4 text-left text-sm text-fg outline-none transition-[border-color,scale] duration-150 ease-out focus-visible:border-mint/50 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? "border-mint/40" : "border-fg/10 hover:border-fg/20"
        }`}
      >
        <span className={`min-w-0 truncate ${value ? "text-fg" : "text-fg/50"}`}>{selected?.label ?? "Select"}</span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-fg/50 transition-[rotate] duration-200 ease-out ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-50 max-h-60 origin-top overflow-y-auto rounded-2xl border border-fg/10 bg-surface p-1.5 shadow-2xl shadow-black/30 transition-[opacity,scale] duration-150 ease-out starting:scale-[0.97] starting:opacity-0"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-150 ease-out ${
                  isSelected ? "bg-mint/10 font-semibold text-fg" : "text-fg/70 hover:bg-fg/[0.05] hover:text-fg"
                }`}
              >
                <Check aria-hidden="true" className={`h-4 w-4 shrink-0 ${isSelected ? "text-accent" : "text-transparent"}`} />
                <span className="min-w-0 truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
