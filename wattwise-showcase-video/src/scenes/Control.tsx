import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  interpolateColors,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Backdrop, C, FONT, Icon, Kicker, peso, pop, prog, rise } from "../ui";

const BUDGET = 1500;
const RELAY_OFF = 268;

const LEVELS = [
  { at: 132, pct: "50%", how: "In-app" },
  { at: 153, pct: "80%", how: "Push" },
  { at: 183, pct: "100%", how: "Push + email" },
];

const TOASTS = [
  { at: 140, tone: C.mint, title: "Heads up", body: "Aircon used 50% of its budget" },
  { at: 190, tone: C.naku, title: "80% reached", body: "₱1,200 of ₱1,500 spent" },
  { at: 250, tone: C.danger, title: "Budget reached", body: "Aircon turned off automatically" },
];

const ControlInner = () => {
  const frame = useCurrentFrame();
  const pct = interpolate(frame, [40, 140, 190, 248], [0, 50, 80, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const off = prog(frame, RELAY_OFF, 10);
  const barColor = interpolateColors(pct, [0, 60, 85, 100], [C.mint, C.mint, C.naku, C.danger]);
  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: C.fg }}>
      <Backdrop glowX={72} glowY={60} />
      <Audio name="Transition clap" src={staticFile("sfx/clap.mp3")} from={0} volume={0.55} />
      <Audio name="Narration" src={staticFile("voiceover/05-control.mp3")} from={15} />
      <Audio name="50% alert" src={staticFile("sfx/alert.mp3")} from={140} volume={0.45} />
      <Audio name="80% alert" src={staticFile("sfx/alert.mp3")} from={190} volume={0.5} />
      <Audio name="Relay off" src={staticFile("sfx/relay-off.mp3")} from={RELAY_OFF - 2} volume={0.9} />

      <Kicker style={{ position: "absolute", left: 140, top: 170, ...rise(frame, 6) }}>SMART CONTROL</Kicker>
      <Interactive.Div
        name="Headline"
        style={{
          position: "absolute",
          left: 140,
          top: 230,
          width: 800,
          fontSize: 116,
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
        Budgets that enforce themselves.
      </Interactive.Div>

      <div style={{ position: "absolute", left: 140, top: 640, fontSize: 36, color: "rgba(255,255,255,0.55)", ...rise(frame, 120, 20) }}>
        Alerts as you spend
      </div>
      <div style={{ position: "absolute", left: 140, top: 700, display: "flex", flexDirection: "column", gap: 18 }}>
        {LEVELS.map((l) => (
          <div key={l.pct} style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 48, ...rise(frame, l.at, 24) }}>
            <span style={{ width: 170, fontWeight: 700, color: C.mint }}>{l.pct}</span>
            <span style={{ color: "rgba(255,255,255,0.8)" }}>{l.how}</span>
          </div>
        ))}
      </div>

      {TOASTS.map((t, i) => (
        <div
          key={t.title}
          style={{
            position: "absolute",
            left: 1020,
            top: 110 + i * 116,
            width: 760,
            padding: "20px 28px",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            gap: 22,
            borderRadius: 24,
            background: "rgba(30,30,30,0.95)",
            border: `2px solid ${t.tone}55`,
            opacity: prog(frame, t.at, 14),
            translate: `${(1 - prog(frame, t.at, 14)) * 120}px 0px`,
          }}
        >
          <Icon name="bell" size={44} color={t.tone} />
          <div>
            <div style={{ fontSize: 30, fontWeight: 700, color: t.tone }}>{t.title}</div>
            <div style={{ fontSize: 28, color: "rgba(255,255,255,0.75)" }}>{t.body}</div>
          </div>
        </div>
      ))}

      <div
        style={{
          position: "absolute",
          left: 1020,
          top: 480,
          width: 760,
          padding: 48,
          boxSizing: "border-box",
          borderRadius: 36,
          background: C.surface,
          border: "2px solid rgba(255,255,255,0.08)",
          boxShadow: "0 50px 140px rgba(0,0,0,0.5)",
          ...rise(frame, 18, 80),
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 50, fontWeight: 700 }}>Aircon</div>
            <div style={{ fontSize: 28, color: "rgba(255,255,255,0.5)" }}>Bedroom · monthly budget {peso(BUDGET)}</div>
          </div>
          {/* Relay switch */}
          <div
            style={{
              width: 120,
              height: 66,
              borderRadius: 999,
              background: interpolateColors(off, [0, 1], [C.mint, "#3A3A3A"]),
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 7,
                left: 7 + (1 - off) * 54,
                width: 52,
                height: 52,
                borderRadius: 52,
                background: "#fff",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 40 }}>
          <span style={{ fontSize: 72, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{peso((BUDGET * pct) / 100)}</span>
          <span style={{ fontSize: 40, fontWeight: 700, color: barColor }}>{Math.round(pct)}%</span>
        </div>
        <div style={{ position: "relative", height: 26, borderRadius: 13, background: "rgba(255,255,255,0.08)", marginTop: 18 }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 13, background: barColor }} />
          {[50, 80].map((m) => (
            <div key={m} style={{ position: "absolute", left: `${m}%`, top: -8, width: 4, height: 42, borderRadius: 2, background: "rgba(255,255,255,0.4)" }} />
          ))}
        </div>

        <div
          style={{
            marginTop: 36,
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 34,
            fontWeight: 700,
            color: off > 0 ? C.danger : C.mint,
          }}
        >
          <Icon name="power" size={40} color={off > 0 ? C.danger : C.mint} />
          {off > 0 ? (
            <span style={{ ...pop(frame, RELAY_OFF) }}>Relay OFF · budget reached</span>
          ) : (
            <span>Relay ON · running</span>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Control = Interactive.create({
  Component: ControlInner,
  layout: "absolute-fill",
});
