# Light mode plan

> **Status (2026-11-07):** steps 1–3 are done, plus the pre-paint script and the splash fix from step 5:
> - The `fg`, `accent` and `shade` tokens exist.
> - A codemod renamed 981 classes.
> - The 46 override rules are deleted.
>
> Still open:
> - A "System" theme option.
> - A light-mode shadow on cards.
> - A full QA pass, including signed-out pages, the manager portal and admin.


## Where it stands

- A theme toggle exists (sidebar on desktop, Settings → Appearance). `ThemeProvider` stores the choice in `localStorage` (`wattwise-theme`) and sets `data-theme` on `<html>`.
- Light mode works by **patching class names**. `app/globals.css` has 46 `[data-theme="light"] .text-white\/60 { … }` style overrides that repaint dark-mode utilities.
- Components hard-code dark colours: about 476 `text-white*`, 216 `border-white/*`, 122 `bg-white/*`, 44 `bg-black/*` and 21 raw hex values. Any new opacity step (for example `text-white/35`, `bg-white/[0.04]`) has no override, so it breaks in light mode. The new desktop sidebar and cards already use some of these.
- Known bugs:
  - The page always renders dark first and switches after hydration, so light-mode users see a dark flash.
  - The splash (`app/page.tsx`) forces `data-theme="dark"`.

## Approach: semantic tokens, not overrides

1. **Define tokens once, per theme** (in `@theme` plus `[data-theme]` blocks):

   | Token | Dark | Light | Replaces |
   | --- | --- | --- | --- |
   | `canvas` | #121212 | #F5F6F8 | page / panel |
   | `surface` | #1E1E1E | #FFFFFF | cards |
   | `sidebar` | #0B0B0B | #E9EBEF | desktop rail |
   | `fg` | #FFFFFF | #0F1115 | `text-white` |
   | `fg-muted` | white 60% | ink 62% | `text-white/50–70` |
   | `fg-subtle` | white 40% | ink 45% | `text-white/30–45` |
   | `line` | white 6% | ink 8% | `border-white/5–10` |
   | `fill` | white 4% | ink 4% | `bg-white/[0.02–0.08]`, hovers |
   | `accent` | #00E66F | #00A653 | mint *text and icons* (#00E66F fails contrast on white) |
   | `accent-fill` | #00E66F | #00E66F | mint buttons (black text works in both) |

   Light cards also get a soft shadow (`0 1px 2px rgb(0 0 0 / 0.04)`), because borders alone look flat on white.

2. **Codemod the class names.** Map each opacity bucket to its token: `text-white/60` → `text-fg-muted`, `border-white/[0.06]` → `border-line`, and so on. Run it one area at a time and review each diff:
   1. Shell: `AppSidebar`, `PageHeader`, `Card`, `BottomNav`
   2. Dashboard and device pages
   3. Burn, Rates, Reports, Calendar
   4. Settings and insight cards
   5. Manager portal
   6. Admin
   7. Auth pages and landing
3. **Delete the 46 override rules** once nothing depends on them.
4. **Special cases**
   - Charts: Recharts already reads `--chart-*` variables; check the light values.
   - Status colours (`bida`, `naku`, `danger`): need darker light-mode text shades for contrast.
   - Landing 3D unit: the canvas is transparent, so it works on light. Check that the ambient glow and the poster still read well.
   - Print and PDF are already black on white; no change needed.
5. **Theme choice**
   - Add a "System" option that follows `prefers-color-scheme`.
   - Add a tiny inline script in `<head>` that sets `data-theme` before first paint, so there's no flash.
   - Stop the splash from forcing dark.
6. **QA**: screenshot every page in both themes, on phone and desktop. Check WCAG AA contrast for text and for mint on white.

## Order of work

Tokens and pre-paint script → shell → dashboard → the rest by area → delete overrides → QA pass.
Each step ships on its own: dark mode keeps looking the same because the tokens resolve to today's values.
