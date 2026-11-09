import type { ComponentProps } from "react";

// A 128 px copy (the mark is never shown above ~28 px); CSS masks skip next/image resizing.
const MASK = "url(/wattwise_mark.png) center / contain no-repeat";

/**
 * The WattWise owl as a single-colour mark. It is painted in the current text
 * colour (`text-accent`, `text-ink`, ...), so it follows the theme like an icon.
 * Size it with h-/w- classes.
 */
export default function BrandMark({ className = "", style, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      {...props}
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{ mask: MASK, WebkitMask: MASK, ...style }}
    />
  );
}
