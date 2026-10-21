import type {Caption} from '@remotion/captions';
import {AbsoluteFill, Audio, Easing, Interactive, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Visual} from './Visuals';
type Story = {id:string;kicker:string;title:string;description:string;kind:string;narration:string;audioSeconds:number;duration:number;focus:string;voiceover:string;captions:Caption[]};
export const Scene = ({data,index}:{data:Story;index:number}) => {
 const frame=useCurrentFrame();
 const durationInFrames=data.duration;
 const reverse=index%2===1;
 const caption=data.captions.find(c=>frame/30*1000>=c.startMs && frame/30*1000<c.endMs);
 return <AbsoluteFill style={{background:'#121212',color:'#fff',fontFamily:'Space',overflow:'hidden'}}>
  <Audio src={staticFile(data.voiceover)} volume={1}/>
  <div style={{position:'absolute',width:850,height:850,borderRadius:'50%',left:reverse?-160:960,top:-120,background:'radial-gradient(circle,rgba(0,230,111,.12),transparent 68%)',translate:interpolate(frame,[0,durationInFrames],['0px 0px','0px 45px'])}}/>
  <div style={{position:'absolute',left:80,top:45,fontSize:28,fontWeight:700}}>Watt<span style={{color:'#00E66F'}}>Wise</span></div>
  <div style={{position:'absolute',right:80,top:51,fontSize:20,color:'#a4aca8',letterSpacing:2}}>END-USER WALKTHROUGH</div>
  <Interactive.Div name="Scene content" style={{opacity:interpolate(frame,[0,9,durationInFrames-7,durationInFrames-1],[0,1,1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}),translate:interpolate(frame,[0,16],['0px 35px','0px 0px'],{extrapolateRight:'clamp',easing:Easing.bezier(.16,1,.3,1)}),position:'absolute',left:reverse?750:80,top:170,width:760}}>
   <div style={{fontSize:22,color:'#00E66F',letterSpacing:3,marginBottom:28}}>{data.kicker}</div>
   {data.title.split('\n').map((line,i)=><Interactive.Div key={line} name="Headline line" style={{fontSize:78,fontWeight:700,lineHeight:1.08,letterSpacing:-3,opacity:interpolate(frame,[i*5,i*5+12],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}),translate:interpolate(frame,[i*5,i*5+18],['0px 25px','0px 0px'],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.bezier(.16,1,.3,1)})}}>{line}</Interactive.Div>)}
   <div style={{fontSize:32,lineHeight:1.4,color:'#b1b8b4',marginTop:30,maxWidth:640}}>{data.description}</div>
   <Interactive.Div name="Feature takeaway" style={{marginTop:26,display:'inline-block',padding:'12px 17px',borderRadius:12,background:'#123322',border:'1px solid #225236',fontSize:24,color:'#00E66F',opacity:interpolate(frame,[65,79],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}),translate:interpolate(frame,[65,82],['0px 14px','0px 0px'],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>{data.focus}</Interactive.Div>
   <div style={{fontSize:18,color:'#79847d',marginTop:22}}>{data.kind==='hardware'?'CONCEPTUAL HARDWARE · NOT FINAL PRODUCT DESIGN':data.kind==='feedback'?'Complete the survey after your hands-on tasks.':'ILLUSTRATIVE INTERFACE · SAMPLE DATA'}</div>
  </Interactive.Div>
  <Interactive.Div name="Application illustration" style={{position:'absolute',left:reverse?85:920,top:125,width:570,height:560,scale:interpolate(frame,[0,18,durationInFrames-10],[.80,.86,.89],{extrapolateRight:'clamp',easing:Easing.bezier(.16,1,.3,1)}),transformOrigin:'top center',opacity:interpolate(frame,[0,12,durationInFrames-7,durationInFrames-1],[0,1,1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}),translate:interpolate(frame,[0,20],['0px 40px','0px 0px'],{extrapolateRight:'clamp',easing:Easing.bezier(.16,1,.3,1)})}}><Visual kind={data.kind}/></Interactive.Div>
  <div style={{position:'absolute',left:80,right:80,top:760,height:1,background:'#323834'}}/>
  <div style={{position:'absolute',left:80,top:785,width:1440,fontSize:25,lineHeight:1.35,color:'#d6dcd8'}}>{caption?.text ?? ''}</div>
  <div style={{position:'absolute',bottom:21,left:80,fontSize:15,color:'#77817b'}}>WATTWISE / RESEARCH ORIENTATION</div>
  <div style={{position:'absolute',bottom:21,right:80,fontSize:16,color:'#77817b'}}>{String(index+1).padStart(2,'0')} / 10</div>
  <div style={{position:'absolute',bottom:0,left:0,height:5,background:'#00E66F',width:interpolate(frame,[0,durationInFrames],[index*160,(index+1)*160])}}/>
 </AbsoluteFill>;
};
