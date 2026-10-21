import {Audio, Series, staticFile} from 'remotion';
import {Welcome} from './scenes/Welcome';
import {Hardware} from './scenes/Hardware';
import {Setup} from './scenes/Setup';
import {Dashboard} from './scenes/Dashboard';
import {Wallet} from './scenes/Wallet';
import {History} from './scenes/History';
import {Insights} from './scenes/Insights';
import {Control} from './scenes/Control';
import {Reports} from './scenes/Reports';
import {Feedback} from './scenes/Feedback';
export const Walkthrough = () => {return <>
<Audio src={staticFile("background-music.wav")} volume={1}/>
<Series>
<Series.Sequence name="Welcome" durationInFrames={507}><Welcome/></Series.Sequence>
<Series.Sequence name="Hardware" durationInFrames={488}><Hardware/></Series.Sequence>
<Series.Sequence name="Setup" durationInFrames={412}><Setup/></Series.Sequence>
<Series.Sequence name="Dashboard" durationInFrames={479}><Dashboard/></Series.Sequence>
<Series.Sequence name="Wallet" durationInFrames={476}><Wallet/></Series.Sequence>
<Series.Sequence name="History" durationInFrames={401}><History/></Series.Sequence>
<Series.Sequence name="Insights" durationInFrames={575}><Insights/></Series.Sequence>
<Series.Sequence name="Control" durationInFrames={451}><Control/></Series.Sequence>
<Series.Sequence name="Reports" durationInFrames={483}><Reports/></Series.Sequence>
<Series.Sequence name="Feedback" durationInFrames={407}><Feedback/></Series.Sequence>
</Series></>;};
