// renders a Tune to raw samples — deterministic, runs in node or browser.
// square lead · triangle bass · arpeggio channel · noise drums
import type { Tune } from './tune.ts';
import { ROWS, CH } from './tune.ts';

const midi2f = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function square(phase: number) { return phase % 1 < 0.5 ? 1 : -1; }
function tri(phase: number) { const p = phase % 1; return p < 0.5 ? 4 * p - 1 : 3 - 4 * p; }

// precomputed noise table (seeded, looped per drum hit)
const NOISE = new Float32Array(4096);
{ let s = 12345; for (let i = 0; i < NOISE.length; i++) { s = (s * 16807) % 2147483647; NOISE[i] = (s / 2147483647) * 2 - 1; } }

const CH_GAIN = [0.34, 0.62, 0.26, 0.6];

export function renderTune(tune: Tune, sampleRate = 44100): Float32Array {
  const rowDur = 60 / tune.tempo / 4; // row = 16th note
  const totalRows = tune.order.length * ROWS;
  const out = new Float32Array(Math.ceil(totalRows * rowDur * sampleRate));

  // per-channel state for note continuation (drums are one-shot, tonal chans retrigger each cell)
  const active: { inst: number; f0: number; f1: number; t: number; vol: number; fx: number; dur: number }[] =
    Array(CH).fill(null!);
  const rowSmp = Math.round(rowDur * sampleRate);

  for (let pi = 0; pi < tune.order.length; pi++) {
    const pat = tune.patterns[tune.order[pi]];
    for (let r = 0; r < ROWS; r++) {
      const rowStart = (pi * ROWS + r) * rowSmp;
      // trigger cells
      for (let c = 0; c < CH; c++) {
        const cell = pat[r][c];
        if (!cell) continue;
        const dur = cell.inst >= 3 ? (cell.inst === 5 ? 0.04 : cell.inst === 4 ? 0.15 : 0.12) : rowDur * (cell.inst === 1 ? 1.6 : 2.4);
        active[c] = { inst: cell.inst, f0: midi2f(cell.note), f1: midi2f(cell.note), t: rowStart / sampleRate, vol: cell.vol / 64, fx: cell.fx, dur };
      }
      // synthesize this row
      for (let s = 0; s < rowSmp && rowStart + s < out.length; s++) {
        const t = (rowStart + s) / sampleRate;
        let mix = 0;
        for (let c = 0; c < CH; c++) {
          const a = active[c];
          if (!a) continue;
          const lt = t - a.t;
          if (lt < 0 || lt > a.dur + 0.05) continue;
          let v = 0;
          if (a.inst === 0) { // lead square + optional vibrato
            const vib = a.fx === 1 ? Math.sin(2 * Math.PI * 5.5 * lt) * 0.0035 : 0;
            const env = Math.min(1, lt / 0.008) * (1 - Math.exp(-lt * 60)) * Math.exp(-Math.max(0, lt - a.dur) * 25);
            v = square(a.f0 * (1 + vib) * lt) * 0.9 * env;
          } else if (a.inst === 1) { // bass triangle
            const env = Math.min(1, lt / 0.005) * Math.exp(-Math.max(0, lt - a.dur) * 30);
            v = tri(a.f0 * lt) * env;
          } else if (a.inst === 2) { // arp: cycle root/third/fifth at 3 ticks per row
            const third = a.fx >= 200 ? a.fx - 200 : 4;
            const seq = [0, third, 7];
            const semi = seq[Math.floor((lt / rowDur) * 3) % 3];
            v = square(a.f0 * Math.pow(2, semi / 12) * lt) * (lt > a.dur ? Math.exp(-(lt - a.dur) * 40) : 1);
          } else if (a.inst === 3) { // kick
            const f = 48 + (160 - 48) * Math.exp(-lt * 30);
            v = Math.sin(2 * Math.PI * f * lt) * Math.exp(-lt * 18) + (lt < 0.005 ? 0.6 : 0);
          } else if (a.inst === 4) { // snare
            const n = NOISE[Math.floor(lt * sampleRate) % NOISE.length];
            v = n * Math.exp(-lt * 22) * 0.8 + Math.sin(2 * Math.PI * 190 * lt) * Math.exp(-lt * 35) * 0.4;
          } else { // hat
            const n = NOISE[Math.floor(lt * sampleRate * 1.7) % NOISE.length];
            v = n * Math.exp(-lt * 90) * 0.5;
          }
          mix += v * a.vol * CH_GAIN[c];
        }
        // soft clip — tanh is the crunch, but it asymptotes at 0 dBFS,
        // which reads as clipping on a hot mix; keep the ceiling clean
        out[rowStart + s] += Math.tanh(mix * 1.4) * 0.82;
      }
    }
  }
  return out;
}
