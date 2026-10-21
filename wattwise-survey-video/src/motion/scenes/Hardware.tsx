import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  Arrow,
  Bolt,
  clamp,
  DotField,
  Grid,
  Label,
  palette,
  pos,
  progress,
  Reveal,
  Shell,
  Shot,
  Tag,
} from "../design";
const HardwareObject = ({ explode = false }: { explode?: boolean }) => {
  const f = useCurrentFrame();
  const spread = explode
    ? interpolate(f, [20, 90, 135, 190], [0, 90, 90, 0], clamp)
    : 0;
  return (
    <div style={{ width: 600, height: 420, perspective: 1600 }}>
      <div
        style={{
          position: "relative",
          width: 520,
          height: 350,
          transformStyle: "preserve-3d",
          transform: `rotateX(${interpolate(f, [0, 140], [57, 50], clamp) + Math.sin(f * 0.014) * 1.6}deg) rotateZ(${interpolate(f, [0, 220], [-34, -23], clamp)}deg)`,
          translate: "40px 20px",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#a8b8ad",
            borderRadius: 32,
            transform: "translateZ(-60px)",
            boxShadow: "25px 45px 90px #0009",
          }}
        />
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 32,
              background:
                i === 0
                  ? "#d1ded5"
                  : i === 1
                    ? "#153d27"
                    : i === 2
                      ? "#232b26"
                      : palette.paper,
              border: "2px solid #0002",
              transform: `translateZ(${i * 24 + spread * i}px)`,
              boxShadow: "0 10px 0 #0c1718",
            }}
          >
            {i === 1 ? (
              <div
                style={{
                  position: "absolute",
                  inset: 25,
                  backgroundImage:
                    "linear-gradient(#00E66F33 1px,transparent 1px),linear-gradient(90deg,#00E66F33 1px,transparent 1px)",
                  backgroundSize: "20px 20px",
                  borderRadius: 12,
                }}
              />
            ) : i === 3 ? (
              <>
                <div
                  style={{
                    position: "absolute",
                    left: 55,
                    top: 70,
                    fontSize: 44,
                    fontWeight: 700,
                    color: palette.ink,
                  }}
                >
                  WattWise
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: 55,
                    top: 150,
                    width: 325,
                    height: 105,
                    borderRadius: 16,
                    background: palette.ink,
                    color: palette.mint,
                    fontSize: 48,
                    padding: 20,
                  }}
                >
                  65 W <span style={{ fontSize: 22 }}>ONLINE</span>
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: 55,
                    top: 290,
                    width: 9,
                    height: 9,
                    background: palette.mint,
                    borderRadius: "50%",
                  }}
                />
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};
const RevealUnit = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Grid />
      <div style={pos(100, 180, 830)}>
        <Label style={{ color: palette.mint }}>
          THE CONNECTION STARTS HERE
        </Label>
        <Reveal
          at={8}
          style={{
            fontSize: 130,
            fontWeight: 700,
            letterSpacing: -5,
            lineHeight: 1.05,
            marginTop: 36,
          }}
        >
          A small unit.
          <br />A clearer view.
        </Reveal>
        <div
          style={{
            marginTop: 42,
            fontSize: 32,
            color: palette.grey,
            opacity: progress(f, 50),
          }}
        >
          Controller · Energy sensor · Relay
        </div>
      </div>
      <div style={{ ...pos(1110, 370), scale: 1 }}>
        <HardwareObject explode />
      </div>
      <div style={pos(1080, 790)}>
        <Tag>Illustrative enclosure</Tag>
      </div>
    </AbsoluteFill>
  );
};
const Connected = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <DotField />
      <Label style={{ ...pos(110, 155), color: palette.mint }}>
        MEASURE → TRANSMIT → UNDERSTAND
      </Label>
      <div
        style={{ ...pos(80, 310), scale: 0.68, transformOrigin: "top left" }}
      >
        <HardwareObject />
      </div>
      <div style={{ ...pos(695, 420), width: 500 }}>
        <svg width="500" height="180">
          <path d="M0 90H480" stroke="#00E66F33" strokeWidth="2" />
          {Array.from({ length: 8 }, (_, i) => (
            <circle
              key={i}
              cx={(f * 4 + i * 65) % 480}
              cy="90"
              r={i % 3 === 0 ? 6 : 3}
              fill={palette.mint}
            />
          ))}
        </svg>
      </div>
      <div
        style={{
          ...pos(1260, 250),
          width: 490,
          height: 480,
          borderRadius: 42,
          background: palette.mint,
          color: palette.ink,
          padding: 48,
          opacity: progress(f, 10),
        }}
      >
        <Bolt color={palette.ink} size={100} />
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: -4,
            marginTop: 50,
          }}
        >
          WattWise
        </div>
        <div style={{ fontSize: 30, marginTop: 30 }}>Usage, in your hands.</div>
      </div>
      <Label
        style={{
          ...pos(680, 610),
          width: 400,
          textAlign: "center",
          opacity: progress(f, 20),
        }}
      >
        OVER WI-FI
      </Label>
    </AbsoluteFill>
  );
};
const Concept = () => (
  <AbsoluteFill>
    <div style={{ ...pos(80, 200), scale: 1.38, transformOrigin: "top left" }}>
      <HardwareObject />
    </div>
    <div style={pos(1050, 230, 790)}>
      <Label style={{ color: palette.mint }}>HARDWARE VISUALIZATION</Label>
      <Reveal
        style={{
          fontSize: 112,
          fontWeight: 700,
          letterSpacing: -4,
          lineHeight: 1.06,
          marginTop: 35,
        }}
      >
        Concept.
        <br />
        Not final design.
      </Reveal>
      <div style={{ marginTop: 40, fontSize: 34, color: palette.grey }}>
        Shown to help you picture the monitoring unit.
      </div>
    </div>
  </AbsoluteFill>
);
const Prepared = () => (
  <AbsoluteFill>
    <div style={pos(110, 160)}>
      <Label style={{ color: palette.mint }}>YOUR TEST SESSION</Label>
      <Reveal
        style={{
          fontSize: 115,
          fontWeight: 700,
          lineHeight: 1.08,
          letterSpacing: -4,
          marginTop: 35,
        }}
      >
        Connections prepared.
        <br />
        You explore the app.
      </Reveal>
    </div>
    <div
      style={{
        ...pos(110, 590),
        display: "flex",
        gap: 45,
        alignItems: "center",
      }}
    >
      <div
        style={{
          padding: 35,
          borderRadius: 25,
          border: "1px solid #ffffff33",
          fontSize: 40,
        }}
      >
        Researcher setup
      </div>
      <Arrow width={220} />
      <div
        style={{
          padding: 35,
          borderRadius: 25,
          background: palette.mint,
          color: palette.ink,
          fontSize: 40,
        }}
      >
        Ready to try
      </div>
    </div>
  </AbsoluteFill>
);
export const HardwareMotion = () => (
  <Shell index={1}>
    <Shot start={0} end={5.6} name="Exploded unit reveal">
      <RevealUnit />
    </Shot>
    <Shot start={5.6} end={8.6} name="Wi-Fi flow">
      <Connected />
    </Shot>
    <Shot start={8.6} end={11.8} name="Concept enclosure">
      <Concept />
    </Shot>
    <Shot start={11.8} end={16.267} name="Prepared connections">
      <Prepared />
    </Shot>
  </Shell>
);
