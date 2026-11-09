import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Backdrop, C, FONT, LiveDot, Owl, Phone, pop, prog, rise } from "../ui";

const MODULES = [
  { at: 120, name: "ESP32-S3", note: "Wi-Fi brain" },
  { at: 135, name: "PZEM-004T", note: "Measures W · V · A" },
  { at: 150, name: "Smart relay", note: "Switches power" },
];

const VERBS = [
  { at: 228, text: "Shows" },
  { at: 252, text: "Explains" },
  { at: 278, text: "Controls" },
];

const IntroInner = () => {
  const frame = useCurrentFrame();
  const logoOut = 1 - prog(frame, 104, 14);
  const flow = prog(frame, 172, 40);
  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: C.fg }}>
      <Backdrop glowX={50} glowY={45} />
      <Audio name="Logo clap" src={staticFile("sfx/clap.mp3")} from={8} volume={0.8} />
      <Audio name="Narration" src={staticFile("voiceover/02-intro.mp3")} from={30} />

      {/* Logo reveal */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          opacity: logoOut,
          scale: String(1 + (1 - logoOut) * 0.08),
        }}
      >
        <div style={{ ...pop(frame, 12), filter: `drop-shadow(0 0 ${40 + Math.sin(frame / 8) * 14}px rgba(0,230,111,0.55))` }}>
          <Owl size={260} />
        </div>
        <Interactive.Div
          name="Wordmark"
          style={{
            marginTop: 30,
            fontSize: 176,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            opacity: interpolate(frame, [32, 50], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.23, 1, 0.32, 1),
            }),
            translate: interpolate(frame, [32, 50], ["0px 40px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.23, 1, 0.32, 1),
            }),
          }}
        >
          WattWise
        </Interactive.Div>
        <div style={{ fontSize: 52, color: "rgba(255,255,255,0.62)", ...rise(frame, 52, 24) }}>
          Smart energy monitoring for Filipino homes
        </div>
      </AbsoluteFill>

      {/* Hardware + app */}
      <div
        style={{
          position: "absolute",
          left: 140,
          top: 120,
          display: "flex",
          alignItems: "center",
          gap: 20,
          fontSize: 52,
          fontWeight: 700,
          ...rise(frame, 112, 20),
        }}
      >
        <Owl size={64} /> WattWise
      </div>

      <div
        style={{
          position: "absolute",
          left: 140,
          top: 240,
          width: 680,
          padding: 44,
          boxSizing: "border-box",
          borderRadius: 36,
          background: C.surface,
          border: "2px solid rgba(255,255,255,0.08)",
          ...rise(frame, 114, 50),
        }}
      >
        <div style={{ fontSize: 30, letterSpacing: "0.18em", fontWeight: 700, color: C.mint }}>
          SMART SUB-METER
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 30 }}>
          {MODULES.map((m) => (
            <div
              key={m.name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 26px",
                borderRadius: 22,
                background: "rgba(0,0,0,0.35)",
                border: "2px solid rgba(0,230,111,0.18)",
                whiteSpace: "nowrap",
                ...rise(frame, m.at, 30),
              }}
            >
              <span style={{ fontSize: 40, fontWeight: 700 }}>{m.name}</span>
              <span style={{ fontSize: 26, color: "rgba(255,255,255,0.55)" }}>{m.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Data flowing from the meter to the app */}
      <svg style={{ position: "absolute", left: 830, top: 470, overflow: "visible" }} width={400} height={20}>
        <line
          x1={0}
          y1={10}
          x2={400 * flow}
          y2={10}
          stroke="rgba(0,230,111,0.5)"
          strokeWidth={4}
          strokeDasharray="12 12"
          strokeDashoffset={-frame * 2}
        />
        {[0, 1, 2].map((i) => {
          const t = ((frame - 180) / 40 + i / 3) % 1;
          return frame > 190 ? <circle key={i} cx={t * 400} cy={10} r={9} fill={C.mint} /> : null;
        })}
      </svg>

      <Phone width={460} height={820} style={{ left: 1290, top: 130, ...rise(frame, 176, 80) }}>
        <div style={{ padding: "84px 34px 0" }}>
          <div style={{ fontSize: 24, color: "rgba(255,255,255,0.5)" }}>This month</div>
          <div style={{ fontSize: 60, fontWeight: 700, marginTop: 4 }}>₱1,284.60</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 22, color: C.mint }}>
            <LiveDot size={12} /> 3 devices live
          </div>
          {[
            ["Aircon", "1,248 W"],
            ["Refrigerator", "142 W"],
            ["Television", "86 W"],
          ].map(([n, w], i) => (
            <div
              key={n}
              style={{
                marginTop: i === 0 ? 34 : 16,
                padding: "24px 24px",
                borderRadius: 24,
                background: C.surface,
                display: "flex",
                justifyContent: "space-between",
                fontSize: 28,
                ...rise(frame, 196 + i * 8, 20),
              }}
            >
              <span>{n}</span>
              <span style={{ fontWeight: 700, color: C.mint }}>{w}</span>
            </div>
          ))}
        </div>
      </Phone>

      <div style={{ position: "absolute", left: 140, top: 790, display: "flex", gap: 44 }}>
        {VERBS.map((v) => (
          <div key={v.text} style={{ fontSize: 84, fontWeight: 700, letterSpacing: "-0.02em", ...pop(frame, v.at) }}>
            {v.text}
            <span style={{ color: C.mint }}>.</span>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 140, top: 905, fontSize: 48, color: "rgba(255,255,255,0.6)", ...rise(frame, 300, 20) }}>
        One appliance at a time.
      </div>
    </AbsoluteFill>
  );
};

export const Intro = Interactive.create({
  Component: IntroInner,
  layout: "absolute-fill",
});
