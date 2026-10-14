# greets

Type a name; get a cracktro that greets it — chiptune, plasma, scrolltext.

`greets.dev/<name>` mints a deterministic 90s demoscene intro for that name: a waving
raster logo, copper bars, a three-layer starfield, a sine-wave scrolltext, a plasma
section with the name carved out, a bouncing blitter pass, a greetz roll — and an
original procedural chiptune rendered by a four-channel tracker engine.

Everything is seeded from the name. Same name, same demo, forever.

## The control deck

Press `E` (or the `EDIT` key on touch) while a demo runs and the **control deck**
slides up — a rack of physical keys, not a form:

- **Words** — rename the recipient, rewrite the scrolltext, hand-write the
  greetz roll, and sign the credits line.
- **Style** — eight copper ramps, the section lineup (classic / copper wall /
  plasma / blitter, plus the always-on greetz roll), logo treatment
  (wave / still / bounce), three pixel fonts, scroll speed and wave shape,
  and which of four seeded tunes plays — or none.
- **Rigs** — `1994`, `RAGE`, `DEEP` and `ACID` presets, a randomise switch,
  and reset back to the seeded defaults.

Every setting rides in the URL as a compact base64 hash (`#g2.…`), so a copied
link reproduces the exact cracktro — texts, palette, font, tune and all.

## Make one yours

- **◉ GIF** — a seamless 600×600 boomerang loop rendered offline through
  `gifenc`, ready for chat.
- **▶ FILM** — a 9-second 1280×720 film with the real tune: WebCodecs +
  `mp4-muxer` where available, MediaRecorder fallback elsewhere.
- **⧉ LINK** — the shareable URL with all your settings in it.

Exports render through the same engine you see on screen, so what you
hear and see is what ships.

## How it works

- **The tune** (`src/lib/tune.ts`) — a seeded PRNG picks a scale, a classic tracker
  chord progression, tempo and pattern table, then writes a four-channel song:
  square lead, triangle bass, pulse arpeggio, noise drums. Cells carry tracker
  effects (vibrato, arpeggio, slide).
- **The synth** (`src/lib/synth.ts`) — renders the tune to raw PCM with per-channel
  instruments and effect resolution. Deterministic in Node or the browser; the
  tests write real WAVs to `/tmp`.
- **The demo** (`src/lib/demo.ts`) — one 320×200 raster canvas on a 50Hz clock.
  Copper bars, starfield, per-column wave logo with afterimage, plasma via ImageData,
  DVD-style blitter, and a greetz roll. Sections are seeded and looped.
- **The fonts** (`src/lib/font.ts`) — Press Start 2P, Silkscreen Bold and VT323
  (all OFL), rasterized to tight bitmaps at boot and re-baked into gradient
  logo strips.
- **The state** (`src/lib/spec.ts`, `src/lib/link.ts`) — a tiny binary codec packs
  every deck setting and text into the URL hash; opening the link decodes it
  straight into the running demo.
- **The exporter** (`src/lib/export.ts`) — offline frame renderer feeding
  `gifenc` for the square loop, and WebCodecs/`mp4-muxer` (or MediaRecorder)
  for the widescreen film with audio.
- **The boot** — browsers block autoplay audio, so the tube waits:
  `PRESS ANY KEY TO BOOT` → CRT power-on flash → the demo runs and the tune plays.
  `prefers-reduced-motion` renders a single still frame instead.

## Run it

```sh
npm install
npm run dev     # http://localhost:5173/miguel
node test/tune.test.mjs   # engine tests + /tmp/greets-*.wav
npm run build
```

## Tech notes

- React + TypeScript + Vite. No backend; the only runtime deps are `gifenc`
  and `mp4-muxer` for exports.
- Determinism: `hashName` (FNV-1a) → mulberry32 seeds every choice.
- No WebGL, no samples, no WebGPU — one canvas and one AudioBuffer.
- Fonts: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P),
  [Silkscreen](https://fonts.google.com/specimen/Silkscreen) and
  [VT323](https://fonts.google.com/specimen/VT323), all OFL 1.1, bundled.
