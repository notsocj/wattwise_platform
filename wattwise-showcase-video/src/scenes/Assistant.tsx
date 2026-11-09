import { Audio } from "@remotion/media";
import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  interpolateColors,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Backdrop, C, FONT, Icon, Kicker, LiveDot, Owl, pop, prog, rise } from "../ui";

// Phase boundaries (frames inside this scene).
const CHAT_IN = 245;
const SENT = 305;
const REPLY = 435;
const CARD = 470;
const TAP = 630;
const GRID_IN = 690;
const CLOSER = 1000;

const REQUEST = "Pakipatay yung aircon mamayang 1 AM";

const STEPS = [
  { from: CHAT_IN, to: REPLY, n: "1", title: "Ask", note: "In your own words" },
  { from: REPLY, to: TAP, n: "2", title: "Review", note: "See exactly what changes" },
  { from: TAP, to: GRID_IN, n: "3", title: "Confirm", note: "Nothing runs until you tap" },
];

const ABILITIES = [
  { at: 750, icon: "clock", title: "Timed turn-off", ask: "Turn off the TV at 11 PM" },
  { at: 772, icon: "peso", title: "Spend limit", ask: "Cut the ref once it spends ₱50" },
  { at: 796, icon: "bolt", title: "Energy limit", ask: "Stop the heater after 2 kWh" },
  { at: 845, icon: "wallet", title: "Budgets", ask: "Set my home budget to ₱3,000" },
  { at: 895, icon: "power", title: "Auto cut-off", ask: "Turn on auto cut-off for the aircon" },
  { at: 950, icon: "bell", title: "Alerts", ask: "Email me when I hit my limit" },
] as const;

/** A chat message that grows in from zero height so older messages scroll up. */
const Grow = ({ at, children }: { readonly at: number; readonly children: ReactNode }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, at, 14);
  return (
    <div style={{ maxHeight: p * 700, opacity: p, translate: `0px ${(1 - p) * 24}px`, overflow: "hidden", flexShrink: 0 }}>
      {children}
    </div>
  );
};

const Avatar = () => (
  <div style={{ width: 52, height: 52, borderRadius: 52, background: "rgba(0,230,111,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <Owl size={32} />
  </div>
);

const Bot = ({ children }: { readonly children: ReactNode }) => (
  <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: 22 }}>
    <Avatar />
    <div style={{ padding: "20px 26px", borderRadius: "28px 28px 28px 8px", background: C.surface, border: "2px solid rgba(255,255,255,0.08)", fontSize: 30, lineHeight: 1.35, maxWidth: 560 }}>
      {children}
    </div>
  </div>
);

