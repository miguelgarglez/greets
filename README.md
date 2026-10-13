# greets

Type a name; get a cracktro that greets it — chiptune, plasma, scrolltext.

`greets.dev/<name>` mints a deterministic 90s demoscene intro for that name: a waving
raster logo, copper bars, a three-layer starfield, a sine-wave scrolltext, a plasma
section with the name carved out, a bouncing blitter pass, a greetz roll — and an
original procedural chiptune rendered by a four-channel tracker engine.

Everything is seeded from the name. Same name, same demo, forever.

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
- **The font** — Press Start 2P (OFL), rasterized to tight bitmaps at boot and
  re-baked into gradient logo strips.
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

- React + TypeScript + Vite. No backend, no assets besides the font.
- Determinism: `hashName` (FNV-1a) → mulberry32 seeds every choice.
- No WebGL, no samples, no WebGPU — one canvas and one AudioBuffer.
- Font: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P), OFL 1.1.
