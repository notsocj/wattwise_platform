"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from "react";
import { createWattWiseBridge, type TagId } from "./bridge";

// Browser-only renderer, split from the main bundle. Ported from the gsap-portfolio repo.
const WattWiseCanvas = dynamic(() => import("./WattWiseCanvas"), { ssr: false });

class CanvasBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Software-only WebGL (no GPU acceleration: SwiftShader, llvmpipe, Microsoft
// Basic Render) draws every 3D frame on the CPU and blocks the page for seconds,
// so those machines keep the SVG poster and never download three.js.
// failIfMajorPerformanceCaveat refuses some of them; the renderer name catches the rest.
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const options: WebGLContextAttributes = { failIfMajorPerformanceCaveat: true };
    const gl = canvas.getContext("webgl2", options) ?? canvas.getContext("webgl", options);
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !SOFTWARE_RENDERER.test(renderer);
  } catch {
    return false;
  }
}

/** Calls `run` once the page has loaded and the browser is idle (2 s at the latest). */
function whenIdleAfterLoad(run: () => void) {
  let idleId: number | undefined;
  let timeoutId: number | undefined;
  const schedule = () => {
    // Safari has no requestIdleCallback.
    if (typeof window.requestIdleCallback === "function") idleId = window.requestIdleCallback(run, { timeout: 2000 });
    else timeoutId = setTimeout(run, 600) as unknown as number;
  };
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
  return () => {
    window.removeEventListener("load", schedule);
    if (idleId !== undefined) window.cancelIdleCallback(idleId);
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  };
}

let webglSupport: boolean | undefined;
const readWebGL = () => (webglSupport ??= supportsWebGL());
const noSubscribe = () => () => {};

const REDUCED = "(prefers-reduced-motion: reduce)";
const readReduced = () => matchMedia(REDUCED).matches;
function subscribeReduced(onChange: () => void) {
  const query = matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const TAGS: readonly { id: TagId; label: string }[] = [
  { id: "sense", label: "PZEM-004T meter" },
  { id: "compute", label: "ESP32-S3" },
  { id: "control", label: "Relay" },
];

/**
 * The WattWise unit in 3D. Idles with a slow sway; hovering (or tapping) lifts the cover
 * and separates the layers. The SVG poster shows until the first 3D frame, and stays as
 * the whole experience without WebGL.
 */
export default function WattWiseStage({ poster }: { poster: ReactNode }) {
  const host = useRef<HTMLElement>(null);
  const open = useRef(false);
  const [bridge] = useState(createWattWiseBridge);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  // three.js is fetched and started only after the page is interactive, so it
  // never competes with first paint and hydration; the poster shows until then.
  const [idle, setIdle] = useState(false);
  const reduced = useSyncExternalStore(subscribeReduced, readReduced, () => false);
  const webgl = useSyncExternalStore(noSubscribe, readWebGL, () => false) && !failed;

  useEffect(() => whenIdleAfterLoad(() => setIdle(true)), []);

  const isOpen = hovered || pinned;

  useEffect(() => {
    open.current = isOpen;
  }, [isOpen]);

  // Stop rendering entirely while the device is scrolled away.
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => setVisible(entries.some((entry) => entry.isIntersecting)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handleReady = useCallback(() => setReady(true), []);
  const handleFailure = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);
  // Only a real mouse hovers; touch "hover" would fire on every tap.
  const hover = (value: boolean) => (event: PointerEvent) => {
    if (event.pointerType === "mouse") setHovered(value);
  };

  return (
    <figure
      ref={host}
      data-open={isOpen}
      onPointerEnter={hover(true)}
      onPointerLeave={hover(false)}
      className="group/device relative grid justify-items-center"
    >
      <div className="relative aspect-[1/0.88] w-full sm:aspect-[16/11]">
        <div
          className={`absolute inset-0 grid place-items-center transition-opacity duration-300 ease-out ${ready ? "opacity-0" : "opacity-100"}`}
        >
          {poster}
        </div>
        {webgl && idle ? (
          <>
            <div className={`absolute inset-0 transition-opacity duration-700 ease-out ${ready ? "opacity-100" : "opacity-0"}`}>
              <CanvasBoundary onError={handleFailure}>
                <WattWiseCanvas bridge={bridge} open={open} active={visible} reduced={reduced} onReady={handleReady} onContextLost={handleFailure} />
              </CanvasBoundary>
            </div>
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              {TAGS.map((tag) => (
                // Position comes from the 3D anchor (inline transform); `translate` lifts the label above it.
                <span
                  key={tag.id}
                  ref={(node) => bridge.setTag(tag.id, node)}
                  className="invisible absolute left-0 top-0 -translate-x-1/2 translate-y-[calc(-100%-12px)] whitespace-nowrap rounded-full bg-surface/85 px-3 py-1 text-xs font-medium text-fg ring-1 ring-fg/10 backdrop-blur-md"
                >
                  {tag.label}
                </span>
              ))}
            </div>
            <button
              type="button"
              aria-pressed={pinned}
              onClick={() => setPinned((value) => !value)}
              className="absolute inset-[8%_18%] cursor-pointer rounded-[40px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint"
            >
              <span className="sr-only">Show the parts inside the WattWise unit</span>
            </button>
          </>
        ) : null}
      </div>
      {webgl && idle ? (
        <figcaption
          aria-hidden="true"
          className={`-mt-2 text-xs font-medium uppercase tracking-[0.24em] text-fg/40 transition-opacity duration-200 ease-out ${
            ready && !isOpen ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="[@media(hover:none)]:hidden">Hover to look inside</span>
          <span className="hidden [@media(hover:none)]:inline">Tap to look inside</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
