# Tutorial screenshots and the demo video

Everything in `docs/tutorials/img` and the demo video on desktop.aaina.world is made from the app's real screens, in the
browser, with the sample Api in demo mode:

- `?demo` starts the sample Api with two garments (an emerald slip dress and a camel overcoat) on Chloe and Luca, instead of the test samples.
- `?catalog=live` shows Aaina's real public catalogue (models, poses, scenes) instead of the built-in samples. The tools relay
  `static.aaina.world` to the page, because it sends no CORS header (the app itself reads it without CORS).
- `?firstrun` starts at the welcome screens, with nothing made yet.

## The demo photos

The photos the demo shows were made once with the app's own prompts and engine settings (`make-photos.ts`, paid, about $0.20 a
model photo). They are kept in `docs/tools/demo/out` (not in git) and copied, smaller, into `src/lib/mock/img/demo-*.webp`.

```bash
OPENAI_API_KEY=… npx tsx docs/tools/demo/make-photos.ts product dress
OPENAI_API_KEY=… npx tsx docs/tools/demo/make-photos.ts model chloe dress loc_warm_arch_studio 20 chloe-dress-walk
```

## Screenshots

```bash
npx playwright test -c docs/tools/demo tutorials
```

Writes `docs/tutorials/img/*.webp` at 1600 px wide. The site uses copies in `site/img/t`.

## The video

```bash
OPENAI_API_KEY=… npx tsx docs/tools/demo/tts.ts        # the narration in narration.ts, one mp3 per scene (paid, a few cents)
npx tsx docs/tools/demo/hear.ts intro why               # optional: transcribe lines back to check how they sound
npx playwright test -c docs/tools/demo video            # records docs/tools/demo/out/aaina-desktop-demo.mp4
```

Each scene waits until its line has been spoken, so the voice and the screens stay together. Frames come from Chromium's
screencast and are joined with ffmpeg, which must be installed. For the site, the video is scaled to 1600 × 1000
(`site/video`).
