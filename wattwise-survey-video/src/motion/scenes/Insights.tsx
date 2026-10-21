import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  Arrow,
  clamp,
  Label,
  palette,
  pos,
  progress,
  Reveal,
  Shell,
  Shot,
  Sparkline,
  Tag,
} from "../design";
const Taglish = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: palette.paper, color: palette.ink }}>
      <Label style={pos(110, 155)}>ENERGY INSIGHTS / TAGLISH</Label>
      <div style={pos(115, 260, 1190)}>
        <Reveal
          style={{
            fontSize: 122,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -5,
          }}
        >
          Mas mataas
        </Reveal>
        <Reveal
          at={10}
          style={{
            fontSize: 122,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -5,
          }}
        >
          ang gamit nitong
        </Reveal>
        <Reveal
          at={20}
          style={{
            fontSize: 122,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -5,
          }}
        >
          weekend<span style={{ color: "#10B981" }}>.</span>
        </Reveal>
      </div>
      <div
        style={{
          ...pos(1450, 245),
          fontSize: 290,
          fontWeight: 700,
          lineHeight: 0.9,
          color: "#10B981",
          rotate: interpolate(f, [0, 140], ["15deg", "0deg"], clamp),
        }}
      >
        “
      </div>
      <div
        style={{
          ...pos(120, 775),
          display: "flex",
          alignItems: "center",
          gap: 28,
          opacity: progress(f, 70),
        }}
      >
        <Tag dark>Recorded usage</Tag>
        <Arrow dark width={140} />
        <Tag dark>Practical guidance</Tag>
      </div>
    </AbsoluteFill>
  );
};
const Alerts = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Label style={{ ...pos(110, 150), color: palette.mint }}>
        CHANGES WORTH REVIEWING
      </Label>
      <div
        style={{
          ...pos(110, 245),
          width: 710,
          height: 545,
          border: "1px solid #F59E0B66",
          borderRadius: 35,
          padding: 45,
          background: "#F59E0B0b",
          translate: interpolate(f, [0, 30], ["-70px 0px", "0px 0px"], clamp),
        }}
      >
        <Label style={{ color: palette.amber }}>BUDGET WARNING</Label>
        <div
          style={{
            fontSize: 170,
            fontWeight: 700,
            color: palette.amber,
            letterSpacing: -6,
            marginTop: 35,
          }}
        >
          80<span style={{ fontSize: 80 }}>%</span>
        </div>
        <div style={{ fontSize: 39, marginTop: 40 }}>
          Approaching the limit.
        </div>
      </div>
      <div style={{ ...pos(970, 260), width: 820, opacity: progress(f, 18) }}>
        <Label>UNUSUAL USE</Label>
        <div style={{ marginTop: 60 }}>
          <Sparkline width={790} height={275} spike />
        </div>
        <div style={{ marginTop: 40, fontSize: 34, color: palette.grey }}>
          A pattern to investigate.
        </div>
        <div
          style={{
            position: "absolute",
            left: 490,
            top: 65,
            width: 125,
            height: 125,
            border: "2px solid #00E66F",
            borderRadius: "50%",
            opacity: progress(f, 70),
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
const Choice = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <div style={pos(110, 200)}>
        <Label style={{ color: palette.mint }}>
          INSIGHTS INFORM. YOU DECIDE.
        </Label>
        <Reveal
          style={{
            fontSize: 145,
            fontWeight: 700,
            letterSpacing: -6,
            lineHeight: 1.05,
            marginTop: 35,
          }}
        >
          Your household.
          <br />
          Your choice.
        </Reveal>
      </div>
      <div
        style={{
          ...pos(130, 680),
          fontSize: 38,
          color: palette.grey,
          opacity: progress(f, 30),
        }}
      >
        Actual savings depend on how you use your appliances.
      </div>
      <div
        style={{
          ...pos(1450, 280),
          width: 270,
          height: 270,
          borderRadius: "50%",
          border: "2px solid #00E66F",
          scale: interpolate(f, [0, 170], [0.94, 1.05], clamp),
        }}
      >
        <svg width="270" height="270">
          <path
            d="M64 137L111 180L201 87"
            stroke={palette.mint}
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - progress(f, 20, 40)}
          />
        </svg>
      </div>
    </AbsoluteFill>
  );
};
export const InsightsMotion = () => {
  const f = useCurrentFrame();
  return (
    <Shell index={6} light={f < 246}>
      <Shot start={0} end={8.2} name="Taglish typography">
        <Taglish />
      </Shot>
      <Shot start={8.2} end={13.2} name="Budget and unusual use">
        <Alerts />
      </Shot>
      <Shot start={13.2} end={19.167} name="Household choice">
        <Choice />
      </Shot>
    </Shell>
  );
};
