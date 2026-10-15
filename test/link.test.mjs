// codec roundtrip — every field survives the hash
import assert from 'node:assert/strict';
import { encodeSpec, decodeSpec } from '../src/lib/link.ts';
import { defaultSpec, resolveSpec } from '../src/lib/spec.ts';
import { hashName } from '../src/lib/prng.ts';

const eq = (a, b) => assert.deepEqual(a, b);

// defaults encode to nothing — bare links stay short
eq(encodeSpec(defaultSpec('miguel')), '');
eq(decodeSpec('', 'miguel'), defaultSpec('miguel'));

// a fully-dressed spec round-trips
const full = {
  ...defaultSpec('ana'),
  ramp: 'fire', sections: ['copper', 'plasma'], font: 'silk', speed: 3,
  wave: 'wild', logo: 'bounce', tune: 'c',
  text: 'HAPPY BIRTHDAY ANA +++ YOU ARE ELITE',
  greetz: ['MUM', 'THE CREW', 'ANA'],
  credits: 'DJ PIXEL',
};
const enc = encodeSpec(full);
assert.ok(enc.startsWith('g2.'));
assert.ok(enc.length < 120, `encoded spec should stay short, got ${enc.length}: ${enc}`);
eq(decodeSpec('#' + enc, 'ana'), full);

// partial specs only carry their own fields
const partial = { ...defaultSpec('bo'), ramp: 'ice', tune: 'off' };
eq(decodeSpec('#' + encodeSpec(partial), 'bo'), partial);

// greetz with commas in the raw input still split clean
const g = { ...defaultSpec('x'), greetz: ['A', 'B C'] };
eq(decodeSpec('#' + encodeSpec(g), 'x').greetz, ['A', 'B C']);

// garbage decodes to defaults, never throws
eq(decodeSpec('#g2.!!!notbase64', 'x'), defaultSpec('x'));
eq(decodeSpec('#g1.abc', 'x'), defaultSpec('x'));
eq(decodeSpec('#g2.', 'x'), defaultSpec('x'));
eq(decodeSpec('nonsense', 'x'), defaultSpec('x'));

// overlong text is clamped, not fatal
const long = { ...defaultSpec('x'), text: 'Z'.repeat(900) };
eq(decodeSpec('#' + encodeSpec(long), 'x').text.length <= 240, true);

// multi-byte text + greetz + credits round-trip together — the one-byte
// length prefix must not corrupt the fields behind it
const utf8 = { ...defaultSpec('éä'), text: 'é'.repeat(200), greetz: ['MUM'], credits: 'DJ' };
const u = decodeSpec('#' + encodeSpec(utf8), 'éä');
assert.ok(u.text.length > 0 && u.text.length <= 200, `utf8 text ${u.text.length}`);
eq(u.greetz, ['MUM']);
eq(u.credits, 'DJ');

// the byte cap never cuts a greet in half — a joined list that overflows
// drops whole names instead, so the roll and the hash carry the same list
const big = { ...defaultSpec('x'), greetz: Array(8).fill('你'.repeat(16)) };
const bigDec = decodeSpec('#' + encodeSpec(big), 'x');
assert.ok(bigDec.greetz.every((n) => n === '你'.repeat(16)), `whole names only: ${JSON.stringify(bigDec.greetz)}`);
assert.ok(bigDec.greetz.length > 0 && bigDec.greetz.length < 8, 'overflow drops trailing names');
eq(encodeSpec(bigDec), encodeSpec(big)); // decode->encode is stable

// 'auto' sections keep the legacy draw: the demo's rng serves 150 starfield
// draws (3 calls each) before the shuffle — bare-name permalinks must not
// change order under v2
for (const [n, want] of [
  ['miguel', ['classic', 'plasma', 'blitter']],
  ['aptiva', ['blitter', 'classic', 'plasma']],
  ['zapdash', ['plasma', 'classic', 'blitter']],
]) {
  const r = resolveSpec(defaultSpec(n), hashName(n), 'blue', () => []);
  eq(r.sections, want, `${n} auto order`);
}

console.log('link codec: all tests pass');
