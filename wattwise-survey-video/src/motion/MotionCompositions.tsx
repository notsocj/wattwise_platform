import { Composition, Folder } from "remotion";
import { MotionFilm } from "./MotionFilm";
import { IntroMotion } from "./scenes/Intro";
import { HardwareMotion } from "./scenes/Hardware";
import { SetupMotion } from "./scenes/Setup";
import { DashboardMotion } from "./scenes/Dashboard";
import { WalletMotion } from "./scenes/Wallet";
import { HistoryMotion } from "./scenes/History";
import { InsightsMotion } from "./scenes/Insights";
import { ControlMotion } from "./scenes/Control";
import { ReportsMotion } from "./scenes/Reports";
import { FeedbackMotion } from "./scenes/Feedback";
export const MotionCompositions = () => (
  <>
    <Composition
      id="WattwiseMotionFilm"
      component={MotionFilm}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={4679}
    />
    <Folder name="Motion-Film-Scenes">
      <Composition
        id="Motion-Intro"
        component={IntroMotion}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={507}
      />
      <Composition
        id="Motion-Hardware"
        component={HardwareMotion}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={488}
      />
      <Composition
        id="Motion-Setup"
        component={SetupMotion}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={412}
      />
      <Composition
        id="Motion-Dashboard"
        component={DashboardMotion}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={479}
      />
      <Composition
        id="Motion-Wallet"
        component={WalletMotion}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={476}
      />
      <Composition
        id="Motion-History"
        component={HistoryMotion}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={401}
      />
      <Composition
        id="Motion-Insights"
        component={InsightsMotion}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={575}
      />
      <Composition
        id="Motion-Control"
        component={ControlMotion}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={451}
      />
      <Composition
        id="Motion-Reports"
        component={ReportsMotion}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={483}
      />
      <Composition
        id="Motion-Feedback"
        component={FeedbackMotion}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={407}
      />
    </Folder>
  </>
);
