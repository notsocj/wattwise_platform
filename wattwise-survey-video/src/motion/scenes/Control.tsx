import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  clamp,
  EnergyRibbon,
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
const Limit = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Grid />
      <EnergyRibbon />
      <Label style={{ ...pos(110, 155), color: palette.mint }}>
        SMART CONTROL / APPROVED APPLIANCE LIMIT
      </Label>
      <div
        style={{
          ...pos(115, 235),
          fontSize: 280,
          fontWeight: 700,
          letterSpacing: -12,
        }}
      >
        100<span style={{ fontSize: 100, color: palette.mint }}>%</span>
      </div>
      <div style={{ ...pos(130, 620), fontSize: 60, fontWeight: 700 }}>
        At the limit.
        <br />
        What happens next?
      </div>
      <div
        style={{
          ...pos(1260, 205),
          width: 420,
          height: 420,
          borderRadius: "50%",
          border: "1px solid #ffffff33",
          background: "radial-gradient(circle,#16472b,#1E1E1E 70%)",
          scale: interpolate(f, [0, 130], [0.96, 1.04], clamp),
        }}
      >
        <svg width="420" height="420">
          <path
            d="M210 105V218M139 147A111 111 0 1 0 281 147"
            fill="none"
            stroke={palette.mint}
            strokeWidth="10"
            strokeLinecap="round"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - progress(f, 15, 45)}
          />
        </svg>
      </div>
      <div style={pos(1295, 705)}>
        <Tag>Sample limit reached</Tag>
      </div>
    </AbsoluteFill>
  );
};
const Policy = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Label style={{ ...pos(110, 150), color: palette.mint }}>
        YOU CHOOSE THE POLICY
      </Label>
      <div style={{ ...pos(110, 270), display: "flex", gap: 45, width: 1690 }}>
        {["Require approval", "Automatic shutoff"].map((t, i) => (
          <div
            key={t}
            style={{
              flex: 1,
              height: 410,
              borderRadius: 34,
              padding: 48,
              background: i === 0 ? palette.mint : palette.panel,
              color: i === 0 ? palette.ink : palette.paper,
              border: i === 0 ? "none" : "1px solid #ffffff25",
              translate: interpolate(
                f,
                [i * 17, i * 17 + 30],
                ["0px 70px", "0px 0px"],
                clamp,
              ),
              opacity: progress(f, i * 17),
            }}
          >
            <div
              style={{
                width: 100,
                height: 58,
                borderRadius: 40,
                background: i === 0 ? "#121212" : "#ffffff20",
                padding: 7,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  background: i === 0 ? palette.mint : palette.paper,
                  borderRadius: "50%",
                  translate: i === 0 ? "42px 0px" : "0px 0px",
                }}
              />
            </div>
            <div
              style={{
                fontSize: 62,
                fontWeight: 700,
                lineHeight: 1.08,
                marginTop: 62,
                letterSpacing: -2,
              }}
            >
              {t}
            </div>
            <div style={{ fontSize: 30, marginTop: 30, opacity: 0.6 }}>
              {i === 0
                ? "Ask before interrupting power."
                : "Optional. Enable deliberately."}
            </div>
          </div>
        ))}
      </div>
      <div style={{ ...pos(115, 775), fontSize: 31, color: palette.grey }}>
        Choose the setting that fits the appliance and your household.
      </div>
    </AbsoluteFill>
  );
};
const Spend = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Label style={{ ...pos(110, 155), color: palette.mint }}>
        HOW THE CUTOFF IS MEASURED
      </Label>
      <Reveal
        style={{
          ...pos(110, 235),
          fontSize: 130,
          fontWeight: 700,
          lineHeight: 1.04,
          letterSpacing: -5,
        }}
      >
        Calendar month.
        <br />
        Variable energy spend.
      </Reveal>
      <div
        style={{
          ...pos(120, 625),
          display: "flex",
          gap: 25,
          alignItems: "center",
          opacity: progress(f, 30),
        }}
      >
        <div
          style={{
            fontSize: 40,
            padding: "22px 30px",
            border: "1px solid #00E66F66",
            borderRadius: 20,
            color: palette.mint,
          }}
        >
          Appliance usage
        </div>
        <span style={{ fontSize: 50, color: palette.grey }}>→</span>
        <div
          style={{
            fontSize: 40,
            padding: "22px 30px",
            border: "1px solid #00E66F66",
            borderRadius: 20,
          }}
        >
          Approved limit
        </div>
      </div>
      <div style={{ ...pos(120, 800), fontSize: 31, color: palette.grey }}>
        Home-level fixed charges are excluded.
      </div>
    </AbsoluteFill>
  );
};
export const ControlMotion = () => (
  <Shell index={7}>
    <Shot start={0} end={4.9} name="Limit reached">
      <Limit />
    </Shot>
    <Shot start={4.9} end={9.4} name="Choose approval or shutoff">
      <Policy />
    </Shot>
    <Shot start={9.4} end={15.034} name="Variable spend cutoff">
      <Spend />
    </Shot>
  </Shell>
);
