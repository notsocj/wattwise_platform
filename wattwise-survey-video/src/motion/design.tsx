import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  Sequence,
  useCurrentFrame,
} from "remotion";
import story from "../story.json";

export const palette = {
  ink: "#121212",
  panel: "#1E1E1E",
  mint: "#00E66F",
  paper: "#F3F2EB",
  grey: "#9BA59D",
  amber: "#F59E0B",
};
export const out = Easing.bezier(0.23, 1, 0.32, 1);
export const inOut = Easing.bezier(0.77, 0, 0.175, 1);
export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: out,
} as const;
export const progress = (frame: number, at = 0, length = 24) =>
  interpolate(frame, [at, at + length], [0, 1], { ...clamp, easing: out });
export const pos = (
  left: number,
  top: number,
  width?: number,
): CSSProperties => ({ position: "absolute", left, top, width });
export const Shell = ({
  index,
  light = false,
  green = false,
  children,
}: {
  index: number;
  light?: boolean;
  green?: boolean;
  children: ReactNode;
}) => {
  const frame = useCurrentFrame();
  const data = story[index];
  const dark = light || green;
  const fg = dark ? palette.ink : palette.paper;
  const caption = data.captions.find(
    (c) => (frame / 30) * 1000 >= c.startMs && (frame / 30) * 1000 < c.endMs,
  );
  return (
    <AbsoluteFill
      style={{
        background: green ? palette.mint : light ? palette.paper : palette.ink,
        color: fg,
        fontFamily: "Space",
        overflow: "hidden",
      }}
    >
      {children}
      <div
        style={{
          ...pos(88, 42),
          fontSize: 27,
          fontWeight: 700,
          letterSpacing: -1,
          zIndex: 60,
        }}
      >
        Watt
        <span style={{ color: dark ? palette.ink : palette.mint }}>Wise</span>
        <span
          style={{
            marginLeft: 20,
            fontSize: 17,
            fontWeight: 400,
            letterSpacing: 2,
            opacity: 0.5,
          }}
        >
          {" "}
          / {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          right: 88,
          top: 49,
          fontSize: 18,
          letterSpacing: 2,
          opacity: 0.55,
          zIndex: 60,
        }}
      >
        {index === 1
          ? "CONCEPT HARDWARE"
          : index === 9
            ? "YOUR EXPERIENCE MATTERS"
            : "ILLUSTRATIVE DATA & INTERFACES"}
      </div>
      {caption && (
        <div
          style={{
            position: "absolute",
            bottom: 35,
            left: 140,
            right: 140,
            display: "flex",
            justifyContent: "center",
            zIndex: 80,
          }}
        >
          <div
            style={{
              fontSize: 30,
              lineHeight: 1.25,
              textAlign: "center",
              padding: "15px 28px",
              borderRadius: 16,
              background: dark ? "rgba(18,18,18,.92)" : "rgba(30,30,30,.94)",
              color: palette.paper,
              maxWidth: 1600,
              boxShadow: "0 4px 30px #0002",
            }}
          >
            {caption.text}
          </div>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 70,
          pointerEvents: "none",
          background: dark ? palette.ink : palette.mint,
          clipPath: `inset(0 ${interpolate(
            frame,
            [data.duration - 12, data.duration - 1],
            [100, 0],
            { ...clamp, easing: inOut },
          )}% 0 0)`,
        }}
      />
    </AbsoluteFill>
  );
};
export const Shot = ({
  start,
  end,
  name,
  children,
}: {
  start: number;
  end: number;
  name: string;
  children: ReactNode;
}) => (
  <Sequence
    name={name}
    from={Math.round(start * 30)}
    durationInFrames={Math.round((end - start) * 30)}
  >
    <ShotBody>{children}</ShotBody>
  </Sequence>
);
const ShotBody = ({ children }: { children: ReactNode }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: progress(f, 0, 9) }}>
      {children}
    </AbsoluteFill>
  );
};
export const Reveal = ({
  children,
  at = 0,
  style = {},
  name = "Text reveal",
}: {
  children: ReactNode;
  at?: number;
  style?: CSSProperties;
  name?: string;
}) => {
  const frame = useCurrentFrame();
  return (
    <Interactive.Div name={name} style={{ ...style, overflow: "hidden" }}>
      <div
        style={{
          translate: interpolate(frame, [at, at + 22], ["0px 110%", "0px 0%"], {
            ...clamp,
            easing: out,
          }),
          opacity: progress(frame, at, 12),
        }}
      >
        {children}
      </div>
    </Interactive.Div>
  );
};
export const Label = ({
  children,
  style = {},
}: {
  children: ReactNode;
  style?: CSSProperties;
}) => (
  <div
    style={{
      fontSize: 24,
      letterSpacing: 4,
      textTransform: "uppercase",
      ...style,
    }}
  >
    {children}
  </div>
);
export const Tag = ({
  children,
  dark = false,
}: {
  children: ReactNode;
  dark?: boolean;
}) => (
  <div
    style={{
      display: "inline-block",
      padding: "12px 19px",
      fontSize: 26,
      border: `1px solid ${dark ? "#12121233" : "#ffffff2c"}`,
      borderRadius: 40,
      background: dark ? "#12121208" : "#ffffff06",
    }}
  >
    {children}
  </div>
);
export const NumberValue = ({
  value,
  decimals = 0,
  at = 0,
  frames = 50,
}: {
  value: number;
  decimals?: number;
  at?: number;
  frames?: number;
}) => {
  const f = useCurrentFrame();
  return (
    <>
      {(value * progress(f, at, frames)).toLocaleString("en-PH", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </>
  );
};
export const Fan = ({
  size = 300,
  spin = true,
  dark = false,
}: {
  size?: number;
  spin?: boolean;
  dark?: boolean;
}) => {
  const f = useCurrentFrame();
  return (
    <svg width={size} height={size} viewBox="0 0 300 300">
      <circle
        cx="150"
        cy="137"
        r="108"
        fill="none"
        stroke={dark ? "#121212" : "#ffffff"}
        strokeWidth="3"
        opacity=".2"
      />
      <circle
        cx="150"
        cy="137"
        r="88"
        fill="none"
        stroke={dark ? "#121212" : "#ffffff"}
        strokeWidth="2"
        opacity=".15"
      />
      <g
        style={{
          transformOrigin: "150px 137px",
          rotate: spin ? `${f * 3}deg` : "0deg",
        }}
      >
        {[0, 120, 240].map((r) => (
          <path
            key={r}
            d="M150 137 C107 91 156 35 190 66 C220 92 177 126 150 137Z"
            fill={dark ? "#121212" : palette.mint}
            transform={`rotate(${r} 150 137)`}
          />
        ))}
      </g>
      <circle
        cx="150"
        cy="137"
        r="14"
        fill={dark ? palette.mint : palette.ink}
      />
      <path
        d="M150 247V274M111 283H189"
        fill="none"
        stroke={dark ? "#121212" : palette.paper}
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
};
export const House = ({
  size = 260,
  dark = false,
}: {
  size?: number;
  dark?: boolean;
}) => (
  <svg width={size} height={size} viewBox="0 0 260 260">
    <path
      d="M30 125L130 34L230 125M55 112V225H205V112"
      fill="none"
      stroke={dark ? palette.ink : palette.paper}
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M146 94L112 146H139L120 184L165 130H139Z"
      fill={dark ? palette.ink : palette.mint}
    />
  </svg>
);
export const Bolt = ({
  size = 160,
  color = palette.mint,
}: {
  size?: number;
  color?: string;
}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M59 5L18 56H48L39 95L85 40H56Z" fill={color} />
  </svg>
);
export const Ring = ({
  percent = 42,
  size = 500,
  dark = false,
  at = 0,
}: {
  percent?: number;
  size?: number;
  dark?: boolean;
  at?: number;
}) => {
  const f = useCurrentFrame();
  const p = progress(f, at, 75);
  return (
    <svg width={size} height={size} viewBox="0 0 500 500">
      <circle
        cx="250"
        cy="250"
        r="208"
        fill="none"
        stroke={dark ? "#12121218" : "#ffffff13"}
        strokeWidth="26"
      />
      {Array.from({ length: 60 }, (_, i) => (
        <line
          key={i}
          x1="250"
          y1="8"
          x2="250"
          y2={i % 5 === 0 ? 25 : 17}
          stroke={dark ? palette.ink : palette.paper}
          opacity=".25"
          transform={`rotate(${i * 6} 250 250)`}
        />
      ))}
      <circle
        cx="250"
        cy="250"
        r="208"
        fill="none"
        stroke={dark ? palette.ink : palette.mint}
        strokeWidth="26"
        strokeLinecap="round"
        strokeDasharray={1306.9}
        strokeDashoffset={1306.9 * (1 - (percent * p) / 100)}
        transform="rotate(-90 250 250)"
      />
      <text
        x="250"
        y="265"
        textAnchor="middle"
        fill={dark ? palette.ink : palette.paper}
        fontFamily="Space"
        fontWeight="700"
        fontSize="115"
      >
        {Math.round(percent * p)}
        <tspan fontSize="52">%</tspan>
      </text>
      <text
        x="250"
        y="315"
        textAnchor="middle"
        fill={dark ? palette.ink : palette.grey}
        fontFamily="Space"
        fontSize="25"
      >
        OF HOME BUDGET
      </text>
    </svg>
  );
};
export const Grid = ({ light = false }: { light?: boolean }) => (
  <AbsoluteFill
    style={{
      backgroundImage: `linear-gradient(${light ? "#1212120c" : "#ffffff08"} 1px,transparent 1px),linear-gradient(90deg,${light ? "#1212120c" : "#ffffff08"} 1px,transparent 1px)`,
      backgroundSize: "96px 96px",
      opacity: 0.6,
    }}
  />
);
export const Sparkline = ({
  width = 800,
  height = 220,
  spike = false,
  dark = false,
}: {
  width?: number;
  height?: number;
  spike?: boolean;
  dark?: boolean;
}) => {
  const f = useCurrentFrame();
  const p = progress(f, 0, 65);
  const path = spike
    ? "M0 180L80 160L150 170L230 155L310 180L380 140L450 160L510 25L565 175L640 145L710 150L800 120"
    : "M0 180L80 165L150 178L230 130L310 145L380 90L450 105L510 65L565 80L640 42L710 60L800 20";
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 800 220"
      preserveAspectRatio="none"
      style={{ overflow: "visible" }}
    >
      <path
        d={path}
        fill="none"
        stroke={dark ? palette.ink : palette.mint}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset={1 - p}
      />
      <path d="M0 220H800" stroke={dark ? "#12121222" : "#ffffff22"} />
      {Array.from({ length: 9 }, (_, i) => (
        <line
          key={i}
          x1={i * 100}
          y1="0"
          x2={i * 100}
          y2="220"
          stroke={dark ? "#12121212" : "#ffffff10"}
        />
      ))}
    </svg>
  );
};
export const DotField = () => {
  const f = useCurrentFrame();
  return (
    <svg
      width="1920"
      height="1080"
      style={{ position: "absolute", inset: 0, opacity: 0.2 }}
    >
      {Array.from({ length: 50 }, (_, i) => (
        <circle
          key={i}
          cx={(i * 173.7 + f * (i % 2 ? 0.15 : -0.1) + 1920) % 1920}
          cy={(i * 127.3) % 1080}
          r={i % 7 === 0 ? 4 : 1.5}
          fill={palette.mint}
        />
      ))}
    </svg>
  );
};
export const Arrow = ({
  dark = false,
  width = 260,
}: {
  dark?: boolean;
  width?: number;
}) => {
  const f = useCurrentFrame();
  return (
    <svg width={width} height="50" viewBox="0 0 260 50">
      <path
        d="M0 25H248M227 4L249 25L227 46"
        fill="none"
        stroke={dark ? palette.ink : palette.mint}
        strokeWidth="3"
        strokeLinecap="round"
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset={1 - progress(f, 8, 28)}
      />
    </svg>
  );
};

/** Decorative energy strands: deterministic frame-driven geometry, not telemetry. */
export const EnergyRibbon = () => {
  const frame = useCurrentFrame();
  return (
    <svg
      width={1920}
      height={1080}
      style={{
        position: "absolute",
        inset: 0,
        opacity: 0.17,
        pointerEvents: "none",
      }}
    >
      <defs>
        <linearGradient id="energy-strand" x1="0" x2="1">
          <stop stopColor="#00E66F" stopOpacity="0" />
          <stop offset=".45" stopColor="#00E66F" />
          <stop offset="1" stopColor="#00E66F" stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: 12 }, (_, i) => {
        const a = 140 + Math.sin(frame * 0.013 + i * 0.13) * 65;
        const b = 880 + Math.cos(frame * 0.013 + i * 0.16) * 80;
        return (
          <path
            key={i}
            d={`M-100 ${730 + i * 13} C550 ${a + i * 8},1150 ${b + i * 6},2050 ${250 + i * 15}`}
            fill="none"
            stroke="url(#energy-strand)"
            strokeWidth={i % 4 === 0 ? 2.5 : 1}
          />
        );
      })}
    </svg>
  );
};
