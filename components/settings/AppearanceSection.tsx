"use client";

import { Moon, Sun } from "@/components/ui/icons";
import { useTheme } from "@/components/providers/ThemeProvider";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsGroup";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export default function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const activeIndex = OPTIONS.findIndex((option) => option.value === theme);

  return (
    <SettingsGroup title="Appearance" footer="Saved on this device.">
      <SettingsRow
        icon={theme === "dark" ? Moon : Sun}
        title="Theme"
        control={
          <div role="radiogroup" aria-label="Theme" className="relative grid grid-cols-2 rounded-full bg-fg/[0.06] p-1">
            {/* One highlight that slides between options (state change, 200ms strong ease-in-out). */}
            <span
              aria-hidden="true"
              className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-surface shadow-sm ring-1 ring-fg/[0.06] transition-[translate] duration-200 ease-in-out"
              style={{ translate: `${Math.max(activeIndex, 0) * 100}% 0` }}
            />
            {OPTIONS.map(({ value, label, icon: Icon }) => {
              const selected = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTheme(value)}
                  className={`relative z-10 inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-[color,scale] duration-150 ease-out active:scale-[0.96] ${
                    selected ? "text-fg" : "text-fg/50 hover:text-fg/80"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        }
      />
    </SettingsGroup>
  );
}
