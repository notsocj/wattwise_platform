"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
const MIN_VISIBLE_MS = 220;
const MAX_VISIBLE_MS = 5000;
/** Time for the bar to fill the last stretch and fade before it unmounts. */
const FINISH_MS = 420;

type Phase = "idle" | "loading" | "finishing";

/**
 * Thin progress bar along the top edge while a client navigation loads.
 * It shoots forward, slows as it waits (one long ease-out transition, so it
 * never looks stuck), then fills and fades once the new route renders.
 */
export default function RouteTransitionIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("idle");
  // Bumped per navigation so a new one restarts the bar from zero.
  const [run, setRun] = useState(0);
  const isNavigating = phase === "loading";

  const startAtRef = useRef<number | null>(null);
  const destinationRef = useRef<string | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const beginTransition = useCallback((destination: string) => {
    clearTimers();
    startAtRef.current = Date.now();
    destinationRef.current = destination;
    setRun((value) => value + 1);
    setPhase("loading");

    safetyTimerRef.current = setTimeout(() => {
      setPhase("idle");
      startAtRef.current = null;
      destinationRef.current = null;
    }, MAX_VISIBLE_MS);
  }, [clearTimers]);

  const completeTransition = useCallback(() => {
    clearTimers(); // drops the safety timeout; the finish timers below take over
    const startedAt = startAtRef.current;
    const elapsed = startedAt ? Date.now() - startedAt : MIN_VISIBLE_MS;
    const delay = Math.max(0, MIN_VISIBLE_MS - elapsed);

    hideTimerRef.current = setTimeout(() => {
      setPhase("finishing");
      startAtRef.current = null;
      destinationRef.current = null;
      hideTimerRef.current = setTimeout(() => setPhase("idle"), FINISH_MS);
    }, delay);
  }, [clearTimers]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const clickTarget = event.target;
      if (!(clickTarget instanceof Element)) {
        return;
      }

      const anchor = clickTarget.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) {
        return;
      }

      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const next = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;

      if (current === next) {
        return;
      }

      beginTransition(`${nextUrl.pathname}${nextUrl.search}`);
    }

    function onPopState() {
      beginTransition(`${window.location.pathname}${window.location.search}`);
    }

    document.addEventListener("click", onDocumentClick, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
  }, [beginTransition, clearTimers]);

  useEffect(() => {
    if (!isNavigating) {
      return;
    }

    const query = searchParams.toString();
    const current = `${pathname}${query ? `?${query}` : ""}`;
    if (destinationRef.current === current) {
      completeTransition();
    }
    // query string changes should also end the indicator
  }, [completeTransition, pathname, searchParams, isNavigating]);

  if (phase === "idle") {
    return null;
  }

  const finishing = phase === "finishing";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5">
      <div
        key={run}
        className={`h-full origin-left bg-mint shadow-[0_0_10px_rgb(0_230_111/0.6)] starting:scale-x-0 ${
          finishing
            ? "scale-x-100 opacity-0 transition-[scale,opacity] duration-200 ease-out [transition-delay:0ms,180ms]"
            : "scale-x-[86%] transition-[scale] duration-[8000ms] ease-[cubic-bezier(0.05,0.7,0.1,1)]"
        }`}
      />
      <span role="status" className="sr-only">
        {finishing ? "" : "Loading page"}
      </span>
    </div>
  );
}
