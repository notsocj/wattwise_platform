"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

type ThemeMode = "dark" | "light";

const STORAGE_KEY = "wattwise-theme";

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "dark";
}

function subscribeToThemeChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("wattwise-theme-change", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("wattwise-theme-change", onStoreChange);
  };
}

type ThemeToggleProps = {
  className?: string;
};

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const theme = useSyncExternalStore(
    subscribeToThemeChanges,
    getStoredTheme,
    () => "dark"
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";

  function handleToggle() {
    const updatedTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = updatedTheme;
    window.localStorage.setItem(STORAGE_KEY, updatedTheme);
    window.dispatchEvent(new Event("wattwise-theme-change"));
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      className={
        className ??
        "inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] p-2 text-white/70 transition-colors hover:border-white/20 hover:text-white"
      }
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
