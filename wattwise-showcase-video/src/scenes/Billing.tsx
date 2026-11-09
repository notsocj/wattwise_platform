import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Backdrop, C, FONT, Icon, Kicker, peso, pop, prog, rise } from "../ui";

// Illustrative amounts for a ~285 kWh month; they add up to TOTAL.
const ROWS = [
  { at: 120, label: "Generation", amount: 2104.5 },
  { at: 144, label: "Transmission", amount: 318.2 },
  { at: 158, label: "System loss", amount: 196.8 },
  { at: 172, label: "Distribution · 201–300 kWh tier", amount: 604.35 },
  { at: 186, label: "Supply & metering", amount: 49.9 },
  { at: 202, label: "Universal charges & taxes", amount: 152.75 },
  { at: 218, label: "VAT", amount: 389.1 },
];
const TOTAL = ROWS.reduce((sum, r) => sum + r.amount, 0);

const BillingInner = () => {
  const frame = useCurrentFrame();
  const counted = TOTAL * prog(frame, 236, 60);
  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: C.fg }}>
      <Backdrop glowX={70} glowY={55} />
      <Audio name="Transition clap" src={staticFile("sfx/clap.mp3")} from={0} volume={0.55} />
      <Audio name="Narration" src={staticFile("voiceover/04-billing.mp3")} from={15} />
      <Audio name="Synced ping" src={staticFile("sfx/success.mp3")} from={236} volume={0.4} />

      <Kicker style={{ position: "absolute", left: 140, top: 170, ...rise(frame, 6) }}>MERALCO-ACCURATE BILLING</Kicker>
      <Interactive.Div
        name="Headline"
        style={{
          position: "absolute",
          left: 140,
          top: 230,
          width: 780,
          fontSize: 120,
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
        Priced like the real bill.
      </Interactive.Div>

      <div
        style={{
          position: "absolute",
          left: 140,
          top: 640,
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "20px 32px",
          borderRadius: 999,
          background: "rgba(0,230,111,0.12)",
          border: "2px solid rgba(0,230,111,0.35)",
          fontSize: 40,
          fontWeight: 700,
          color: C.mint,
          ...pop(frame, 232),
        }}
      >
        <Icon name="check" size={44} /> Rates synced every month
      </div>

      <Interactive.Div
        name="Punchline"
        style={{
          position: "absolute",
          left: 140,
          top: 790,
          width: 820,
          fontSize: 64,
          fontWeight: 700,
          lineHeight: 1.15,
          opacity: interpolate(frame, [300, 320], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          }),
          translate: interpolate(frame, [300, 320], ["0px 30px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          }),
        }}
      >
        The peso you see is
        <br />
        <span style={{ color: C.mint }}>the peso you pay.</span>
      </Interactive.Div>

      <div
        style={{
          position: "absolute",
          left: 1020,
          top: 120,
          width: 760,
          padding: "48px 52px",
          boxSizing: "border-box",
          borderRadius: 36,
          background: C.surface,
          border: "2px solid rgba(255,255,255,0.08)",
          boxShadow: "0 50px 140px rgba(0,0,0,0.5)",
          ...rise(frame, 20, 80),
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 40, fontWeight: 700 }}>October estimate</div>
          <div style={{ fontSize: 30, color: "rgba(255,255,255,0.5)" }}>285 kWh</div>
        </div>
        <div style={{ height: 2, background: "rgba(255,255,255,0.08)", margin: "28px 0 10px" }} />
        {ROWS.map((r) => (
          <div
            key={r.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "16px 0",
              fontSize: 32,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              ...rise(frame, r.at, 20),
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.75)" }}>{r.label}</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{peso(r.amount)}</span>
          </div>
        ))}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginTop: 30,
            ...rise(frame, 232, 20),
          }}
        >
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.6)" }}>TOTAL</span>
          <span style={{ fontSize: 84, fontWeight: 700, color: C.mint, fontVariantNumeric: "tabular-nums" }}>
            {peso(counted)}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Billing = Interactive.create({
  Component: BillingInner,
  layout: "absolute-fill",
});
