"""Align the approved script to local word timestamps, split audio, and update timelines."""
from pathlib import Path
import difflib,json,re,math,wave
P=Path(__file__).resolve().parents[1]
paragraphs=[
"Meet WattWise. An energy monitoring app for Philippine households. See what your connected appliances are using, understand estimated electricity costs, and keep your budget in view. Let's take a quick look. The readings in this demonstration are sample data.",
"It starts with a monitoring unit. The unit measures an appliance's electricity use, then sends readings to WattWise over Wi-Fi. The hardware shown here is a concept illustration. For your test session, researchers prepare the electrical connections.",
"To add an appliance, scan its device code or enter its identifier. Tell WattWise how you normally use it. Then review the AI profile and suggested budget. You choose the appliance limit before approving it.",
"On the Home Dashboard, you can see what's running right now. Check power in watts, voltage, current, and energy used today. You'll also see the estimated daily cost. When fresh readings stop arriving, the device shows as offline or idle.",
"Next, open your Home Wallet. Set a household budget, check spending so far, and view your projected bill. Estimates use Meralco rate components, fixed charges, and tax. They help you track costs, but they are not your official electricity bill.",
"Want to understand your usage over time? Open the calendar and Burn Analytics. Explore daily records, weekly summaries, and spending trends. Compare your connected appliances and see when usage changes.",
"WattWise also offers practical energy insights in Taglish. These insights use your recorded data to explain usage patterns. Budget warnings and unusual-use alerts highlight changes to review. Choose the suggestions that fit your household. Actual savings will depend on how you use your appliances.",
"With Smart Control, you choose what happens when an appliance reaches its approved limit. You can require approval, or enable automatic shutoff. The cutoff tracks calendar-month variable energy spending. Home-level fixed charges are excluded.",
"Need a record of your usage? Open Energy Reports, choose a period, and download a PDF or CSV. In Settings, manage your account, billing cycle, and notification preferences. Push notifications require your permission and service availability.",
"Now, it's your turn to try WattWise. Complete the assigned tasks. Tell us what feels clear, what feels confusing, and what you would actually use. Answer the survey based on your own experience. There are no right or wrong answers."
]
raw=json.loads((P/'src/recording-captions.json').read_text())
expected=' '.join(paragraphs).split()
norm=lambda t:re.sub(r'[^a-z0-9]','',t.lower())
matcher=difflib.SequenceMatcher(a=[norm(t) for t in expected],b=[norm(w['text']) for w in raw],autojunk=False)
aligned=[]
for tag,a,b,c,d in matcher.get_opcodes():
 if tag=='insert':continue
 if tag=='equal':
  aligned.extend(dict(raw[c+i],text=' '+expected[a+i]) for i in range(b-a))
 else:
  start=raw[c]['startMs'] if c<len(raw) else raw[-1]['endMs']
  end=raw[d-1]['endMs'] if d>c else start+20
  for i in range(b-a):
   left=round(start+(end-start)*i/(b-a));right=round(start+(end-start)*(i+1)/(b-a))
   aligned.append(dict(text=' '+expected[a+i],startMs=left,endMs=right,timestampMs=left,confidence=None))
assert len(aligned)==len(expected)
counts=[len(p.split()) for p in paragraphs];offsets=[sum(counts[:i]) for i in range(10)]
starts=[0]+[max(0,math.floor((aligned[o]['startMs']/1000-.15)*30)) for o in offsets[1:]]
with wave.open('/tmp/wattwise-narration.wav') as wav:
 rate=wav.getframerate();channels=wav.getnchannels();width=wav.getsampwidth();frames=wav.getnframes();audio=wav.readframes(frames)
end=math.ceil((frames/rate+.3)*30)
ends=starts[1:]+[end]
ss=json.loads((P/'src/story.json').read_text())
for i,s in enumerate(ss):
 start,end=starts[i],ends[i];s.update(duration=end-start,audioSeconds=(end-start)/30,narration=paragraphs[i],voiceover=f"voiceover/elevenlabs/{s['id']}.wav")
 left=round(start/30*rate);right=round(end/30*rate)
 clip=audio[left*channels*width:min(right,frames)*channels*width]
 clip+=b'\0'*max(0,(right-frames)*channels*width)
 with wave.open(str(P/'public'/s['voiceover']),'wb') as out:
  out.setnchannels(channels);out.setsampwidth(width);out.setframerate(rate);out.writeframes(clip)
 words=aligned[offsets[i]:offsets[i]+counts[i]];pages=[];group=[]
 for j,w in enumerate(words):
  group.append(w)
  if len(group)>=10 or re.search(r'[.!?]$',w['text']) or j==len(words)-1:
   begin=max(0,round(group[0]['startMs']-start/30*1000));finish=max(begin+80,round(group[-1]['endMs']-start/30*1000+150))
   pages.append(dict(text=''.join(w['text'] for w in group).strip(),startMs=begin,endMs=finish,timestampMs=begin,confidence=None));group=[]
 s['captions']=pages
 for file in ['src/Root.tsx','src/Walkthrough.tsx']:
  q=P/file;t=q.read_text()
  pattern=(r'(id="'+s['id']+r'" component=\{'+s['id']+r'\} durationInFrames=\{)\d+') if file.endswith('Root.tsx') else (r'(name="'+s['id']+r'" durationInFrames=\{)\d+')
  q.write_text(re.sub(pattern,r'\g<1>'+str(s['duration']),t))
 print(s['id'],start/30,end/30)
(P/'src/story.json').write_text(json.dumps(ss,indent=2))
q=P/'src/Root.tsx';q.write_text(re.sub(r'(id="WattwiseSurvey" component=\{Walkthrough\} durationInFrames=\{)\d+',r'\g<1>'+str(ends[-1]),q.read_text()))
print('Final duration',ends[-1]/30)
