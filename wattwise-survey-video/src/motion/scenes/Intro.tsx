import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  Bolt,
  clamp,
  EnergyRibbon,
  DotField,
  Grid,
  House,
  Label,
  palette,
  pos,
  progress,
  Reveal,
  Ring,
  Shell,
  Shot,
  Tag,
} from "../design";
const Brand = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <DotField />
      <EnergyRibbon />
      <div
        style={{
          ...pos(550, 170),
          width: 820,
          height: 650,
          borderRadius: "50%",
          border: "1px solid #00E66F40",
          rotate: `${f * 0.2}deg`,
          scale: interpolate(f, [0, 90], [1.15, 1], clamp),
        }}
      />
      <div
        style={{
          ...pos(850, 180),
          opacity: progress(f, 20, 25),
          rotate: interpolate(f, [10, 65], ["-18deg", "0deg"], clamp),
        }}
      >
        <Bolt size={220} />
      </div>
      <div
        style={{
          ...pos(150, 460),
          width: 1620,
          textAlign: "center",
          fontSize: 230,
          fontWeight: 700,
          letterSpacing: -14,
          display: "flex",
          justifyContent: "center",
        }}
      >
        {"WattWise".split("").map((c, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              translate: interpolate(
                f,
                [i * 3, i * 3 + 25],
                ["0px 170px", "0px 0px"],
                { ...clamp },
              ),
              opacity: progress(f, i * 3, 12),
              color: i > 3 ? palette.mint : palette.paper,
            }}
          >
            {c}
          </span>
        ))}
      </div>
      <Label
        style={{
          ...pos(150, 760),
          width: 1620,
          textAlign: "center",
          opacity: progress(f, 30, 15),
        }}
      >
        ENERGY. UNDERSTOOD.
      </Label>
    </AbsoluteFill>
  );
};
const Home = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Grid />
      <div
        style={{
          ...pos(190, 195),
          width: 540,
          height: 540,
          borderRadius: "50%",
          border: "1px solid #00E66F55",
          scale: interpolate(f, [0, 80], [0.92, 1], clamp),
        }}
      />
      <div
        style={{
          ...pos(290, 280),
          rotate: interpolate(f, [0, 100], ["-8deg", "0deg"], clamp),
        }}
      >
        <House size={350} />
      </div>
      <div style={pos(820, 240, 1000)}>
        <Label style={{ color: palette.mint, marginBottom: 35 }}>
          FOR PHILIPPINE HOUSEHOLDS
        </Label>
        <Reveal
          style={{
            fontSize: 128,
            fontWeight: 700,
            lineHeight: 1.03,
            letterSpacing: -5,
          }}
        >
          Energy
          <br />
          monitoring.
          <br />
          <span style={{ color: palette.mint }}>Made visible.</span>
        </Reveal>
      </div>
    </AbsoluteFill>
  );
};
const Overview = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Label style={{ ...pos(110, 160), color: palette.grey }}>
        YOUR CONNECTED APPLIANCES, IN FOCUS
      </Label>
      <div
        style={{
          ...pos(100, 240),
          width: 1720,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 25,
        }}
      >
        {["USE", "COST", "BUDGET"].map((t, i) => (
          <div
            key={t}
            style={{
              height: 570,
              padding: 42,
              borderRadius: 36,
              background: i === 1 ? palette.mint : "#1E1E1E",
              color: i === 1 ? palette.ink : palette.paper,
              translate: interpolate(
                f,
                [i * 14, i * 14 + 30],
                ["0px 150px", "0px 0px"],
                clamp,
              ),
              opacity: progress(f, i * 14, 18),
            }}
          >
            <Label style={{ opacity: 0.6 }}>{t}</Label>
            {i === 0 ? (
              <>
                <div style={{ fontSize: 150, fontWeight: 700, marginTop: 80 }}>
                  65
                  <span style={{ fontSize: 60, color: palette.mint }}> W</span>
                </div>
                <div
                  style={{ marginTop: 70, fontSize: 30, color: palette.grey }}
                >
                  Live appliance power
                </div>
              </>
            ) : i === 1 ? (
              <>
                <div style={{ fontSize: 100, fontWeight: 700, marginTop: 100 }}>
                  ₱48.60
                </div>
                <div style={{ marginTop: 90, fontSize: 30 }}>
                  Estimated daily cost
                </div>
              </>
            ) : (
              <>
                <div style={{ marginTop: 30 }}>
                  <Ring size={330} />
                </div>
                <div style={{ fontSize: 30, color: palette.grey }}>
                  Home Wallet
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
const Invitation = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: palette.mint, color: palette.ink }}>
      <div
        style={{
          ...pos(130, 205),
          fontSize: 165,
          fontWeight: 700,
          letterSpacing: -7,
          lineHeight: 1.08,
        }}
      >
        <Reveal>Let’s take</Reveal>
        <Reveal at={12}>
          a quick look
          <span
            style={{
              display: "inline-block",
              rotate: interpolate(f, [0, 100], ["-30deg", "0deg"], clamp),
            }}
          >
            ↗
          </span>
        </Reveal>
      </div>
      <div style={{ ...pos(140, 720), opacity: progress(f, 45, 20) }}>
        <Tag dark>Sample readings. Real workflows.</Tag>
      </div>
      <div
        style={{
          ...pos(1440, 560),
          width: 240,
          height: 240,
          border: "2px solid #121212",
          borderRadius: "50%",
          scale: interpolate(f, [0, 130], [0.8, 1.2], clamp),
        }}
      />
    </AbsoluteFill>
  );
};
export const IntroMotion = () => {
  const f = useCurrentFrame();
  return (
    <Shell index={0} green={f >= 354}>
      <Shot start={0} end={1.8} name="Brand ignition">
        <Brand />
      </Shot>
      <Shot start={1.8} end={4.9} name="Philippine homes">
        <Home />
      </Shot>
      <Shot start={4.9} end={11.8} name="Use cost budget">
        <Overview />
      </Shot>
      <Shot start={11.8} end={16.9} name="Invitation">
        <Invitation />
      </Shot>
    </Shell>
  );
};
