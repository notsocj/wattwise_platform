import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  Bolt,
  clamp,
  Label,
  palette,
  pos,
  progress,
  Reveal,
  Shell,
  Shot,
} from "../design";
const Try = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <div style={pos(110, 170)}>
        <Label>THE NEXT STEP IS YOURS</Label>
        <Reveal
          style={{
            fontSize: 240,
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: -12,
            marginTop: 35,
          }}
        >
          Your turn.
        </Reveal>
      </div>
      <div style={{ ...pos(120, 595), display: "flex", gap: 25 }}>
        {["VIEW", "CHECK", "EXPLORE"].map((t, i) => (
          <div
            key={t}
            style={{
              padding: "35px 45px",
              border: "2px solid #121212",
              borderRadius: 25,
              fontSize: 40,
              fontWeight: 700,
              opacity: progress(f, 20 + i * 10),
              translate: interpolate(
                f,
                [20 + i * 10, 45 + i * 10],
                ["0px 45px", "0px 0px"],
                clamp,
              ),
            }}
          >
            {t} ↗
          </div>
        ))}
      </div>
      <div
        style={{
          ...pos(1510, 480),
          rotate: interpolate(f, [0, 100], ["-20deg", "0deg"], clamp),
        }}
      >
        <Bolt size={240} color={palette.ink} />
      </div>
    </AbsoluteFill>
  );
};
const Questions = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Label style={pos(110, 150)}>YOUR EXPERIENCE MATTERS</Label>
      <div style={pos(110, 230)}>
        {["What is clear?", "What is confusing?", "What would you use?"].map(
          (t, i) => (
            <div
              key={t}
              style={{
                fontSize: 104,
                fontWeight: 700,
                letterSpacing: -4,
                lineHeight: 1.35,
                opacity: progress(f, i * 18),
                translate: interpolate(
                  f,
                  [i * 18, i * 18 + 25],
                  ["70px 0px", "0px 0px"],
                  clamp,
                ),
              }}
            >
              <span
                style={{
                  fontSize: 35,
                  verticalAlign: "middle",
                  marginRight: 25,
                  opacity: 0.5,
                }}
              >
                0{i + 1}
              </span>
              {t}
            </div>
          ),
        )}
      </div>
      <div
        style={{
          ...pos(1520, 680),
          width: 170,
          height: 170,
          borderRadius: "50%",
          border: "2px solid #121212",
          scale: interpolate(f, [0, 130], [0.95, 1.2], clamp),
        }}
      />
    </AbsoluteFill>
  );
};
const Close = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <div
        style={{
          ...pos(110, 205),
          width: 1700,
          textAlign: "center",
          fontSize: 220,
          fontWeight: 700,
          letterSpacing: -12,
        }}
      >
        <Reveal>
          WattWise
          <span
            style={{
              display: "inline-block",
              fontSize: 80,
              verticalAlign: "top",
              marginTop: 40,
            }}
          >
            ↗
          </span>
        </Reveal>
      </div>
      <div
        style={{
          ...pos(180, 535),
          width: 1560,
          textAlign: "center",
          fontSize: 58,
          fontWeight: 700,
          letterSpacing: -2,
          opacity: progress(f, 25),
        }}
      >
        Your honest experience.
        <br />
        No right or wrong answers.
      </div>
      <div
        style={{
          ...pos(300, 735),
          width: 1320,
          textAlign: "center",
          fontSize: 29,
          opacity: progress(f, 40),
        }}
      >
        Answer the survey based on what you used or observed.
      </div>
    </AbsoluteFill>
  );
};
export const FeedbackMotion = () => (
  <Shell index={9} green>
    <Shot start={0} end={3.5} name="Try the app">
      <Try />
    </Shot>
    <Shot start={3.5} end={8.7} name="Honest feedback">
      <Questions />
    </Shot>
    <Shot start={8.7} end={13.567} name="Brand close">
      <Close />
    </Shot>
  </Shell>
);
