"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeMode = "dark" | "light";

const STORAGE_KEY = "wattwise-theme";

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "dark";
}

type ThemeToggleProps = {
  className?: string;
};

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = getStoredTheme();
    document.documentElement.dataset.theme = stored;
    setTheme(stored);
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";

  function handleToggle() {
    const updatedTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(updatedTheme);
    document.documentElement.dataset.theme = updatedTheme;
    window.localStorage.setItem(STORAGE_KEY, updatedTheme);
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
