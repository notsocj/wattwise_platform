# WattWise defense showcase

A 2:21 product video (1920 × 1080, 30 fps) for the final defense: a Tagalog family puzzling over their bill, the problem, the hardware, live data, Meralco billing, Smart Control, the AI assistant (the longest scene), insights and reports, manager mode and admin, and a closing card.

## Preview and export

```sh
npm install
npx remotion studio
npx remotion render src/index.ts WattwiseShowcase /tmp/raw.mp4 --codec=h264 --crf=18
# Raw mix is about -21 LUFS; bring it to -16 LUFS / -1.5 dBTP for room playback.
ffmpeg -i /tmp/raw.mp4 -c:v copy -af loudnorm=I=-16:TP=-1.5:LRA=11 -c:a aac -b:a 256k ../output/video/WattWise_Defense_Showcase.mp4
```

Each scene is in `src/scenes/` and is also registered on its own under **Scenes** in the Studio. `src/Showcase.tsx` strings them together with 15-frame transitions and the music bed. Shared colours, fonts, the owl mark, and the phone frame are in `src/ui.tsx`.

## Audio

- Narration (`public/voiceover/`): ElevenLabs v4, voice "Justin Case". The homeowner's Taglish request is the "Camille" voice. The family in the opening (`00a`–`00d`) is "Starla" (mom), "Arcel" (dad), and "Camille" (daughter).
- Sound effects (`public/sfx/`): ElevenLabs Sound Effects v2. `clap.mp3` (your own ElevenLabs clap) marks every scene change and logo reveal.
- Music (`public/music/bed.mp3`): the original synthesized instrumental from `../wattwise-survey-video`, converted to MP3.

Each narration clip starts inside its scene; if you replace one, keep it shorter than the scene minus 15 frames, or lengthen the scene in `Showcase.tsx`, `Root.tsx`, and the total in `Root.tsx`.

All numbers, names, and chat text on screen are illustrative, not production data.
