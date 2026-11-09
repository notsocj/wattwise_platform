import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Backdrop, C, FONT, Icon, Kicker, Owl, rise } from "../ui";

const ROOMS = [
  { room: "Room 101", tenant: "Ana", spend: "₱820", status: "OK", tone: C.mint },
  { room: "Room 102", tenant: "Ben", spend: "₱1,240", status: "Near limit", tone: C.naku },
  { room: "Room 103", tenant: "Carla", spend: "₱980", status: "OK", tone: C.mint },
  { room: "Room 104", tenant: "Dan", spend: "₱1,610", status: "Cut off", tone: C.danger },
  { room: "Room 105", tenant: "Ella", spend: "₱1,130", status: "OK", tone: C.mint },
  { room: "Room 106", tenant: "Vacant", spend: "₱160", status: "Idle", tone: "rgba(255,255,255,0.45)" },
];

const ADMIN = [
  { at: 195, icon: "peso", label: "Meralco rate editor", note: "Audited changes" },
  { at: 208, icon: "bolt", label: "Devices & demo units", note: "Every meter, one list" },
  { at: 221, icon: "wallet", label: "Users & roles", note: "Owners, managers, tenants" },
  { at: 234, icon: "bell", label: "Audit log & health", note: "Who changed what" },
] as const;

const ManagerInner = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: C.fg }}>
      <Backdrop glowX={40} glowY={60} />
      <Audio name="Transition clap" src={staticFile("sfx/clap.mp3")} from={0} volume={0.55} />
      <Audio name="Narration" src={staticFile("voiceover/08-manager.mp3")} from={15} />

      <Kicker style={{ position: "absolute", left: 140, top: 120, ...rise(frame, 6) }}>MANAGER MODE & ADMIN</Kicker>
      <Interactive.Div
        name="Headline"
        style={{
          position: "absolute",
          left: 140,
          top: 175,
          fontSize: 112,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          opacity: interpolate(frame, [10, 30], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          }),
          translate: interpolate(frame, [10, 30], ["0px 50px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          }),
        }}
      >
        Built for landlords, too.
      </Interactive.Div>

      {/* Fleet dashboard */}
      <div
        style={{
          position: "absolute",
          left: 140,
          top: 380,
          width: 1060,
          padding: 40,
          boxSizing: "border-box",
          borderRadius: 36,
          background: C.surface,
          border: "2px solid rgba(255,255,255,0.08)",
          ...rise(frame, 30, 60),
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 42, fontWeight: 700 }}>Fleet</div>
          <div style={{ fontSize: 28, color: "rgba(255,255,255,0.5)" }}>6 rooms · ₱5,940 this month</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginTop: 28 }}>
          {ROOMS.map((r, i) => (
            <div key={r.room} style={{ padding: "22px 24px", borderRadius: 24, background: "rgba(0,0,0,0.3)", ...rise(frame, 50 + i * 9, 24) }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 30, fontWeight: 700 }}>{r.room}</span>
                <span style={{ fontSize: 30, fontWeight: 700 }}>{r.spend}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 24 }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>{r.tenant}</span>
                <span style={{ color: r.tone, fontWeight: 700 }}>{r.status}</span>
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 26,
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "20px 26px",
            borderRadius: 24,
            background: "rgba(0,230,111,0.08)",
            border: "2px solid rgba(0,230,111,0.25)",
            fontSize: 28,
            ...rise(frame, 132, 20),
          }}
        >
          <Owl size={44} />
          <span>
            <b style={{ color: C.mint }}>AI priority:</b> Room 104’s aircon ran 14 hours overnight.
          </span>
        </div>
      </div>

      {/* Admin console */}
      <div
        style={{
          position: "absolute",
          left: 1240,
          top: 380,
          width: 540,
          padding: 40,
          boxSizing: "border-box",
          borderRadius: 36,
          background: C.surface,
          border: "2px solid rgba(255,255,255,0.08)",
          ...rise(frame, 186, 60),
        }}
      >
        <div style={{ fontSize: 42, fontWeight: 700 }}>Admin console</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 28 }}>
          {ADMIN.map((a) => (
            <div key={a.label} style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 20px", borderRadius: 22, background: "rgba(0,0,0,0.3)", ...rise(frame, a.at, 20) }}>
              <div style={{ width: 60, height: 60, borderRadius: 60, background: "rgba(0,230,111,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={a.icon} size={32} />
              </div>
              <div>
                <div style={{ fontSize: 30, fontWeight: 700 }}>{a.label}</div>
                <div style={{ fontSize: 22, color: "rgba(255,255,255,0.5)" }}>{a.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Manager = Interactive.create({
  Component: ManagerInner,
  layout: "absolute-fill",
});
