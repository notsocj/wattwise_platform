import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Backdrop, C, FONT, Owl, pop, rise } from "../ui";

const OutroInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: C.fg }}>
      <Backdrop glowX={50} glowY={42} />
      <Audio name="Logo clap" src={staticFile("sfx/clap.mp3")} from={2} volume={0.8} />
      {/* Ends in the pause before the recorded "Thank you." */}
      <Audio name="Narration" src={staticFile("voiceover/09-close.mp3")} from={30} durationInFrames={4 * fps} />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div style={{ ...pop(frame, 6), filter: `drop-shadow(0 0 ${40 + Math.sin(frame / 8) * 14}px rgba(0,230,111,0.55))` }}>
          <Owl size={220} />
        </div>
        <Interactive.Div
          name="Wordmark"
          style={{
            marginTop: 24,
            fontSize: 168,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            opacity: interpolate(frame, [26, 44], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.23, 1, 0.32, 1),
            }),
            translate: interpolate(frame, [26, 44], ["0px 40px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.23, 1, 0.32, 1),
            }),
          }}
        >
          WattWise
        </Interactive.Div>
        <div style={{ display: "flex", gap: 32, fontSize: 76, fontWeight: 700, marginTop: 10 }}>
          <span style={{ ...rise(frame, 64, 30) }}>See every watt.</span>
          <span style={{ color: C.mint, ...rise(frame, 104, 30) }}>Control every peso.</span>
        </div>
        <div style={{ marginTop: 70, fontSize: 34, color: "rgba(255,255,255,0.45)", ...rise(frame, 140, 20) }}>
          wattwise-app.site
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Outro = Interactive.create({
  Component: OutroInner,
  layout: "absolute-fill",
});
