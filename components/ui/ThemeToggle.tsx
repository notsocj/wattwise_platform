"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

type ThemeMode = "dark" | "light";

type ThemeToggleProps = {
  className?: string;
  /** Show "Light mode" / "Dark mode" beside the icon (sidebar rows). */
  showLabel?: boolean;
};

export default function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      className={
        className ??
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-fg/10 bg-fg/[0.03] text-fg/70 transition-colors hover:border-fg/20 hover:text-fg"
      }
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      {showLabel ? <span>{nextTheme === "light" ? "Light mode" : "Dark mode"}</span> : null}
    </button>
  );
}
