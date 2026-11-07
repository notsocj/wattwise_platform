"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type ThemeMode = "dark" | "light";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "wattwise-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "dark";
}

function subscribeToThemeChanges(onStoreChange: () => void) {
  // Another tab changed the theme: apply it here too.
  function onStorage(event: StorageEvent) {
    if (event.key !== STORAGE_KEY) return;
    document.documentElement.dataset.theme = getStoredTheme();
    onStoreChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener("wattwise-theme-change", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("wattwise-theme-change", onStoreChange);
  };
}

function writeTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
  window.dispatchEvent(new Event("wattwise-theme-change"));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToThemeChanges,
    getStoredTheme,
    (): ThemeMode => "dark"
  );

  // No effect writes data-theme on mount: the boot script in app/layout.tsx
  // already set it, and hydration briefly renders the server's "dark", which
  // would flash dark for light-mode users. Changes go through writeTheme.

  const value: ThemeContextValue = {
    theme,
    setTheme: writeTheme,
    toggleTheme() {
      writeTheme(theme === "dark" ? "light" : "dark");
    },
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}
