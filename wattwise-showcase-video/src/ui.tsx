import { loadFont } from "@remotion/fonts";
import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

loadFont({
  family: "Space Grotesk",
  url: staticFile("fonts/SpaceGrotesk-Regular.ttf"),
  weight: "400",
});
loadFont({
  family: "Space Grotesk",
  url: staticFile("fonts/SpaceGrotesk-Bold.ttf"),
  weight: "700",
});

// WattWise dark-theme tokens (app/globals.css).
export const C = {
  bg: "#0B0C0B",
  canvas: "#121212",
  surface: "#1E1E1E",
  mint: "#00E66F",
  fg: "#FFFFFF",
  bida: "#10B981",
  naku: "#F59E0B",
  danger: "#EF4444",
  ink: "#121212",
  paper: "#F3F2EB",
};
export const FONT = "Space Grotesk, sans-serif";
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 → 1 over `dur` frames starting at `at`. */
export const prog = (frame: number, at: number, dur = 18) =>
  interpolate(frame, [at, at + dur], [0, 1], { ...clamp, easing: easeOut });

/** Fade + rise entrance, with an optional fade-out starting at `out`. */
export const rise = (
  frame: number,
  at: number,
  dist = 40,
  out?: number,
): CSSProperties => {
  const p = prog(frame, at);
  const o = out === undefined ? 1 : 1 - prog(frame, out, 12);
  return { opacity: p * o, translate: `0px ${(1 - p) * dist}px` };
};

/** Springy scale-in. */
export const pop = (frame: number, at: number): CSSProperties => {
  const p = interpolate(frame, [at, at + 16], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  return { opacity: Math.min(1, p * 2), scale: String(0.6 + 0.4 * p) };
};

export const peso = (n: number) =>
  "₱" +
  n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Dark brand backdrop: slow-drifting mint glow over a faint dot grid. */
export const Backdrop = ({
  glowX = 70,
  glowY = 35,
  tint = "0,230,111",
}: {
  readonly glowX?: number;
  readonly glowY?: number;
  readonly tint?: string;
}) => {
  const frame = useCurrentFrame();
  const x = glowX + Math.sin(frame / 80) * 4;
  const y = glowY + Math.cos(frame / 95) * 4;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1300px 900px at ${x}% ${y}%, rgba(${tint},0.13), transparent 62%), ${C.bg}`,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.07) 1.5px, transparent 1.5px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 85%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** The WattWise owl, painted in one colour like the app's BrandMark. */
export const Owl = ({
  size,
  color = C.mint,
  style,
}: {
  readonly size: number;
  readonly color?: string;
  readonly style?: CSSProperties;
}) => {
  const mask = `url(${staticFile("wattwise_mascot.png")}) center / contain no-repeat`;
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        mask,
        WebkitMask: mask,
        flexShrink: 0,
        ...style,
      }}
    />
  );
};

export const Phone = ({
  width,
  height,
  style,
  children,
}: {
  readonly width: number;
  readonly height: number;
  readonly style?: CSSProperties;
  readonly children: ReactNode;
}) => (
  <div
    style={{
      position: "absolute",
      width,
      height,
      borderRadius: 64,
      background: "#050505",
      padding: 14,
      boxShadow:
        "0 50px 140px rgba(0,0,0,0.65), 0 0 0 2px rgba(255,255,255,0.09)",
      ...style,
    }}
  >
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: 52,
        background: C.canvas,
        overflow: "hidden",
        fontFamily: FONT,
        color: C.fg,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 14,
          left: "50%",
          translate: "-50% 0",
          width: 130,
          height: 34,
          borderRadius: 20,
          background: "#000",
          zIndex: 5,
        }}
      />
      {children}
    </div>
  </div>
);

export const Kicker = ({
  children,
  style,
  color = C.mint,
}: {
  readonly children: ReactNode;
  readonly style?: CSSProperties;
  readonly color?: string;
}) => (
  <div
    style={{
      fontSize: 34,
      fontWeight: 700,
      letterSpacing: "0.2em",
      color,
      ...style,
    }}
  >
    {children}
  </div>
);

export const LiveDot = ({ size = 14 }: { readonly size?: number }) => {
  const frame = useCurrentFrame();
  const pulse = (Math.sin(frame / 6) + 1) / 2;
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: size,
        background: C.mint,
        boxShadow: `0 0 0 ${pulse * size * 0.6}px rgba(0,230,111,${0.35 * (1 - pulse)})`,
      }}
    />
  );
};

/** Simple 24px line icons (stroke follows `color`). */
export const Icon = ({
  name,
  size = 40,
  color = C.mint,
}: {
  readonly name: "clock" | "bolt" | "power" | "bell" | "wallet" | "peso" | "check";
  readonly size?: number;
  readonly color?: string;
}) => {
  if (name === "peso") {
    return (
      <span style={{ fontSize: size * 0.95, fontWeight: 700, color, lineHeight: 1 }}>
        ₱
      </span>
    );
  }
  const paths: Record<string, ReactNode> = {
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />,
    power: (
      <>
        <path d="M12 3v8" />
        <path d="M6.3 6.3a8 8 0 1 0 11.4 0" />
      </>
    ),
    bell: (
      <>
        <path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4z" />
        <path d="M10 20.5a2 2 0 0 0 4 0" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="3" />
        <path d="M16 12.5h2" />
        <path d="M6 6l9-3 1 3" />
      </>
    ),
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
};
