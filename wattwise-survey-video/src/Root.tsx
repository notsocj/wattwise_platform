import { MotionCompositions } from "./motion/MotionCompositions";
import "./index.css";
import { Composition, Folder } from "remotion";
import { Walkthrough } from "./Walkthrough";
import { Welcome } from "./scenes/Welcome";
import { Hardware } from "./scenes/Hardware";
import { Setup } from "./scenes/Setup";
import { Dashboard } from "./scenes/Dashboard";
import { Wallet } from "./scenes/Wallet";
import { History } from "./scenes/History";
import { Insights } from "./scenes/Insights";
import { Control } from "./scenes/Control";
import { Reports } from "./scenes/Reports";
import { Feedback } from "./scenes/Feedback";
export const RemotionRoot = () => (
  <>
    <MotionCompositions />
    <Composition
      id="WattwiseSurvey"
      component={Walkthrough}
      durationInFrames={4679}
      fps={30}
      width={1600}
      height={900}
    />
    <Folder name="Scenes">
      <Composition
        id="Welcome"
        component={Welcome}
        durationInFrames={507}
        fps={30}
        width={1600}
        height={900}
      />
      <Composition
        id="Hardware"
        component={Hardware}
        durationInFrames={488}
        fps={30}
        width={1600}
        height={900}
      />
      <Composition
        id="Setup"
        component={Setup}
        durationInFrames={412}
        fps={30}
        width={1600}
        height={900}
      />
      <Composition
        id="Dashboard"
        component={Dashboard}
        durationInFrames={479}
        fps={30}
        width={1600}
        height={900}
      />
      <Composition
        id="Wallet"
        component={Wallet}
        durationInFrames={476}
        fps={30}
        width={1600}
        height={900}
      />
      <Composition
        id="History"
        component={History}
        durationInFrames={401}
        fps={30}
        width={1600}
        height={900}
      />
      <Composition
        id="Insights"
        component={Insights}
        durationInFrames={575}
        fps={30}
        width={1600}
        height={900}
      />
      <Composition
        id="Control"
        component={Control}
        durationInFrames={451}
        fps={30}
        width={1600}
        height={900}
      />
      <Composition
        id="Reports"
        component={Reports}
        durationInFrames={483}
        fps={30}
        width={1600}
        height={900}
      />
      <Composition
        id="Feedback"
        component={Feedback}
        durationInFrames={407}
        fps={30}
        width={1600}
        height={900}
      />
    </Folder>
  </>
);
