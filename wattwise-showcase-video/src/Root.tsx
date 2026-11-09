import { Composition, Folder } from "remotion";
import { Assistant } from "./scenes/Assistant";
import { Billing } from "./scenes/Billing";
import { Control } from "./scenes/Control";
import { Insights } from "./scenes/Insights";
import { Intro } from "./scenes/Intro";
import { Live } from "./scenes/Live";
import { Manager } from "./scenes/Manager";
import { Outro } from "./scenes/Outro";
import { Problem } from "./scenes/Problem";
import { Showcase } from "./Showcase";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="WattwiseShowcase"
        component={Showcase}
        durationInFrames={4245}
        fps={30}
        width={1920}
        height={1080}
      />
      <Folder name="Scenes">
        <Composition id="Problem" component={Problem} durationInFrames={745} fps={30} width={1920} height={1080} />
        <Composition id="Intro" component={Intro} durationInFrames={400} fps={30} width={1920} height={1080} />
        <Composition id="Live" component={Live} durationInFrames={330} fps={30} width={1920} height={1080} />
        <Composition id="Billing" component={Billing} durationInFrames={420} fps={30} width={1920} height={1080} />
        <Composition id="Control" component={Control} durationInFrames={360} fps={30} width={1920} height={1080} />
        <Composition id="Assistant" component={Assistant} durationInFrames={1140} fps={30} width={1920} height={1080} />
        <Composition id="Insights" component={Insights} durationInFrames={410} fps={30} width={1920} height={1080} />
        <Composition id="Manager" component={Manager} durationInFrames={320} fps={30} width={1920} height={1080} />
        <Composition id="Outro" component={Outro} durationInFrames={240} fps={30} width={1920} height={1080} />
      </Folder>
    </>
  );
};
