import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  clamp,
  Fan,
  Grid,
  Label,
  NumberValue,
  palette,
  pos,
  progress,
  Reveal,
  Shell,
  Shot,
  Sparkline,
  Tag,
} from "../design";
const Live = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Grid />
      <div
        style={{
          ...pos(110, 150),
          display: "flex",
          gap: 20,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: palette.mint,
            boxShadow: "0 0 25px #00E66F",
          }}
        />
        <Label style={{ color: palette.mint }}>HOME DASHBOARD / LIVE</Label>
      </div>
      <div
        style={{
          ...pos(105, 240),
          fontSize: 310,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: -15,
        }}
      >
        <NumberValue value={65} frames={40} />
        <span style={{ fontSize: 112, letterSpacing: -3, color: palette.mint }}>
          {" "}
          W
        </span>
      </div>
      <Reveal
        at={10}
        style={{ ...pos(120, 635), fontSize: 68, fontWeight: 700 }}
      >
        Living room fan.
      </Reveal>
      <div
        style={{
          ...pos(1210, 205),
          scale: interpolate(f, [0, 100], [0.94, 1], clamp),
        }}
      >
        <Fan size={520} />
      </div>
      <div style={{ ...pos(125, 790) }}>
        <Tag>Fresh reading · Connected appliance</Tag>
      </div>
    </AbsoluteFill>
  );
};
const Metrics = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Label style={{ ...pos(110, 160), color: palette.mint }}>
        THE DETAILS BEHIND YOUR POWER
      </Label>
      <div style={{ ...pos(110, 260), width: 1700, display: "flex", gap: 24 }}>
        {[
          { v: "230", u: "V", l: "VOLTAGE" },
          { v: "0.31", u: "A", l: "CURRENT" },
          { v: "0.52", u: "kWh", l: "ENERGY TODAY" },
        ].map((n, i) => (
          <div
            key={n.l}
            style={{
              flex: 1,
              height: 395,
              border: "1px solid #ffffff22",
              borderRadius: 28,
              padding: 42,
              background: i === 2 ? palette.mint : palette.panel,
              color: i === 2 ? palette.ink : palette.paper,
              translate: interpolate(
                f,
                [i * 9, i * 9 + 25],
                ["0px 80px", "0px 0px"],
                clamp,
              ),
              opacity: progress(f, i * 9, 15),
            }}
          >
            <Label style={{ opacity: 0.55 }}>{n.l}</Label>
            <div
              style={{
                fontSize: i === 2 ? 112 : 132,
                fontWeight: 700,
                letterSpacing: -6,
                marginTop: 85,
              }}
            >
              {n.v}
              <span style={{ fontSize: 38, letterSpacing: 0, marginLeft: 12 }}>
                {n.u}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ ...pos(170, 735) }}>
        <Sparkline width={1500} height={100} />
      </div>
    </AbsoluteFill>
  );
};
const Cost = () => (
  <AbsoluteFill>
    <Label style={{ ...pos(110, 155), color: palette.mint }}>
      ESTIMATED DAILY COST
    </Label>
    <div
      style={{
        ...pos(110, 260),
        fontSize: 265,
        fontWeight: 700,
        letterSpacing: -12,
      }}
    >
      ₱<NumberValue value={48.6} decimals={2} frames={35} />
    </div>
    <div style={pos(110, 680)}>
      <Sparkline width={1500} height={170} />
    </div>
    <div style={{ ...pos(1330, 170) }}>
      <Tag>Sample day</Tag>
    </div>
  </AbsoluteFill>
);
const Freshness = () => {
  const f = useCurrentFrame();
  const active = f < 40;
  return (
    <AbsoluteFill>
      <div style={{ ...pos(1300, 230), opacity: active ? 1 : 0.25 }}>
        <Fan size={370} spin={active} />
      </div>
      <Label style={{ ...pos(110, 170), color: palette.grey }}>
        WHEN FRESH READINGS STOP
      </Label>
      <Reveal
        style={{
          ...pos(110, 275),
          fontSize: 170,
          fontWeight: 700,
          letterSpacing: -7,
          lineHeight: 1.03,
        }}
      >
        Connection
        <br />
        {active ? (
          <span style={{ color: palette.mint }}>live.</span>
        ) : (
          <span style={{ color: palette.grey }}>offline.</span>
        )}
      </Reveal>
      <div
        style={{
          ...pos(120, 735),
          display: "flex",
          gap: 22,
          alignItems: "center",
          fontSize: 32,
          color: palette.grey,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            background: active ? palette.mint : "#7c857f",
            borderRadius: "50%",
          }}
        />
        Missing readings do not imply active usage.
      </div>
      <div style={{ ...pos(1250, 725) }}>
        <Tag>Offline or idle</Tag>
      </div>
    </AbsoluteFill>
  );
};
export const DashboardMotion = () => (
  <Shell index={3}>
    <Shot start={0} end={3.7} name="Live watts closeup">
      <Live />
    </Shot>
    <Shot start={3.7} end={8.1} name="Electrical metrics">
      <Metrics />
    </Shot>
    <Shot start={8.1} end={10.2} name="Daily cost">
      <Cost />
    </Shot>
    <Shot start={10.2} end={15.967} name="Freshness state change">
      <Freshness />
    </Shot>
  </Shell>
);
