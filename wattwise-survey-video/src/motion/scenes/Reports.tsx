import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  clamp,
  Label,
  palette,
  pos,
  progress,
  Reveal,
  Shell,
  Shot,
  Tag,
} from "../design";
const Sheet = ({ format, delay = 0 }: { format: string; delay?: number }) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        width: 540,
        height: 575,
        padding: 44,
        borderRadius: 22,
        background: "#fff",
        boxShadow: "10px 30px 60px #12121218",
        border: "1px solid #12121213",
        opacity: progress(f, delay),
        rotate: interpolate(
          f,
          [delay, delay + 55],
          [
            format === "PDF" ? "-14deg" : "14deg",
            format === "PDF" ? "-5deg" : "5deg",
          ],
          clamp,
        ),
        translate: interpolate(
          f,
          [delay, delay + 40],
          ["0px 140px", "0px 0px"],
          clamp,
        ),
      }}
    >
      <Label style={{ color: "#10B981" }}>WATTWISE / ENERGY REPORT</Label>
      <div
        style={{
          fontSize: 80,
          fontWeight: 700,
          letterSpacing: -4,
          marginTop: 30,
        }}
      >
        {format}
      </div>
      <div style={{ fontSize: 23, margin: "25px 0", opacity: 0.5 }}>
        Selected period · Sample records
      </div>
      {["Appliance", "Energy (kWh)", "Estimated cost", "Period total"].map(
        (t, i) => (
          <div
            key={t}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 24,
              padding: "18px 0",
              borderBottom: "1px solid #12121216",
            }}
          >
            <span>{t}</span>
            <span
              style={{
                width: 80,
                height: 12,
                background: i === 3 ? palette.mint : "#12121222",
                borderRadius: 8,
                marginTop: 8,
              }}
            />
          </div>
        ),
      )}
      <div style={{ marginTop: 26, fontSize: 23, color: "#10B981" }}>
        ↓ Download
      </div>
    </div>
  );
};
const Export = () => (
  <AbsoluteFill>
    <div style={pos(110, 175, 900)}>
      <Label>ENERGY REPORTS</Label>
      <Reveal
        style={{
          fontSize: 155,
          fontWeight: 700,
          lineHeight: 1.04,
          letterSpacing: -6,
          marginTop: 40,
        }}
      >
        Your usage.
        <br />
        On record.
      </Reveal>
      <div style={{ marginTop: 45, fontSize: 35 }}>
        Choose a period. Export a copy.
      </div>
      <div style={{ display: "flex", gap: 15, marginTop: 42 }}>
        <Tag dark>PDF</Tag>
        <Tag dark>CSV</Tag>
      </div>
    </div>
    <div style={pos(980, 220)}>
      <Sheet format="PDF" />
    </div>
    <div
      style={{ ...pos(1390, 370), scale: 0.65, transformOrigin: "top left" }}
    >
      <Sheet format="CSV" delay={22} />
    </div>
  </AbsoluteFill>
);
const Settings = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Label style={pos(110, 150)}>SETTINGS / MAKE IT YOURS</Label>
      <Reveal
        style={{
          ...pos(110, 220),
          fontSize: 120,
          fontWeight: 700,
          letterSpacing: -4,
        }}
      >
        Everything in its place.
      </Reveal>
      <div style={{ ...pos(110, 460), width: 1690, display: "flex", gap: 25 }}>
        {[
          { icon: "◎", title: "Account", sub: "Profile & password" },
          { icon: "▦", title: "Billing cycle", sub: "Your period window" },
          { icon: "◉", title: "Notifications", sub: "Your preferences" },
        ].map((x, i) => (
          <div
            key={x.title}
            style={{
              flex: 1,
              height: 315,
              border: "1px solid #12121222",
              borderRadius: 30,
              padding: 35,
              opacity: progress(f, i * 14),
              translate: interpolate(
                f,
                [i * 14, i * 14 + 25],
                ["0px 65px", "0px 0px"],
                clamp,
              ),
            }}
          >
            <div style={{ fontSize: 62, lineHeight: 1, color: "#10B981" }}>
              {x.icon}
            </div>
            <div
              style={{
                fontSize: 47,
                fontWeight: 700,
                letterSpacing: -1,
                marginTop: 37,
              }}
            >
              {x.title}
            </div>
            <div style={{ fontSize: 28, marginTop: 18, opacity: 0.6 }}>
              {x.sub}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
const Permission = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Label style={pos(110, 160)}>PUSH NOTIFICATIONS</Label>
      <Reveal
        style={{
          ...pos(110, 235),
          fontSize: 150,
          fontWeight: 700,
          letterSpacing: -6,
          lineHeight: 1.05,
        }}
      >
        Your permission.
        <br />
        Your decision.
      </Reveal>
      <div
        style={{
          ...pos(1350, 280),
          width: 310,
          height: 210,
          borderRadius: 34,
          border: "3px solid #121212",
          background: palette.mint,
          scale: interpolate(f, [0, 100], [0.95, 1], clamp),
        }}
      >
        <div
          style={{
            fontSize: 44,
            textAlign: "center",
            marginTop: 58,
            fontWeight: 700,
          }}
        >
          Allow push?
        </div>
        <div style={{ fontSize: 28, textAlign: "center", marginTop: 25 }}>
          Explicit action
        </div>
      </div>
      <div style={{ ...pos(120, 700), fontSize: 35, opacity: progress(f, 25) }}>
        Delivery depends on permissions and service availability.
      </div>
    </AbsoluteFill>
  );
};
export const ReportsMotion = () => (
  <Shell index={8} light>
    <Shot start={0} end={7.4} name="Reports paper reveal">
      <Export />
    </Shot>
    <Shot start={7.4} end={12.4} name="Settings categories">
      <Settings />
    </Shot>
    <Shot start={12.4} end={16.1} name="Permission decision">
      <Permission />
    </Shot>
  </Shell>
);