const AssistantInner = () => {
  const frame = useCurrentFrame();
  const typed = Math.round(interpolate(frame, [250, 298], [0, REQUEST.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const introOut = 1 - prog(frame, 228, 16);
  const chatOut = 1 - prog(frame, GRID_IN - 14, 16);
  const confirmed = prog(frame, TAP + 2, 8);
  const cursor = prog(frame, TAP - 34, 30);
  const gridDim = 1 - 0.85 * prog(frame, CLOSER, 20);
  const greetingLeft = 1 - prog(frame, CARD, 14);

  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: C.fg }}>
      <Backdrop glowX={50} glowY={40} />

      {/* Sound */}
      <Audio name="Owl clap" src={staticFile("sfx/clap.mp3")} from={18} volume={0.75} />
      <Audio name="Narration · intro" src={staticFile("voiceover/06a-ai-intro.mp3")} from={15} />
      <Audio name="Chat clap" src={staticFile("sfx/clap.mp3")} from={CHAT_IN - 1} volume={0.5} />
      <Audio name="Typing" src={staticFile("sfx/typing.mp3")} from={250} volume={0.55} />
      <Audio name="Homeowner (Taglish)" src={staticFile("voiceover/06-user-request.mp3")} from={255} />
      <Audio name="Sent pop" src={staticFile("sfx/pop.mp3")} from={SENT} volume={0.6} />
      <Audio name="Reply pop" src={staticFile("sfx/pop.mp3")} from={REPLY} volume={0.6} />
      <Audio name="Narration · proposal" src={staticFile("voiceover/06b-ai-propose.mp3")} from={REPLY + 5} />
      <Audio name="Confirm chime" src={staticFile("sfx/success.mp3")} from={TAP + 2} volume={0.7} />
      <Audio name="Grid clap" src={staticFile("sfx/clap.mp3")} from={GRID_IN - 6} volume={0.5} />
      <Audio name="Narration · abilities" src={staticFile("voiceover/06c-ai-abilities.mp3")} from={GRID_IN + 10} />

      {/* Phase A: title card */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", opacity: introOut }}>
        <Kicker style={{ ...rise(frame, 8) }}>THE HIGHLIGHT</Kicker>
        <div style={{ marginTop: 40, ...pop(frame, 22), filter: `drop-shadow(0 0 ${36 + Math.sin(frame / 7) * 14}px rgba(0,230,111,0.6))` }}>
          <Owl size={200} />
        </div>
        <Interactive.Div
          name="AI title"
          style={{
            marginTop: 40,
            fontSize: 140,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            textAlign: "center",
            opacity: interpolate(frame, [88, 106], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.23, 1, 0.32, 1),
            }),
            translate: interpolate(frame, [88, 106], ["0px 50px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.23, 1, 0.32, 1),
            }),
          }}
        >
          WattWise <span style={{ color: C.mint }}>AI Assistant</span>
        </Interactive.Div>
        <div style={{ display: "flex", gap: 24, marginTop: 44 }}>
          {["Just ask —", "English", "Taglish"].map((t, i) => (
            <div
              key={t}
              style={{
                fontSize: 56,
                padding: i === 0 ? "14px 0" : "14px 36px",
                borderRadius: 999,
                background: i === 0 ? "transparent" : "rgba(0,230,111,0.12)",
                border: i === 0 ? "none" : "2px solid rgba(0,230,111,0.35)",
                color: i === 0 ? "rgba(255,255,255,0.7)" : C.mint,
                fontWeight: i === 0 ? 400 : 700,
                ...pop(frame, 165 + i * 12),
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </AbsoluteFill>

      {/* Phase B: steps */}
      <div style={{ position: "absolute", left: 140, top: 200, opacity: chatOut * prog(frame, CHAT_IN, 16) }}>
        <Kicker>HOW IT WORKS</Kicker>
        <div style={{ display: "flex", flexDirection: "column", gap: 40, marginTop: 50 }}>
          {STEPS.map((s) => {
            const active = frame >= s.from && frame < s.to;
            const done = frame >= s.to;
            return (
              <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 36, opacity: active ? 1 : done ? 0.65 : 0.3 }}>
                <div
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: 104,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 48,
                    fontWeight: 700,
                    background: active || done ? C.mint : "transparent",
                    color: active || done ? C.ink : C.fg,
                    border: `3px solid ${active || done ? C.mint : "rgba(255,255,255,0.3)"}`,
                  }}
                >
                  {done ? <Icon name="check" size={52} color={C.ink} /> : s.n}
                </div>
                <div>
                  <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1 }}>{s.title}</div>
                  <div style={{ fontSize: 38, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>{s.note}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase B: chat panel (mirrors CustomerAssistantFab) */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 60,
          width: 820,
          height: 960,
          borderRadius: 44,
          background: C.canvas,
          border: "2px solid rgba(255,255,255,0.1)",
          boxShadow: "0 60px 160px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          opacity: prog(frame, CHAT_IN, 18) * chatOut,
          translate: `${(1 - prog(frame, CHAT_IN, 18)) * 200}px 0px`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "26px 32px", borderBottom: "2px solid rgba(255,255,255,0.07)" }}>
          <Avatar />
          <div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>WattWise Assistant</div>
            <div style={{ fontSize: 22, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 10 }}>
              <LiveDot size={10} /> Online
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 32px 24px", overflow: "hidden" }}>
          {/* Greeting scrolls away so the request stays visible during review */}
          <div style={{ maxHeight: greetingLeft * 400, opacity: greetingLeft, overflow: "hidden", flexShrink: 0 }}>
            <Bot>
              <b>Kumusta! How can I help?</b>
              <div style={{ fontSize: 24, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
                I can explain your usage and prepare safe changes for you to review.
              </div>
            </Bot>
          </div>

          <Grow at={SENT}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
              <div style={{ padding: "20px 26px", borderRadius: "28px 28px 8px 28px", background: C.mint, color: C.ink, fontSize: 30, fontWeight: 700, maxWidth: 720, whiteSpace: "nowrap" }}>
                {REQUEST}
              </div>
            </div>
          </Grow>

          {frame >= SENT + 10 && frame < REPLY && (
            <Grow at={SENT + 10}>
              <Bot>
                <div style={{ display: "flex", gap: 10 }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{ width: 14, height: 14, borderRadius: 14, background: C.mint, opacity: 0.35 + 0.65 * ((Math.sin((frame - i * 5) / 4) + 1) / 2) }} />
                  ))}
                </div>
                <div style={{ fontSize: 22, color: "rgba(255,255,255,0.5)", marginTop: 10 }}>
                  {frame < 375 ? "Finding your aircon…" : "Preparing a schedule…"}
                </div>
              </Bot>
            </Grow>
          )}

          <Grow at={REPLY}>
            <Bot>Sige! I can turn off your <b>Aircon</b> at <b>1:00 AM</b>. Please review:</Bot>
          </Grow>

          <Grow at={CARD}>
            <div style={{ marginLeft: 66, marginTop: 18, borderRadius: 28, border: "2px solid rgba(0,230,111,0.3)", background: C.surface, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "2px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.14em", color: C.mint, padding: "6px 16px", borderRadius: 999, background: "rgba(0,230,111,0.1)" }}>
                  REVIEW CHANGE
                </span>
                <span style={{ fontSize: 22, color: "rgba(255,255,255,0.45)", display: "flex", gap: 8, alignItems: "center" }}>
                  <Icon name="clock" size={24} color="rgba(255,255,255,0.45)" /> Expires in 10 min
                </span>
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ fontSize: 32, fontWeight: 700 }}>Schedule turn-off</div>
                <div style={{ fontSize: 24, color: "rgba(255,255,255,0.5)" }}>Aircon · Bedroom</div>
                <div style={{ display: "flex", alignItems: "stretch", gap: 12, marginTop: 18, fontSize: 26 }}>
                  <div style={{ flex: 1, padding: 16, borderRadius: 18, background: "rgba(0,0,0,0.25)" }}>
                    <div style={{ fontSize: 18, letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)" }}>CURRENT</div>
                    Running now
                  </div>
                  <div style={{ alignSelf: "center", color: C.mint, fontSize: 34 }}>→</div>
                  <div style={{ flex: 1, padding: 16, borderRadius: 18, background: "rgba(0,230,111,0.08)", border: "2px solid rgba(0,230,111,0.25)" }}>
                    <div style={{ fontSize: 18, letterSpacing: "0.1em", color: C.mint }}>PROPOSED</div>
                    <b>Off at 1:00 AM</b>
                  </div>
                </div>
                <div style={{ fontSize: 22, color: "rgba(255,255,255,0.55)", marginTop: 14 }}>
                  Relay cuts the Aircon’s power at 1:00 AM, Tue Nov 10.
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 20 }}>
                  <div
                    style={{
                      flex: 1,
                      height: 68,
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 12,
                      fontSize: 28,
                      fontWeight: 700,
                      background: interpolateColors(confirmed, [0, 1], [C.mint, C.bida]),
                      color: C.ink,
                      scale: String(1 - 0.06 * Math.sin(Math.PI * prog(frame, TAP - 4, 8))),
                    }}
                  >
                    {confirmed > 0 ? (
                      <>
                        <Icon name="check" size={32} color={C.ink} /> Confirmed
                      </>
                    ) : (
                      "Confirm"
                    )}
                  </div>
                  <div style={{ width: 200, height: 68, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, border: "2px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", opacity: 1 - confirmed * 0.6 }}>
                    Not now
                  </div>
                </div>
              </div>
            </div>
          </Grow>

          <Grow at={TAP + 18}>
            <Bot>
              <span style={{ color: C.mint, fontWeight: 700 }}>Done!</span> Your Aircon will turn off at 1:00 AM. Tulog na, tipid pa.
            </Bot>
          </Grow>
        </div>

        <div style={{ padding: "18px 24px 24px", borderTop: "2px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 10px 10px 26px", borderRadius: 999, background: C.surface, border: "2px solid rgba(255,255,255,0.1)" }}>
            <span style={{ flex: 1, fontSize: 28, color: frame >= 250 && frame < SENT ? C.fg : "rgba(255,255,255,0.3)" }}>
              {frame >= 250 && frame < SENT ? REQUEST.slice(0, typed) : "Ask about your energy use…"}
              {frame >= 250 && frame < SENT && Math.floor(frame / 8) % 2 === 0 ? "|" : ""}
            </span>
            <div style={{ width: 60, height: 60, borderRadius: 60, background: C.mint, display: "flex", alignItems: "center", justifyContent: "center", color: C.ink, fontSize: 30, fontWeight: 700 }}>
              ↑
            </div>
          </div>
        </div>
      </div>

      {/* Tap cursor on Confirm */}
      <div
        style={{
          position: "absolute",
          left: interpolate(cursor, [0, 1], [1700, 1268]),
          top: interpolate(cursor, [0, 1], [1040, 780]),
          width: 54,
          height: 54,
          borderRadius: 54,
          background: "rgba(255,255,255,0.85)",
          boxShadow: `0 0 0 ${prog(frame, TAP, 14) * 40}px rgba(255,255,255,${0.35 * (1 - prog(frame, TAP, 14))})`,
          opacity: (frame > TAP - 34 ? 1 : 0) * (1 - prog(frame, TAP + 16, 10)),
          scale: String(1 - 0.2 * Math.sin(Math.PI * prog(frame, TAP - 4, 8))),
        }}
      />

      {/* Phase C: everything it can do */}
      <div style={{ position: "absolute", left: 140, top: 110, opacity: gridDim }}>
        <Kicker style={{ ...rise(frame, GRID_IN) }}>WHAT IT CAN DO</Kicker>
        <Interactive.Div
          name="Abilities title"
          style={{
            marginTop: 14,
            fontSize: 104,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            opacity: interpolate(frame, [696, 716], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.23, 1, 0.32, 1),
            }),
            translate: interpolate(frame, [696, 716], ["0px 40px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.23, 1, 0.32, 1),
            }),
          }}
        >
          One assistant. Every device.
        </Interactive.Div>
      </div>
      <div style={{ position: "absolute", left: 140, top: 400, width: 1640, display: "flex", flexWrap: "wrap", gap: 40, opacity: gridDim }}>
        {ABILITIES.map((a) => (
          <div
            key={a.title}
            style={{
              width: 520,
              height: 260,
              padding: "34px 36px",
              boxSizing: "border-box",
              borderRadius: 32,
              background: C.surface,
              border: "2px solid rgba(0,230,111,0.16)",
              ...rise(frame, a.at, 40),
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ width: 72, height: 72, borderRadius: 72, background: "rgba(0,230,111,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={a.icon} size={40} />
              </div>
              <div style={{ fontSize: 42, fontWeight: 700 }}>{a.title}</div>
            </div>
            <div style={{ fontSize: 32, lineHeight: 1.3, color: "rgba(255,255,255,0.65)", marginTop: 26 }}>“{a.ask}”</div>
          </div>
        ))}
      </div>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <Interactive.Div
          name="Closer"
          style={{
            width: 1500,
            textAlign: "center",
            fontSize: 112,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            textShadow: "0 10px 60px rgba(0,0,0,0.8)",
            opacity: interpolate(frame, [1004, 1026], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.23, 1, 0.32, 1),
            }),
            scale: interpolate(frame, [1004, 1030], [0.92, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.23, 1, 0.32, 1),
            }),
          }}
        >
          Your whole home, controlled by <span style={{ color: C.mint }}>a conversation.</span>
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Assistant = Interactive.create({
  Component: AssistantInner,
  layout: "absolute-fill",
});
