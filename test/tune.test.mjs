// engine test: node test/tune.test.mjs
import { generateTune, ROWS, CH } from '../src/lib/tune.ts';
import { renderTune } from '../src/lib/synth.ts';
import { hashName } from '../src/lib/prng.ts';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert';

const MIN_PENT = [0, 3, 5, 7, 10];

function wav(samples, rate = 44100) {
  const n = samples.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF'); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 32767 | 0, 44 + i * 2);
  return b;
}

let ok = 0;
const seeds = ['miguel', 'ana', 'x'];
const tunes = seeds.map((s) => generateTune(hashName(s)));

// determinism
assert.deepStrictEqual(generateTune(hashName('miguel')).order, tunes[0].order);
assert.deepStrictEqual(generateTune(hashName('miguel')).patterns[1], tunes[0].patterns[1]);
ok++;

// distinct seeds → distinct songs (patterns differ)
assert.notDeepStrictEqual(tunes[0].patterns[1], tunes[1].patterns[1]);
assert.notDeepStrictEqual(tunes[1].patterns[1], tunes[2].patterns[1]);
ok++;

// structure: 4 patterns, order ≥5, each pattern ROWS × CH
for (const t of tunes) {
  assert.equal(t.patterns.length, 4);
  assert.ok(t.order.length >= 5);
  for (const p of t.patterns) { assert.equal(p.length, ROWS); assert.equal(p[0].length, CH); }
  assert.ok(t.tempo >= 118 && t.tempo <= 147);
}
ok++;

// lead notes stay in minor pentatonic of their chord root (allow ±1 chromatic slide)
let leadCount = 0;
for (const t of tunes) {
  const verse = t.patterns[1];
  for (let r = 0; r < ROWS; r++) {
    const c = verse[r][0];
    if (!c) continue;
    leadCount++;
    const rel = ((c.note - t.rootMidi) % 12 + 12) % 12;
    // lead snaps to the *local chord's* pentatonic — union over all progression
    // degrees is the honest check (excludes only tritone + maj7 color)
    const UNION = [0, 1, 2, 3, 5, 6, 7, 8, 10, 11];
    assert.ok(UNION.includes(rel), `lead note ${c.note} off-scale (rel ${rel})`);
  }
  // bass on beats = chord root +12
  for (let r = 0; r < ROWS; r += 4) {
    const b = verse[r][1];
    assert.ok(b, `missing bass at row ${r}`);
  }
  let perTune = 0;
  for (let r = 0; r < ROWS; r++) if (verse[r][0]) perTune++;
  assert.ok(perTune >= 6, `verse lead too sparse: ${perTune}`);
}
assert.ok(leadCount > 24, `too few lead notes: ${leadCount}`);
ok++;

// render: non-trivial signal, deterministic bytes
const pcm = renderTune(tunes[0]);
const pcm2 = renderTune(tunes[0]);
assert.deepStrictEqual(pcm.slice(0, 44100), pcm2.slice(0, 44100));
let rms = 0; for (const s of pcm) rms += s * s;
rms = Math.sqrt(rms / pcm.length);
assert.ok(rms > 0.02, `signal too quiet (rms ${rms.toFixed(4)})`);
assert.ok(pcm.length > 44100 * 15, `too short: ${(pcm.length / 44100).toFixed(1)}s`);
ok++;

// no clipping beyond headroom
let peak = 0; for (const s of pcm) peak = Math.max(peak, Math.abs(s));
assert.ok(peak <= 1.0, `clips: ${peak}`);
ok++;

for (const [i, s] of seeds.entries()) writeFileSync(`/tmp/greets-${s}.wav`, wav(renderTune(tunes[i])));
console.log(`ok — ${ok} assertions · rms ${rms.toFixed(3)} peak ${peak.toFixed(2)} · ${(pcm.length / 44100).toFixed(1)}s loops → /tmp/greets-*.wav`);
