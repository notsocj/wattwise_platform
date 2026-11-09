import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Backdrop, C, FONT, Kicker, LiveDot, Phone, prog, rise } from "../ui";

/** A reading that changes every few frames, like Realtime pushes. */
const reading = (frame: number, base: number, amp: number, seed: number) => {
  const t = Math.floor(frame / 7);
  return base + Math.sin(t * 1.7 + seed * 3.1) * amp + Math.sin(t * 0.6 + seed) * amp * 0.5;
};
const fmt = (n: number, digits = 0) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const DEVICES = [
  { name: "Aircon", room: "Bedroom", base: 1248, amp: 18 },
  { name: "Refrigerator", room: "Kitchen", base: 142, amp: 4 },
  { name: "Television", room: "Living room", base: 86, amp: 3 },
  { name: "Electric fan", room: "Bedroom", base: 46, amp: 2 },
];

const SPARK = Array.from({ length: 32 }, (_, i) => {
  const y = 70 - Math.sin(i * 0.45) * 24 - Math.sin(i * 1.3) * 10 - i * 0.8;
  return `${i === 0 ? "M" : "L"} ${i * 12} ${y.toFixed(1)}`;
}).join(" ");

const LiveInner = () => {
  const frame = useCurrentFrame();
  const total = DEVICES.reduce((sum, d, i) => sum + reading(frame, d.base, d.amp, i), 0);
  const stats = [
    { at: 100, value: fmt(reading(frame, 1248, 18, 0)), unit: "W", label: "Power" },
    { at: 112, value: fmt(reading(frame, 230.4, 0.6, 7), 1), unit: "V", label: "Voltage" },
    { at: 124, value: fmt(reading(frame, 5.42, 0.08, 3), 2), unit: "A", label: "Current" },
  ];
  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: C.fg }}>
      <Backdrop glowX={72} glowY={40} />
      <Audio name="Transition clap" src={staticFile("sfx/clap.mp3")} from={0} volume={0.55} />
      <Audio name="Narration" src={staticFile("voiceover/03-live.mp3")} from={15} />

      <Kicker style={{ position: "absolute", left: 140, top: 170, ...rise(frame, 6) }}>LIVE DASHBOARD</Kicker>
      <Interactive.Div
        name="Headline"
        style={{
          position: "absolute",
          left: 140,
          top: 230,
          width: 900,
          fontSize: 124,
          fontWeight: 700,
          lineHeight: 1.02,
          letterSpacing: "-0.02em",
          opacity: interpolate(frame, [10, 30], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          }),
          translate: interpolate(frame, [10, 30], ["0px 50px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          }),
        }}
      >
        Watch every watt, live.
      </Interactive.Div>
      <div style={{ position: "absolute", left: 140, top: 520, width: 1060, fontSize: 46, lineHeight: 1.3, color: "rgba(255,255,255,0.62)", ...rise(frame, 60, 24) }}>
        Streamed in real time. No page reloads.
      </div>

      <div style={{ position: "absolute", left: 140, top: 680, display: "flex", gap: 28 }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              width: 270,
              padding: "30px 32px",
              boxSizing: "border-box",
              borderRadius: 28,
              background: C.surface,
              border: "2px solid rgba(255,255,255,0.08)",
              ...rise(frame, s.at, 30),
            }}
          >
            <div style={{ fontSize: 28, color: "rgba(255,255,255,0.5)" }}>{s.label}</div>
            <div style={{ fontSize: 66, fontWeight: 700, marginTop: 8, fontVariantNumeric: "tabular-nums" }}>
              {s.value}
              <span style={{ fontSize: 36, color: C.mint, marginLeft: 8 }}>{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <Phone width={500} height={900} style={{ left: 1240, top: 90, ...rise(frame, 4, 120) }}>
        <div style={{ padding: "80px 32px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 40, fontWeight: 700 }}>Dashboard</div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 18px",
                borderRadius: 999,
                background: "rgba(0,230,111,0.12)",
                color: C.mint,
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              <LiveDot size={11} /> LIVE
            </div>
          </div>

          <div style={{ marginTop: 26, padding: 28, borderRadius: 28, background: C.surface }}>
            <div style={{ fontSize: 22, color: "rgba(255,255,255,0.5)" }}>Right now</div>
            <div style={{ fontSize: 58, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {fmt(total)} <span style={{ fontSize: 30, color: C.mint }}>W</span>
            </div>
            <svg width={372} height={90} viewBox="0 0 372 90" style={{ marginTop: 8 }}>
              <path
                d={SPARK}
                fill="none"
                stroke={C.mint}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={600}
                strokeDashoffset={600 * (1 - prog(frame, 30, 60))}
              />
            </svg>
          </div>

          {DEVICES.map((d, i) => (
            <div
              key={d.name}
              style={{
                marginTop: 16,
                padding: "22px 26px",
                borderRadius: 24,
                background: C.surface,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                ...rise(frame, 40 + i * 10, 24),
              }}
            >
              <div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{d.name}</div>
                <div style={{ fontSize: 20, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{d.room}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: C.mint, fontVariantNumeric: "tabular-nums" }}>
                  {fmt(reading(frame, d.base, d.amp, i))} W
                </div>
                <div style={{ fontSize: 18, color: "rgba(255,255,255,0.45)", display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                  <LiveDot size={8} /> live
                </div>
              </div>
            </div>
          ))}
        </div>
      </Phone>
    </AbsoluteFill>
  );
};

export const Live = Interactive.create({
  Component: LiveInner,
  layout: "absolute-fill",
});
