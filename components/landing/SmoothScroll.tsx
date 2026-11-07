"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useEffect } from "react";

/**
 * Eased wheel scrolling for the landing page only. It keeps the browser's real scroll
 * position, so IntersectionObservers behave normally. Touch stays native, and reduced
 * motion keeps the browser's own scrolling. Unmounting restores normal scrolling.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.1, autoRaf: true, anchors: true });
    return () => lenis.destroy();
  }, []);
  return null;
}
