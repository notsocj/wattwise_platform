import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import {
  AbsoluteFill,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Assistant } from "./scenes/Assistant";
import { Billing } from "./scenes/Billing";
import { Control } from "./scenes/Control";
import { Insights } from "./scenes/Insights";
import { Intro } from "./scenes/Intro";
import { Live } from "./scenes/Live";
import { Manager } from "./scenes/Manager";
import { Outro } from "./scenes/Outro";
import { Problem } from "./scenes/Problem";

// 9 scenes (4365 frames) minus 8 transitions of 15 frames = 4245 frames.
export const Showcase = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#0B0C0B" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence name="1 · Problem" durationInFrames={745}>
          <Problem name="Problem" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
        <TransitionSeries.Sequence name="2 · Intro" durationInFrames={400}>
          <Intro name="Intro" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: 15 })} />
        <TransitionSeries.Sequence name="3 · Live dashboard" durationInFrames={330}>
          <Live name="Live" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: 15 })} />
        <TransitionSeries.Sequence name="4 · Billing" durationInFrames={420}>
          <Billing name="Billing" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: 15 })} />
        <TransitionSeries.Sequence name="5 · Smart control" durationInFrames={360}>
          <Control name="Control" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
        <TransitionSeries.Sequence name="6 · AI assistant" durationInFrames={1140}>
          <Assistant name="Assistant" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: 15 })} />
        <TransitionSeries.Sequence name="7 · Insights" durationInFrames={410}>
          <Insights name="Insights" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: 15 })} />
        <TransitionSeries.Sequence name="8 · Manager & admin" durationInFrames={320}>
          <Manager name="Manager" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
        <TransitionSeries.Sequence name="9 · Outro" durationInFrames={240}>
          <Outro name="Outro" />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      <Audio
        name="Music bed"
        src={staticFile("music/bed.mp3")}
        durationInFrames={durationInFrames}
        volume={(f) =>
          interpolate(f, [0, 30, durationInFrames - 90, durationInFrames - 1], [0, 0.8, 0.8, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />

      {/* Fade to black at the very end */}
      <AbsoluteFill
        style={{
          backgroundColor: "black",
          opacity: interpolate(frame, [durationInFrames - 24, durationInFrames - 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
    </AbsoluteFill>
  );
};
