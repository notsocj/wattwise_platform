import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  Arrow,
  clamp,
  Label,
  NumberValue,
  palette,
  pos,
  progress,
  Reveal,
  Ring,
  Shell,
  Shot,
  Tag,
} from "../design";
const Budget = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Label style={pos(110, 155)}>HOME WALLET / BILLING CYCLE</Label>
      <div
        style={{
          ...pos(1250, 190),
          rotate: interpolate(f, [0, 120], ["15deg", "0deg"], clamp),
        }}
      >
        <Ring size={570} dark />
      </div>
      <div style={pos(110, 225, 1040)}>
        <Reveal
          style={{
            fontSize: 145,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -5,
          }}
        >
          Your budget.
          <br />
          In focus.
        </Reveal>
        <div style={{ display: "flex", gap: 45, marginTop: 58 }}>
          <div>
            <Label style={{ opacity: 0.5 }}>SPENT SO FAR</Label>
            <div style={{ fontSize: 95, fontWeight: 700 }}>
              ₱<NumberValue value={840} at={20} frames={50} />
            </div>
          </div>
          <div style={{ width: 1, height: 145, background: "#12121233" }} />
          <div>
            <Label style={{ opacity: 0.5 }}>HOME BUDGET</Label>
            <div style={{ fontSize: 95, fontWeight: 700 }}>₱2,000</div>
          </div>
        </div>
      </div>
      <div style={pos(120, 800)}>
        <Tag dark>Projected cycle bill · ₱1,680</Tag>
      </div>
    </AbsoluteFill>
  );
};
const Components = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Label style={pos(110, 155)}>MERALCO-AWARE ESTIMATES</Label>
      <Reveal
        style={{
          ...pos(110, 225),
          fontSize: 120,
          fontWeight: 700,
          letterSpacing: -4,
        }}
      >
        Every part counts.
      </Reveal>
      <div
        style={{
          ...pos(100, 465),
          width: 1710,
          display: "flex",
          alignItems: "center",
          gap: 22,
        }}
      >
        {["Rate components", "Fixed charges", "VAT last"].map((t, i) => (
          <div
            key={t}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 22,
              flex: i === 2 ? 1 : 1.25,
            }}
          >
            <div
              style={{
                background: palette.ink,
                color: palette.paper,
                borderRadius: 28,
                height: 220,
                padding: "42px 30px",
                flex: 1,
                opacity: progress(f, i * 20, 20),
                translate: interpolate(
                  f,
                  [i * 20, i * 20 + 25],
                  ["0px 65px", "0px 0px"],
                  clamp,
                ),
              }}
            >
              <Label style={{ color: palette.mint }}>0{i + 1}</Label>
              <div style={{ fontSize: 40, marginTop: 22, fontWeight: 700 }}>
                {t}
              </div>
            </div>
            {i < 2 && <Arrow dark width={95} />}
          </div>
        ))}
      </div>
      <div style={{ ...pos(110, 785), fontSize: 35, opacity: progress(f, 60) }}>
        Based on stored rates and recorded usage.
      </div>
    </AbsoluteFill>
  );
};
const Estimate = () => (
  <AbsoluteFill>
    <div
      style={{
        ...pos(110, 210),
        fontSize: 143,
        fontWeight: 700,
        lineHeight: 1.05,
        letterSpacing: -5,
      }}
    >
      <Reveal>Track your costs.</Reveal>
      <Reveal at={15}>Understand the estimate.</Reveal>
    </div>
    <div
      style={{
        ...pos(115, 675),
        padding: "24px 35px",
        border: "2px solid #121212",
        borderRadius: 20,
        fontSize: 42,
      }}
    >
      Not your official electricity bill.
    </div>
    <svg width="290" height="200" style={{ ...pos(1450, 570) }}>
      <path
        d="M25 100H255M180 25L255 100L180 175"
        fill="none"
        stroke={palette.ink}
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  </AbsoluteFill>
);
export const WalletMotion = () => (
  <Shell index={4} green>
    <Shot start={0} end={7.3} name="Budget dial and forecast">
      <Budget />
    </Shot>
    <Shot start={7.3} end={11.9} name="Unbundled rate components">
      <Components />
    </Shot>
    <Shot start={11.9} end={15.867} name="Estimate context">
      <Estimate />
    </Shot>
  </Shell>
);
