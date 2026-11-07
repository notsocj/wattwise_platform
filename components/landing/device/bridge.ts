// One mutable proxy per experience instance. The WattWise GSAP timeline writes it;
// the R3F frame adapter reads it. Neither React state nor module globals carry progress.

export interface WattWiseProxy {
  /** Absolute radians. */
  rootYaw: number;
  rootPitch: number;
  modelX: number;
  modelY: number;
  modelScale: number;
  camX: number;
  camY: number;
  camZ: number;
  tgtX: number;
  tgtY: number;
  tgtZ: number;
  /** 0..1 — the cover lifts clear of the stack. */
  coverLift: number;
  /** 0..1 — inner layers separate and components rise. */
  explode: number;
  focusSense: number;
  focusCompute: number;
  focusControl: number;
  /** 0..1 — display text and status light. */
  displayOn: number;
  keyIntensity: number;
  rimIntensity: number;
  /** 0..1 — projected component tags. */
  tags: number;
}

/** Canonical S04 p=0 pose. Builders tween away from these absolute values. */
export const INITIAL_POSE: Readonly<WattWiseProxy> = {
  rootYaw: -0.95,
  rootPitch: 0,
  modelX: 0,
  modelY: -0.15,
  modelScale: 1,
  camX: 0,
  camY: 4.4,
  camZ: 9.2,
  tgtX: 0,
  tgtY: 0.2,
  tgtZ: 0,
  coverLift: 0,
  explode: 0,
  focusSense: 0,
  focusCompute: 0,
  focusControl: 0,
  displayOn: 0,
  keyIntensity: 0.05,
  rimIntensity: 0,
  tags: 0,
};

export type TagId = "sense" | "compute" | "control";

export interface WattWiseBridge {
  proxy: WattWiseProxy;
  /** Registered from inside the Canvas. Coalesces into one scheduled render. */
  invalidate: (() => void) | null;
  /** True while the stage intersects the viewport; offscreen updates skip draw requests. */
  visible: boolean;
  /** Projected HTML tags, positioned by the frame adapter. */
  tags: Map<TagId, HTMLElement>;
  /** Variant the timeline was built for; the adapter uses it for label placement. */
  variant: "full" | "compact" | "static";
  request: () => void;
  reset: () => void;
  setVariant: (variant: WattWiseBridge["variant"]) => void;
  setVisible: (visible: boolean) => void;
  /** Registers the Canvas invalidate handle; returns the matching unbind. */
  bind: (invalidate: () => void) => () => void;
  setTag: (id: TagId, element: HTMLElement | null) => void;
}

export function createWattWiseBridge(): WattWiseBridge {
  const bridge: WattWiseBridge = {
    proxy: { ...INITIAL_POSE },
    invalidate: null,
    visible: false,
    tags: new Map(),
    variant: "static",
    request() {
      if (bridge.visible) bridge.invalidate?.();
    },
    reset() {
      Object.assign(bridge.proxy, INITIAL_POSE);
      bridge.invalidate?.();
    },
    setVariant(variant) {
      bridge.variant = variant;
    },
    setVisible(visible) {
      bridge.visible = visible;
      if (visible) bridge.invalidate?.();
    },
    bind(invalidate) {
      bridge.invalidate = invalidate;
      invalidate();
      return () => {
        if (bridge.invalidate === invalidate) bridge.invalidate = null;
      };
    },
    setTag(id, element) {
      if (element) bridge.tags.set(id, element);
      else bridge.tags.delete(id);
    },
  };
  return bridge;
}
