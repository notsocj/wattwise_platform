"use client";

import { useId, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

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
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
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
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-black/10 bg-black/10 px-3 py-2 text-left text-sm text-black outline-none transition-colors focus:border-mint/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-white"
      >
        <span className="min-w-0 truncate">{selected?.label ?? "Select"}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-black/70 transition-transform dark:text-white/70 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-50 max-h-56 overflow-y-auto rounded-xl border border-black/10 bg-white p-1 shadow-2xl dark:border-white/10 dark:bg-[#202020]"
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
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  isSelected
                    ? "bg-mint/10 text-black dark:text-white"
                    : "text-black/65 hover:bg-black/[0.04] hover:text-black dark:text-white/70 dark:hover:bg-white/[0.06] dark:hover:text-white"
                }`}
              >
                <Check
                  className={`h-4 w-4 shrink-0 ${
                    isSelected ? "text-mint" : "text-transparent"
                  }`}
                />
                <span className="min-w-0 truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
