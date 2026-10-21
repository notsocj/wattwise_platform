# WattWise motion film

A separate 1920 × 1080, 30 fps, 155.97-second composition named `WattwiseMotionFilm`. The existing `WattwiseSurvey` composition remains intact.

## Visual direction

A typographic product film with charcoal, mint, and warm-paper backgrounds. Thirty-three shots follow the supplied narration, with masked type reveals, an exploded perspective hardware illustration, flowing Wi-Fi particles, QR scanning, oversized telemetry, an animated budget dial, calendar assembly, growing charts, Taglish typography, power policy diagrams, and paper report exports.

All motion is derived from Remotion frame time. No CSS animation, browser randomness, or external media is needed. The film reuses the project's Space Grotesk fonts. Header labels distinguish illustrative data and interfaces from the conceptual hardware enclosure. The QR motif is illustrative, not a real pairing code. No readings represent production telemetry, and no savings or accuracy claim is implied.

## Audio preservation

`public/audio/narrated-master.wav` is a byte-for-byte copy of the previous finished narration/music mix. The user's ElevenLabs recording, pacing, scene boundaries, and quiet ducked music are unchanged. The composition plays the master once, without narration edits, speed changes, or additional gain. Word-aligned caption pages come from the existing `src/story.json`.

## Timeline

| Section | Start | Shots |
|---|---:|---:|
| Brand, homes, use/cost/budget | 00:00 | 4 |
| Hardware and Wi-Fi | 00:16.9 | 4 |
| Scan, profile, approve | 00:33.2 | 3 |
| Live data, cost, freshness | 00:46.9 | 4 |
| Wallet, rates, estimate context | 01:02.9 | 3 |
| Calendar and usage trends | 01:18.7 | 3 |
| Taglish insights and alerts | 01:32.1 | 3 |
| Smart Control and variable spend | 01:51.3 | 3 |
| Reports, settings, permissions | 02:06.3 | 3 |
| Tasks, honest feedback, close | 02:22.4 | 3 |

## Edit and render

Scene components are in `src/motion/scenes/`. `src/motion/design.tsx` contains the shared motion primitives and caption shell. `src/motion/MotionCompositions.tsx` exposes each scene as an editable connected composition. Standalone scene compositions preview visuals; the full composition carries the master audio.

```sh
npx remotion studio --no-open --port=3100
npx remotion render src/index.ts WattwiseMotionFilm ../output/video/Wattwise_Motion_Film.mp4 --codec=h264 --crf=18 --concurrency=4
```

Open `http://localhost:3100/WattwiseMotionFilm`. Keep the main duration and scene boundaries fixed when preserving the current voice-over. Visual shot boundaries may move within a scene to follow a different emphasis.

## Verification

Project lint/TypeScript and platform lint passed. Thirty key frames were reviewed across all ten scenes; the hardware reveal and budget layout were corrected for clear margins and readable figures. Full export is checked for decode errors, audio loudness, peak headroom, dimensions, duration, and narration preservation.

Final export verified: 1920 × 1080, 30 fps, H.264/AAC, 156.01 seconds, approximately 20.7 MB. Full decode completed without errors. Integrated audio loudness is -16.9 LUFS with -4.8 dBFS true-peak headroom after stereo encoding. The narration/music source master matches the previous master SHA-256 exactly.
