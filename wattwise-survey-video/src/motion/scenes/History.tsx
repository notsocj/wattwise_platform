import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  clamp,
  Grid,
  Label,
  palette,
  pos,
  progress,
  Reveal,
  Shell,
  Shot,
  Sparkline,
} from "../design";
const Calendar = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <div style={pos(105, 180, 900)}>
        <Label>CALENDAR / DAILY RECORDS</Label>
        <Reveal
          style={{
            fontSize: 155,
            lineHeight: 1.05,
            letterSpacing: -6,
            fontWeight: 700,
            marginTop: 38,
          }}
        >
          Look back.
          <br />
          Learn more.
        </Reveal>
        <div style={{ fontSize: 35, marginTop: 50 }}>
          Energy and cost, day by day.
        </div>
      </div>
      <div
        style={{
          ...pos(1050, 170),
          width: 710,
          padding: 40,
          background: "#fff",
          borderRadius: 30,
          boxShadow: "0 30px 80px #12121210",
          rotate: interpolate(f, [0, 110], ["6deg", "0deg"], clamp),
        }}
      >
        <Label style={{ marginBottom: 25 }}>SAMPLE MONTH</Label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7,1fr)",
            gap: 9,
          }}
        >
          {Array.from({ length: 28 }, (_, i) => (
            <div
              key={i}
              style={{
                height: 76,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 27,
                background: i === 16 ? palette.mint : "#12121206",
                scale: interpolate(f, [i * 2, i * 2 + 18], [0.94, 1], clamp),
                opacity: progress(f, i * 2, 14),
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
const Chart = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Grid light />
      <Label style={pos(110, 155)}>BURN ANALYTICS / WEEKLY SUMMARY</Label>
      <Reveal
        style={{
          ...pos(110, 220),
          fontSize: 105,
          fontWeight: 700,
          letterSpacing: -4,
        }}
      >
        See the pattern.
      </Reveal>
      <div
        style={{
          ...pos(130, 430),
          width: 1630,
          height: 350,
          display: "flex",
          gap: 25,
          alignItems: "end",
        }}
      >
        {[155, 228, 180, 285, 245, 340, 190].map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: h + 50,
              display: "flex",
              flexDirection: "column",
              justifyContent: "end",
            }}
          >
            <div
              style={{
                height: h,
                background: i === 5 ? palette.mint : palette.ink,
                borderRadius: "12px 12px 0 0",
                scale: `1 ${progress(f, i * 7, 40)}`,
                transformOrigin: "bottom",
              }}
            />
            <div
              style={{
                fontSize: 26,
                paddingTop: 20,
                textAlign: "center",
                opacity: 0.6,
              }}
            >
              {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][i]}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          ...pos(1350, 230),
          fontSize: 29,
          padding: "15px 23px",
          border: "1px solid #12121233",
          borderRadius: 30,
          opacity: progress(f, 55),
        }}
      >
        Sample energy use
      </div>
    </AbsoluteFill>
  );
};
const Compare = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Label style={pos(110, 150)}>CONNECTED APPLIANCES / USAGE TRENDS</Label>
      <Reveal
        style={{
          ...pos(110, 215),
          fontSize: 110,
          fontWeight: 700,
          letterSpacing: -5,
        }}
      >
        When did usage change?
      </Reveal>
      <div style={{ ...pos(120, 445) }}>
        <Sparkline width={1610} height={315} dark />
      </div>
      <div
        style={{
          ...pos(1140, 535),
          width: 92,
          height: 92,
          border: "3px solid #121212",
          borderRadius: "50%",
          opacity: progress(f, 50),
          scale: interpolate(f, [45, 80], [1.35, 1], clamp),
        }}
      />
      <div
        style={{ ...pos(1160, 380), fontSize: 29, opacity: progress(f, 55) }}
      >
        Review this change ↘
      </div>
      <div style={{ ...pos(125, 820), fontSize: 29, opacity: 0.6 }}>
        Compare recorded patterns, not assumptions.
      </div>
    </AbsoluteFill>
  );
};
export const HistoryMotion = () => (
  <Shell index={5} light>
    <Shot start={0} end={5.2} name="Calendar assembly">
      <Calendar />
    </Shot>
    <Shot start={5.2} end={9.5} name="Weekly bars">
      <Chart />
    </Shot>
    <Shot start={9.5} end={13.367} name="Usage comparison">
      <Compare />
    </Shot>
  </Shell>
);
