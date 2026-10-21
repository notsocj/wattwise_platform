# Wattwise survey walkthrough

156 seconds · 1600 × 900 · 30 fps. English narration with Taglish examples.

This is a neutral orientation for end-user research, not evidence of usability, accuracy, or savings. Interface illustrations are enlarged reconstructions of existing routes; all numbers and AI copy are illustrative. The hardware drawing is conceptual, not a final enclosure or wiring guide. No production accounts or private telemetry are used.

## Preview and export

```sh
npm install
npx remotion studio --no-open --port=3100
npx remotion render src/index.ts WattwiseSurvey ../output/video/Wattwise_Survey_Walkthrough_Narrated.mp4
```

Edit `src/story.json` for copy and narration, `src/scenes/` for individual editable timelines, and `src/Visuals.tsx` for visuals. Scenes follow the supplied full ElevenLabs recording, split at 30-fps boundaries without removing speech. If changing spoken copy, regenerate the corresponding WAV with macOS `say` and `afconvert`, then check that narration is shorter than the scene duration. Audio uses the local Samantha system voice, with no paid TTS service.

Content sources: app/dashboard, app/dashboard/[deviceId], app/dashboard/calendar, app/analytics, app/settings, app/reports, app/rates, AddApplianceModal, notification policy, and the ESP32-S3/PZEM hardware project. Cost figures are sample display values, not calculated rate claims. Per-device cutoff is calendar-month variable spend; Home Wallet follows the billing cycle.

The faster revision uses 200-word/minute local narration, staggered UI reveals, alternating layouts, animated budget bars, and an original synthesized instrumental pulse. The original exported MP4 is retained in `../output/video/Wattwise_Survey_Walkthrough.mp4`; original copy is archived in `story-original.json`.

## Supplied ElevenLabs narration and music mix

The current composition uses the user-supplied Dan recording, normalized to approximately -16.8 LUFS with a -2 dBTP voice ceiling. `public/background-music.wav` is the original synthesized instrumental, prepared at -30 LUFS before narration-driven ducking (4:1 ratio, 30 ms attack, 320 ms release), with 1.2-second entrance and 1.5-second exit fades. Combined pre-encode measurement: approximately -16.85 LUFS / -1.82 dBTP. Music is kept substantially below speech.

The original MP3 is retained under `public/voiceover/elevenlabs/`. Normalized per-scene WAVs are alongside it. `src/recording-captions.json` contains local word timings; `src/story.json` contains corrected caption pages. `scripts/prepare-recording.py` maps the approved script to those timings and updates scene metadata from a normalized `/tmp/wattwise-narration.wav`. Regenerate transcription and music ducking when replacing the recording. No audio is sent to a transcription service.

## Motion graphics edition

`WattwiseMotionFilm` is a separate 1080p, 33-shot redesign using the unchanged final voice/music master. See [MOTION-FILM.md](MOTION-FILM.md) for its timeline, editing structure, and render command. Export: `../output/video/Wattwise_Motion_Film.mp4`. The existing `WattwiseSurvey` composition is preserved.
