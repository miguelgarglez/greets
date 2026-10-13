// procedural chiptune — a seeded 4-channel tracker song in the ProTracker idiom.
// channels: 0 lead (square) · 1 bass (triangle) · 2 arp (pulse) · 3 drums (noise)
import { mulberry32, pick } from './prng.ts';

export interface Cell { note: number; inst: number; vol: number; fx: number }
// fx bits: 1=vibrato, 2=arpeggio (cycle 0/4/7 or 0/3/7), 3=slide
export type Pattern = (Cell | null)[][];
export interface Tune {
  tempo: number;          // BPM
  patterns: Pattern[];    // each ROWS rows × 4 channels
  order: number[];        // pattern playback order, loops
  rootMidi: number;
  seed: number;
}

export const ROWS = 32;
export const CH = 4;

const MIN_PENT = [0, 3, 5, 7, 10];
// classic tracker progressions as scale degrees of natural minor (semitones from root, quality)
const PROGS: { deg: number; maj: boolean }[][] = [
  [{ deg: 0, maj: false }, { deg: 8, maj: true }, { deg: 3, maj: true }, { deg: 10, maj: true }], // i VI III VII
  [{ deg: 0, maj: false }, { deg: 10, maj: true }, { deg: 8, maj: true }, { deg: 10, maj: true }], // i VII VI VII
  [{ deg: 0, maj: false }, { deg: 5, maj: false }, { deg: 8, maj: true }, { deg: 10, maj: false }], // i iv VI v
  [{ deg: 0, maj: false }, { deg: 3, maj: true }, { deg: 10, maj: true }, { deg: 8, maj: true }],  // i III VII VI
];
const ROOTS = [45, 43, 48, 50, 41, 47]; // A2 G2 C3 D3 F2 B2
// tracker-y lead rhythms (16th-row masks inside an 8-row bar-half)
const LEAD_RHYTHMS = [
  [0, 2, 4, 7, 8, 10, 12, 14],
  [0, 3, 6, 8, 11, 14],
  [0, 4, 6, 8, 10, 12, 14],
  [0, 2, 4, 6, 9, 12],
  [0, 4, 7, 8, 12, 15],
];

function cell(note: number, inst: number, vol: number, fx = 0): Cell {
  return { note, inst, vol, fx };
}

// one 32-row pattern over a 4-chord loop (8 rows per chord)
function makePattern(rng: () => number, root: number, prog: { deg: number; maj: boolean }[], opts: {
  density: number; octave: number; arpBusy: number; sparse: boolean;
}): Pattern {
  const pat: Pattern = Array.from({ length: ROWS }, () => Array<Cell | null>(CH).fill(null));
  const rhythm = pick(rng, LEAD_RHYTHMS);
  let leadNote = root + 24 + pick(rng, MIN_PENT);
  for (let r = 0; r < ROWS; r++) {
    const chord = prog[Math.floor(r / 8) % prog.length];
    const chordRoot = root + chord.deg;
    // drums: kick 4-on-floor, snare backbeat, hats
    if (r % 8 === 0 || r % 8 === 4) pat[r][3] = cell(60, 3, r % 16 === 0 ? 64 : 52); // kick (inst 3)
    if (r % 16 === 8) pat[r][3] = cell(64, 4, 56); // snare (inst 4)
    if (r % 2 === 0 && rng() < 0.75) pat[r][3] = pat[r][3] ?? cell(72, 5, r % 4 === 0 ? 34 : 22); // hat
    // bass: chord root on beat, octave bounce
    if (r % 4 === 0) pat[r][1] = cell(chordRoot + 12, 1, 60);
    else if (r % 4 === 2 && rng() < 0.5) pat[r][1] = cell(chordRoot + (rng() < 0.5 ? 24 : 12), 1, 44);
    // arp channel: chord tones cycling
    if (r % 2 === (opts.arpBusy > 0.5 ? 0 : 1) && rng() < opts.arpBusy) {
      const third = chord.maj ? 4 : 3;
      pat[r][2] = cell(chordRoot + 12 + pick(rng, [0, third, 7, 12]), 2, 36, 2);
    }
    // lead: seeded rhythm mask, pentatonic random walk with chord-tone bias
    if (!opts.sparse && rhythm.includes(r % 16) && rng() < opts.density) {
      const move = pick(rng, [-3, -2, -1, 0, 1, 2, 3, 7]);
      let n = leadNote + move;
      // bias toward chord root + pentatonic
      const scale = [...MIN_PENT.map((s) => chordRoot + s + 24), ...MIN_PENT.map((s) => chordRoot + s + 36)];
      n = scale.reduce((b, c) => (Math.abs(c - n) < Math.abs(b - n) ? c : b), scale[0]);
      n = Math.max(root + 17, Math.min(root + 43, n));
      leadNote = n;
      pat[r][0] = cell(n, 0, 58, rng() < 0.3 ? 1 : 0);
    }
  }
  return pat;
}

export function generateTune(seed: number): Tune {
  const rng = mulberry32(seed);
  const rootMidi = pick(rng, ROOTS);
  const prog = pick(rng, PROGS);
  const tempo = 118 + Math.floor(rng() * 30); // 118–147
  const density = 0.62 + rng() * 0.3;
  const arpBusy = 0.45 + rng() * 0.45;

  const intro = makePattern(mulberry32(seed ^ 0xa1), rootMidi, prog,
    { density: 0.28, octave: 0, arpBusy: 0.3, sparse: true });
  const verse = makePattern(mulberry32(seed ^ 0xb2), rootMidi, prog,
    { density, octave: 0, arpBusy, sparse: false });
  const chorus = makePattern(mulberry32(seed ^ 0xc3), rootMidi, prog,
    { density: Math.min(1, density + 0.15), octave: 1, arpBusy: Math.min(1, arpBusy + 0.2), sparse: false });
  const brk = makePattern(mulberry32(seed ^ 0xd4), rootMidi, prog,
    { density: 0.3, octave: 0, arpBusy: 0.2, sparse: true });

  return { tempo, patterns: [intro, verse, chorus, brk], order: [0, 1, 1, 2, 1, 3, 2], rootMidi, seed };
}
