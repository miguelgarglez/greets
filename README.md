# greets

Type a name; get a cracktro that greets it — chiptune, plasma, scrolltext.

`greets.dev/<name>` mints a deterministic 90s demoscene intro for that name: a waving
raster logo, copper bars, a three-layer starfield, a sine-wave scrolltext, a plasma
section with the name carved out, a bouncing blitter pass, a greetz roll — and an
original procedural chiptune rendered by a four-channel tracker engine.

Everything is seeded from the name — same name, same default demo — and a
`#g2.` link carries the whole spec, so a shared URL reproduces its own
cracktro for that name, whatever you changed in the deck.

## The control deck

Press `E` (or the `EDIT` key top-right) while a demo runs and the **control deck**
docks under the tube — a rack bay of physical keys, not a form. One group at a
time; while you edit words or motion the tube pins itself to the scroller, the
greetz board, or the section chip you just touched, so the knob you turn is the
thing you see:

- **Rigs** — `1994`, `RAGE`, `DEEP` and `ACID` presets, a randomise switch,
  undo, and reset back to the seeded defaults.
- **Words** — rename the recipient, rewrite the scrolltext, hand-write the
  greetz roll, and sign the credits line.
- **Look** — eight copper ramps and three pixel fonts.
- **Motion** — the section lineup (classic / copper wall / plasma / blitter,
  plus the always-on greetz roll), logo treatment (wave / still / bounce),
  scroll speed and wave shape.
- **Tune** — which of four seeded tunes plays — or none.

Every setting rides in the URL as a compact base64 hash (`#g2.…`), so a copied
link reproduces the exact cracktro — texts, palette, font, tune and all.

## Make one yours

- **◉ GIF** — a 600×600 card: the demo on top, a printed label band with the
  name and credits below, looping seamless through `gifenc`, ready for chat.
- **▶ FILM** — a 1280×720 film that stays on the recipient's section from
  first frame to last, with the real tune unless the TUNE knob is off:
  WebCodecs + `mp4-muxer` where available, MediaRecorder fallback elsewhere.
- **⧉ LINK** — the shareable URL with all your settings in it.

Both exports are a fixed take of the opening section — the part that carries the
name — rendered through the same engine you see on screen.

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
  every deck setting and text into the URL hash; opening the link decodes the spec
  and waits at the boot key like any other visit.
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

- React + TypeScript + Vite. No backend. Runtime deps beyond React: `gifenc`
  and `mp4-muxer` for exports, `web-haptics` for the boot thud.
- Determinism: `hashName` (FNV-1a) → mulberry32 seeds every choice.
- No WebGL, no samples, no WebGPU — one canvas and one AudioBuffer.
- Fonts: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P),
  [Silkscreen](https://fonts.google.com/specimen/Silkscreen) and
  [VT323](https://fonts.google.com/specimen/VT323), all OFL 1.1, bundled.
