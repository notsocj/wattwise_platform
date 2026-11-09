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
import { Backdrop, C, FONT, Kicker, pop, prog, rise } from "../ui";

// Cold open: a family reacts to the bill in Tagalog, then the narrator starts at N.
const N = 325;

const PAINS = [
  { at: N + 210, text: "Arrives weeks late" },
  { at: N + 264, text: "One total, no breakdown" },
  { at: N + 315, text: "No clue which appliance" },
];

// Each chip pops as its appliance is named in the family lines.
const SUSPECTS = [
  { at: 140, x: 900, y: 560, text: "Aircon" },
  { at: 207, x: 1600, y: 190, text: "Ref" },
  { at: 244, x: 990, y: 830, text: "TV" },
  { at: 291, x: 1560, y: 900, text: "Washer" },
];

const ProblemInner = () => {
  const frame = useCurrentFrame();
  // The bill sits centred during the cold open, then moves right for the headline.
  const shift = prog(frame, N - 12, 26);
  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: C.fg }}>
      <Backdrop glowX={78} glowY={50} tint="245,158,11" />
      <Audio name="Paper SFX" src={staticFile("sfx/paper.mp3")} from={4} volume={0.8} />
      <Audio name="Mom: bakit ang taas" src={staticFile("voiceover/00a-mom-bill.mp3")} from={16} />
      <Audio name="Dad: aircon" src={staticFile("voiceover/00b-dad-aircon.mp3")} from={118} />
      <Audio name="Daughter: ref" src={staticFile("voiceover/00c-daughter-ref.mp3")} from={180} />
      <Audio name="Dad: TV, washing" src={staticFile("voiceover/00d-dad-tv-washer.mp3")} from={226} />
      <Audio name="Narration" src={staticFile("voiceover/01-problem.mp3")} from={N} />

      <Kicker color={C.naku} style={{ position: "absolute", left: 140, top: 190, ...rise(frame, N - 8) }}>
        THE PROBLEM
      </Kicker>
      <Interactive.Div
        name="Headline"
        style={{
          position: "absolute",
          left: 140,
          top: 250,
          width: 900,
          fontSize: 120,
          fontWeight: 700,
          lineHeight: 1.02,
          letterSpacing: "-0.02em",
          opacity: interpolate(frame, [325, 345], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          }),
          translate: interpolate(frame, [325, 345], ["0px 50px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          }),
        }}
      >
        Where did all{" "}
        <span style={{ color: interpolateColors(frame, [N + 120, N + 140], [C.fg, C.naku]) }}>
          that power go?
        </span>
      </Interactive.Div>

      {PAINS.map((p, i) => (
        <div
          key={p.text}
          style={{
            position: "absolute",
            left: 140,
            top: 620 + i * 96,
            display: "flex",
            alignItems: "center",
            gap: 28,
            fontSize: 56,
            color: "rgba(255,255,255,0.82)",
            ...rise(frame, p.at, 30),
          }}
        >
          <span style={{ width: 14, height: 56, borderRadius: 8, background: C.naku }} />
          {p.text}
        </div>
      ))}

      <AbsoluteFill style={{ translate: `${(shift - 1) * 420}px 0px` }}>
        {/* The paper bill */}
        <div
          style={{
            position: "absolute",
            left: 1080,
            top: 150,
            width: 600,
            height: 780,
            borderRadius: 28,
            padding: 56,
            boxSizing: "border-box",
            background: C.paper,
            color: C.ink,
            rotate: "-4deg",
            boxShadow: "0 60px 140px rgba(0,0,0,0.6)",
            ...rise(frame, 2, 260),
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "0.18em", opacity: 0.55 }}>
            MONTHLY ELECTRIC BILL
          </div>
          <div style={{ fontSize: 30, marginTop: 12 }}>Billing period · Oct 1 – Oct 31</div>
          <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 26 }}>
            {[78, 64, 88, 52, 70, 60].map((w, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ height: 18, width: `${w * 0.6}%`, borderRadius: 9, background: "rgba(18,18,18,0.12)" }} />
                <div style={{ height: 18, width: "18%", borderRadius: 9, background: "rgba(18,18,18,0.12)" }} />
              </div>
            ))}
          </div>
          <div style={{ height: 3, background: "rgba(18,18,18,0.15)", margin: "52px 0 36px" }} />
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.14em", opacity: 0.6 }}>
            TOTAL AMOUNT DUE
          </div>
          <div style={{ fontSize: 104, fontWeight: 700, letterSpacing: "-0.02em" }}>₱4,872.50</div>
        </div>

        {/* Stamp lands as the mom says "Bakit ang taas" */}
        <div
          style={{
            position: "absolute",
            left: 1110,
            top: 430,
            padding: "18px 34px",
            border: `8px solid ${C.naku}`,
            borderRadius: 18,
            color: C.naku,
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
            rotate: "9deg",
            background: "rgba(243,242,235,0.85)",
            ...pop(frame, 46),
          }}
        >
          BAKIT ANG TAAS?!
        </div>

        {SUSPECTS.map((s, i) => (
          <div
            key={s.text}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y + Math.sin((frame + i * 20) / 14) * 8,
              padding: "16px 30px",
              borderRadius: 999,
              background: C.surface,
              border: "2px solid rgba(255,255,255,0.12)",
              fontSize: 40,
              fontWeight: 700,
              display: "flex",
              gap: 14,
              ...pop(frame, s.at),
            }}
          >
            {s.text}
            <span style={{ color: C.naku }}>?</span>
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Problem = Interactive.create({
  Component: ProblemInner,
  layout: "absolute-fill",
});
