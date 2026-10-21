import { Audio, Series, staticFile } from "remotion";
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
export const MotionFilm = () => (
  <>
    <Audio src={staticFile("audio/narrated-master.wav")} volume={1} />
    <Series>
      <Series.Sequence name="Brand / Energy / Home" durationInFrames={507}>
        <IntroMotion />
      </Series.Sequence>
      <Series.Sequence name="Hardware / Wi-Fi" durationInFrames={488}>
        <HardwareMotion />
      </Series.Sequence>
      <Series.Sequence name="Scan / Profile / Approve" durationInFrames={412}>
        <SetupMotion />
      </Series.Sequence>
      <Series.Sequence name="Live / Metrics / Freshness" durationInFrames={479}>
        <DashboardMotion />
      </Series.Sequence>
      <Series.Sequence
        name="Budget / Components / Estimate"
        durationInFrames={476}
      >
        <WalletMotion />
      </Series.Sequence>
      <Series.Sequence name="Calendar / Trends" durationInFrames={401}>
        <HistoryMotion />
      </Series.Sequence>
      <Series.Sequence name="Taglish / Alerts / Choice" durationInFrames={575}>
        <InsightsMotion />
      </Series.Sequence>
      <Series.Sequence name="Limit / Policy / Spend" durationInFrames={451}>
        <ControlMotion />
      </Series.Sequence>
      <Series.Sequence
        name="Reports / Settings / Permission"
        durationInFrames={483}
      >
        <ReportsMotion />
      </Series.Sequence>
      <Series.Sequence name="Try / Reflect / Survey" durationInFrames={407}>
        <FeedbackMotion />
      </Series.Sequence>
    </Series>
  </>
);
