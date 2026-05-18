"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import LoadingIndicator from "@/components/ui/LoadingIndicator";

const MIN_VISIBLE_MS = 220;
const MAX_VISIBLE_MS = 5000;

export default function RouteTransitionIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);

  const startAtRef = useRef<number | null>(null);
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

  const beginTransition = useCallback(() => {
    clearTimers();
    startAtRef.current = Date.now();
    setIsNavigating(true);

    safetyTimerRef.current = setTimeout(() => {
      setIsNavigating(false);
      startAtRef.current = null;
    }, MAX_VISIBLE_MS);
  }, [clearTimers]);

  const completeTransition = useCallback(() => {
    const startedAt = startAtRef.current;
    const elapsed = startedAt ? Date.now() - startedAt : MIN_VISIBLE_MS;
    const delay = Math.max(0, MIN_VISIBLE_MS - elapsed);

    hideTimerRef.current = setTimeout(() => {
      setIsNavigating(false);
      startAtRef.current = null;
      clearTimers();
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

      beginTransition();
    }

    function onPopState() {
      beginTransition();
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

    completeTransition();
    // query string changes should also end the indicator
  }, [completeTransition, pathname, searchParams, isNavigating]);

  if (!isNavigating) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-[70] -translate-x-1/2">
      <div className="rounded-full border border-white/10 bg-base/90 px-3 py-1.5 shadow-lg backdrop-blur-sm">
        <LoadingIndicator size="sm" label="Loading page" />
      </div>
    </div>
  );
}
