import { CanvasTexture, SRGBColorSpace } from "three";

// Cover face layout in model units: x ∈ [-1.6, 1.6], y ∈ [-1.1, 1.1] (positive y is the far edge).
export const COVER = { width: 3.2, depth: 2.2, radius: 0.32 } as const;
export const DISPLAY = { x: -0.2, y: -0.12, width: 2.3, height: 0.74, radius: 0.16 } as const;
export const LED = { x: -1.18, y: -0.78 } as const;

const PX = 480; // texture pixels per model unit

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Resolves the next/font family stacks exposed as CSS variables in the root layout. */
export function fontStacks() {
  const styles = getComputedStyle(document.documentElement);
  return {
    display: styles.getPropertyValue("--font-space-grotesk").trim() || "system-ui, sans-serif",
    text: styles.getPropertyValue("--font-space-grotesk").trim() || "system-ui, sans-serif",
  };
}

export async function waitForFonts(display: string) {
  if (!("fonts" in document)) return;
  try {
    await Promise.all([document.fonts.load(`900 120px ${display}`), document.fonts.load(`800 120px ${display}`), document.fonts.load(`700 60px ${display}`)]);
  } catch {
    // Fallback stack still renders legibly.
  }
}

/** Static cover artwork: warm-white face, wordmark, and the dark display recess. */
export function createCoverTexture(display: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = COVER.width * PX;
  canvas.height = COVER.depth * PX;
  const ctx = canvas.getContext("2d")!;
  const toX = (x: number) => (x + COVER.width / 2) * PX;
  const toY = (y: number) => (COVER.depth / 2 - y) * PX;

  ctx.fillStyle = "#F4F3EA";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#121212";
  ctx.font = `900 ${0.36 * PX}px ${display}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("WattWise", toX(-1.32), toY(0.42));

  const dx = toX(DISPLAY.x - DISPLAY.width / 2);
  const dy = toY(DISPLAY.y + DISPLAY.height / 2);
  roundedRect(ctx, dx, dy, DISPLAY.width * PX, DISPLAY.height * PX, DISPLAY.radius * PX);
  ctx.fillStyle = "#0E0E0E";
  ctx.fill();

  // A faint inner edge so the recess reads as glass when the display is off.
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 6;
  ctx.stroke();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Display readout, drawn on transparency so its opacity can follow scroll. */
export function createDisplayTexture(display: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = DISPLAY.width * PX;
  canvas.height = DISPLAY.height * PX;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#00E66F";
  ctx.shadowColor = "rgba(0, 230, 111, 0.55)";
  ctx.shadowBlur = 18;
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 ${0.46 * PX}px ${display}`;
  const left = 0.16 * PX;
  const baseline = canvas.height * 0.74;
  ctx.fillText("65 W", left, baseline);
  const wattsWidth = ctx.measureText("65 W").width;
  ctx.font = `700 ${0.15 * PX}px ${display}`;
  ctx.fillText("ONLINE", left + wattsWidth + 0.14 * PX, baseline - 0.06 * PX);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Soft contact shadow, drawn once. */
export function createShadowTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(0,0,0,0.85)");
  gradient.addColorStop(0.55, "rgba(0,0,0,0.35)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}
