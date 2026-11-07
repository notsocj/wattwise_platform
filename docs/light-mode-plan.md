# Light mode

Status as of November 7, 2026: **light mode is live** for every page that uses the shared tokens. What remains is listed under [Still open](#still-open).

## How theming works

- **Choosing a theme.** Phones switch in Settings → Appearance; desktop has **Light mode** / **Dark mode** in the sidebar. `ThemeProvider` (`components/providers/ThemeProvider.tsx`) saves the choice in `localStorage` under `wattwise-theme` and sets `data-theme` on `<html>`.
- **No flash on load.** A tiny inline script in `app/layout.tsx` reads `wattwise-theme` and sets `data-theme` before the first paint. The provider does not write `data-theme` on mount: hydration briefly renders the server's `"dark"`, and writing it then would flash dark. Changes from another tab arrive through the `storage` event.
- **Tokens, not overrides.** Colours are defined once per theme in `app/globals.css` (`@theme`, then `:root,[data-theme="dark"]` and `[data-theme="light"]`). Tailwind utilities read the variables, so every opacity step works in both themes.

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `canvas` | #121212 | #F5F6F8 | Page and desktop panel |
| `surface` | #1E1E1E | #FFFFFF | Cards |
| `sidebar` | #0B0B0B | #E9EBEF | Desktop sidebar rail |
| `fg` | #FFFFFF | #0F1115 | Foreground, always with opacity: `text-fg/60`, `border-fg/[0.06]`, `bg-fg/[0.04]` |
| `accent` | #00E66F | #007E3C | Mint text and icons (passes WCAG AA on white and on the canvas) |
| `mint` | #00E66F | #00E66F | Fills: buttons (with `text-ink`), chips (`bg-mint/10`), borders |
| `shade` | #000000 | ink at 40% | Inset wells such as inputs: `bg-shade/10` (darkens in dark, a soft 4% tint in light) |
| `bida` / `naku` / `danger` | #10B981 / #F59E0B / #EF4444 | #047857 / #B45309 / #B91C1C | Good / warning / danger, darker in light for contrast |
| `ink` | #121212 | #121212 | Dark text on bright mint, in both themes |

Charts read `--chart-axis`, `--chart-grid`, `--chart-track`, and `--chart-muted-bar`, which also switch per theme.

## Rules for new code

- Never hard-code `text-white`, `border-white/*`, or `bg-white/*`. Use `fg` with an opacity, `text-accent` for mint text, and `bg-shade/*` for wells.
- Literal white is allowed only on surfaces that stay coloured in both themes: white text on red buttons (`ConfirmDialog`, `RestorePowerButton`), toggle knobs, and print styles.
- The pitch deck (`components/pitch-deck/`) is a fixed dark presentation and keeps literal colours.
- After editing tokens in `app/globals.css`, restart the dev server if new utilities do not appear; it can keep serving a stale stylesheet.

## How we got here

Light mode used to work by repainting dark-mode classes with 46 `[data-theme="light"] .text-white\/60 { … }` rules. Any new opacity step had no rule and broke in light mode. On November 7, 2026 a codemod renamed about 980 class usages to the tokens above (`white` → `fg`, `text-mint` → `text-accent`, `bg-black/10–20` → `bg-shade/*`), and the override rules were deleted. Dark mode resolves to the same colours as before.

## Still open

1. **"System" option** that follows the device's light/dark setting (`prefers-color-scheme`), alongside Dark and Light.
2. **Light-mode review** of the manager portal, the admin console, and the signed-out pages (landing, login, register). They use the tokens but have not been checked page by page.
3. **Card shadow in light mode.** Cards rely on a 6% border; a soft `0 1px 2px` shadow may read better on white.
4. **Contrast pass** with a checker on every page in both themes, phone and desktop.
