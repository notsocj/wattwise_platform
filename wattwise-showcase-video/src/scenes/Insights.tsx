import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Backdrop, C, FONT, Icon, Kicker, Owl, pop, prog, rise } from "../ui";

const CAL_AT = 100;
const TIP_AT = 185;
const REPORT_AT = 272;
const TAP = 336;
const HEAVIEST = 19; // index of the highlighted day

const TIP =
  "Naku, tumaas ng 18% ang gamit ng aircon mo this week. Try mo i-set sa 25°C — makakatipid ka ng mga ₱120 this month.";

const PANEL = {
  width: 520,
  height: 560,
  padding: 36,
  boxSizing: "border-box" as const,
  borderRadius: 32,
  background: C.surface,
  border: "2px solid rgba(255,255,255,0.08)",
};

const InsightsInner = () => {
  const frame = useCurrentFrame();
  const words = TIP.split(" ");
  const shown = Math.round(interpolate(frame, [TIP_AT + 12, TIP_AT + 80], [0, words.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const done = prog(frame, TAP + 4, 10);
  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: C.fg }}>
      <Backdrop glowX={50} glowY={70} />
      <Audio name="Transition clap" src={staticFile("sfx/clap.mp3")} from={0} volume={0.55} />
      <Audio name="Narration" src={staticFile("voiceover/07-insights.mp3")} from={15} />
      <Audio name="Export chime" src={staticFile("sfx/success.mp3")} from={TAP + 4} volume={0.6} />

      <Kicker style={{ position: "absolute", left: 140, top: 120, ...rise(frame, 6) }}>INSIGHTS & REPORTS</Kicker>
      <Interactive.Div
        name="Headline"
        style={{
          position: "absolute",
          left: 140,
          top: 175,
          fontSize: 112,
          fontWeight: 700,
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
        Data you can act on.
      </Interactive.Div>

      <div style={{ position: "absolute", left: 140, top: 400, display: "flex", gap: 40 }}>
        {/* Calendar */}
        <div style={{ ...PANEL, ...rise(frame, CAL_AT, 50) }}>
          <div style={{ fontSize: 38, fontWeight: 700 }}>Calendar</div>
          <div style={{ fontSize: 26, color: "rgba(255,255,255,0.5)" }}>November · daily kWh</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10, marginTop: 26 }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 20, color: "rgba(255,255,255,0.4)" }}>{d}</div>
            ))}
            {Array.from({ length: 30 }, (_, i) => {
              const v = i === HEAVIEST ? 1 : 0.15 + random(`day-${i}`) * 0.6;
              const p = prog(frame, CAL_AT + 6 + i * 1.2, 10);
              return (
                <div
                  key={i}
                  style={{
                    height: 50,
                    borderRadius: 12,
                    background: `rgba(0,230,111,${v * p})`,
                    outline: i === HEAVIEST ? `4px solid rgba(255,255,255,${prog(frame, 150, 12)})` : "none",
                    outlineOffset: 3,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    color: v > 0.6 ? C.ink : "rgba(255,255,255,0.6)",
                  }}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 22, fontSize: 28, display: "flex", justifyContent: "space-between", ...rise(frame, 152, 16) }}>
            <span style={{ color: "rgba(255,255,255,0.6)" }}>Heaviest · Fri 20</span>
            <b style={{ color: C.mint }}>14.2 kWh</b>
          </div>
        </div>

        {/* AI tip */}
        <div style={{ ...PANEL, ...rise(frame, TIP_AT, 50) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: 64, background: "rgba(0,230,111,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Owl size={40} />
            </div>
            <div>
              <div style={{ fontSize: 38, fontWeight: 700 }}>AI tip</div>
              <div style={{ fontSize: 24, color: "rgba(255,255,255,0.5)" }}>In plain Taglish</div>
            </div>
          </div>
          <div style={{ fontSize: 36, lineHeight: 1.4, marginTop: 30 }}>
            {words.map((w, i) => (
              <span key={i} style={{ opacity: i < shown ? 1 : 0.08, color: w.startsWith("₱") || w === "18%" ? C.mint : C.fg }}>
                {w}{" "}
              </span>
            ))}
          </div>
        </div>

        {/* Reports */}
        <div style={{ ...PANEL, ...rise(frame, REPORT_AT, 50) }}>
          <div style={{ fontSize: 38, fontWeight: 700 }}>Reports</div>
          <div style={{ fontSize: 26, color: "rgba(255,255,255,0.5)" }}>October · by appliance</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 200, marginTop: 30 }}>
            {[0.92, 0.38, 0.22, 0.55, 0.15].map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${h * 100 * prog(frame, REPORT_AT + 10 + i * 4, 20)}%`, borderRadius: 12, background: i === 0 ? C.mint : "rgba(255,255,255,0.18)" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 40 }}>
            {["PDF", "CSV"].map((f, i) => (
              <div
                key={f}
                style={{
                  flex: 1,
                  height: 84,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  fontSize: 34,
                  fontWeight: 700,
                  background: i === 0 ? C.mint : "transparent",
                  color: i === 0 ? C.ink : C.fg,
                  border: i === 0 ? "none" : "2px solid rgba(255,255,255,0.2)",
                  scale: i === 0 ? String(1 - 0.07 * Math.sin(Math.PI * prog(frame, TAP - 4, 8))) : "1",
                }}
              >
                {i === 0 && done > 0 ? <Icon name="check" size={36} color={C.ink} /> : null}
                {f}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, fontSize: 26, color: C.mint, textAlign: "center", ...pop(frame, TAP + 6) }}>
            Exported in one tap
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Insights = Interactive.create({
  Component: InsightsInner,
  layout: "absolute-fill",
});
