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
  Tag,
} from "../design";
const Scan = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Grid light />
      <div style={pos(110, 190, 850)}>
        <Label>01 / IDENTIFY</Label>
        <Reveal
          style={{
            fontSize: 155,
            lineHeight: 1.03,
            fontWeight: 700,
            letterSpacing: -6,
            marginTop: 35,
          }}
        >
          Scan.
          <br />
          Connect.
        </Reveal>
        <div style={{ marginTop: 48, fontSize: 35 }}>
          Or enter the device identifier.
        </div>
      </div>
      <div
        style={{
          ...pos(1110, 195),
          width: 580,
          height: 580,
          padding: 50,
          background: "#fff",
          borderRadius: 35,
          boxShadow: "0 30px 90px #12121212",
        }}
      >
        <svg width="480" height="480" viewBox="0 0 21 21">
          {Array.from({ length: 441 }, (_, i) => {
            const x = i % 21,
              y = Math.floor(i / 21);
            const finder =
              (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
            const fill = finder
              ? x % 14 === 0 ||
                x % 14 === 6 ||
                y % 14 === 0 ||
                y % 14 === 6 ||
                (x % 14 >= 2 && x % 14 <= 4 && y % 14 >= 2 && y % 14 <= 4)
              : (i * 37 + Math.floor(i / 21) * 13) % 11 < 5;
            return fill ? (
              <rect
                key={i}
                x={x}
                y={y}
                width="1"
                height="1"
                fill={palette.ink}
              />
            ) : null;
          })}
        </svg>
        <div
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            height: 4,
            background: palette.mint,
            top: interpolate(f, [0, 90, 145], [70, 500, 260], clamp),
            boxShadow: "0 0 25px #00E66F",
          }}
        />
      </div>
      <div style={{ ...pos(1150, 825), fontSize: 23, opacity: 0.6 }}>
        Illustrative device code
      </div>
    </AbsoluteFill>
  );
};
const Profile = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Label style={pos(110, 160)}>02 / NORMAL DAILY USE</Label>
      <div
        style={{
          ...pos(160, 310),
          rotate: interpolate(f, [0, 85], ["-8deg", "0deg"], clamp),
        }}
      >
        <Fan size={460} dark />
      </div>
      <div style={pos(830, 215, 950)}>
        <Reveal
          style={{
            fontSize: 110,
            lineHeight: 1.04,
            letterSpacing: -4,
            fontWeight: 700,
          }}
        >
          Living room fan.
        </Reveal>
        <div style={{ display: "flex", gap: 30, marginTop: 65 }}>
          <div
            style={{
              fontSize: 95,
              fontWeight: 700,
              padding: "30px 45px",
              background: palette.mint,
              borderRadius: 25,
            }}
          >
            65<span style={{ fontSize: 34 }}> W</span>
          </div>
          <div
            style={{
              fontSize: 95,
              fontWeight: 700,
              padding: "30px 45px",
              background: "#1212120a",
              borderRadius: 25,
            }}
          >
            8<span style={{ fontSize: 34 }}> h/day</span>
          </div>
        </div>
        <div style={{ fontSize: 35, marginTop: 45, opacity: progress(f, 45) }}>
          Review the AI profile and suggested budget.
        </div>
      </div>
    </AbsoluteFill>
  );
};
const Approve = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Label style={{ ...pos(120, 160) }}>03 / YOUR APPROVED LIMIT</Label>
      <div
        style={{
          ...pos(110, 270),
          fontSize: 230,
          fontWeight: 700,
          letterSpacing: -12,
        }}
      >
        ₱<NumberValue value={250} />
        <span style={{ fontSize: 54, letterSpacing: -2 }}> / month</span>
      </div>
      <div
        style={{
          ...pos(1250, 220),
          width: 390,
          height: 390,
          borderRadius: "50%",
          background: palette.mint,
          scale: interpolate(f, [0, 40], [0.94, 1], clamp),
        }}
      >
        <svg width="390" height="390">
          <path
            d="M100 200L165 262L290 129"
            fill="none"
            stroke={palette.ink}
            strokeWidth="17"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - progress(f, 20, 30)}
          />
        </svg>
      </div>
      <Reveal
        at={22}
        style={{ ...pos(130, 610), fontSize: 65, fontWeight: 700 }}
      >
        You choose. You approve.
      </Reveal>
      <div style={pos(130, 750)}>
        <Tag dark>Sample appliance budget</Tag>
      </div>
    </AbsoluteFill>
  );
};
export const SetupMotion = () => (
  <Shell index={2} light>
    <Shot start={0} end={4.6} name="Scan device">
      <Scan />
    </Shot>
    <Shot start={4.6} end={10.8} name="Daily use and AI profile">
      <Profile />
    </Shot>
    <Shot start={10.8} end={13.734} name="Approve budget">
      <Approve />
    </Shot>
  </Shell>
);
