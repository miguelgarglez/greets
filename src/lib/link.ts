// link codec — the whole spec packs into the hash: /<name>#g2.<base64url>
// a default cracktro needs no hash at all, so casual links stay short.
// byte0 = version, bytes 1-2 = presence bitmap, then 3 bytes of packed
// enums, then each present string as [u8 len][utf8].
import { RAMPS } from './demo.ts';
import type { RampName } from './demo.ts';
import { SECTION_ORDER, FONT_ORDER, LOGO_ORDER, WAVE_ORDER, TUNE_ORDER, defaultSpec, cleanText, cleanGreetzList } from './spec.ts';
import type { Spec } from './spec.ts';

const RAMP_ORDER = Object.keys(RAMPS) as RampName[];
const VERSION = 2;

// bit positions in the presence bitmap
const B = { ramp: 1, sections: 2, font: 4, speed: 8, wave: 16, logo: 32, tune: 64, text: 128, greetz: 256, credits: 512 };

const b64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export function encodeSpec(s: Spec): string {
  let bits = 0;
  if (s.ramp !== 'auto') bits |= B.ramp;
  if (s.sections !== 'auto') bits |= B.sections;
  if (s.font !== 'auto') bits |= B.font;
  if (s.speed !== 'auto') bits |= B.speed;
  if (s.wave !== 'auto') bits |= B.wave;
  if (s.logo !== 'auto') bits |= B.logo;
  if (s.tune !== 'auto') bits |= B.tune;
  const enc = new TextEncoder();
  const texts = [cleanText(s.text), cleanGreetzList(s.greetz).join(','), cleanText(s.credits, 24)];
  if (texts[0]) bits |= B.text;
  if (texts[1]) bits |= B.greetz;
  if (texts[2]) bits |= B.credits;
  if (!bits) return '';

  const out: number[] = [VERSION, bits & 0xff, bits >> 8];
  if (bits & 0x7f) {
    // 18 bits of enums, LSB first
    let v = 0, n = 0;
    const put = (x: number, w: number) => { v |= (x & ((1 << w) - 1)) << n; n += w; };
    put(s.ramp === 'auto' ? 0 : RAMP_ORDER.indexOf(s.ramp) + 1, 4);
    put(s.sections === 'auto' ? 0 : SECTION_ORDER.reduce((m, x, i) => m | (s.sections.includes(x) ? 1 << i : 0), 0) + 1, 4 + 1);
    put(s.font === 'auto' ? 0 : FONT_ORDER.indexOf(s.font) + 1, 2);
    put(s.speed === 'auto' ? 0 : s.speed + 1, 3);
    put(s.wave === 'auto' ? 0 : WAVE_ORDER.indexOf(s.wave) + 1, 3);
    put(s.logo === 'auto' ? 0 : LOGO_ORDER.indexOf(s.logo) + 1, 2);
    put(s.tune === 'auto' ? 0 : TUNE_ORDER.indexOf(s.tune) + 1, 3);
    out.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff);
  }
  for (let i = 0; i < 3; i++) {
    if (!(bits & (B.text << i))) continue;
    const b = enc.encode(texts[i]);
    out.push(b.length);
    for (const x of b) out.push(x);
  }
  return `g2.${b64(new Uint8Array(out))}`;
}

export function decodeSpec(hash: string, name: string): Spec {
  const s = defaultSpec(name);
  const m = /^#?g2\.([A-Za-z0-9_-]+)$/.exec(hash);
  if (!m) return s;
  try {
    const b = unb64(m[1]);
    if (b.length < 3 || b[0] !== VERSION) return s;
    const bits = b[1] | (b[2] << 8);
    let p = 3;
    if (bits & 0x7f) {
      if (b.length < p + 4) return s;
      const v = b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24);
      p += 4;
      let n = 0;
      const take = (w: number) => { const x = (v >>> n) & ((1 << w) - 1); n += w; return x; };
      const ramp = take(4);
      if (bits & B.ramp && ramp > 0 && ramp <= RAMP_ORDER.length) s.ramp = RAMP_ORDER[ramp - 1];
      const smask = take(5);
      if (bits & B.sections && smask > 0) {
        const secs = SECTION_ORDER.filter((_, i) => (smask - 1) & (1 << i));
        if (secs.length) s.sections = secs;
      }
      const font = take(2);
      if (bits & B.font && font > 0 && font <= FONT_ORDER.length) s.font = FONT_ORDER[font - 1];
      const speed = take(3);
      if (bits & B.speed && speed > 0 && speed <= 4) s.speed = (speed - 1) as Spec['speed'];
      const wave = take(3);
      if (bits & B.wave && wave > 0 && wave <= WAVE_ORDER.length) s.wave = WAVE_ORDER[wave - 1];
      const logo = take(2);
      if (bits & B.logo && logo > 0 && logo <= LOGO_ORDER.length) s.logo = LOGO_ORDER[logo - 1];
      const tune = take(3);
      if (bits & B.tune && tune > 0 && tune <= TUNE_ORDER.length) s.tune = TUNE_ORDER[tune - 1];
    }
    const dec = new TextDecoder();
    const texts: string[] = [];
    for (let i = 0; i < 3; i++) {
      if (!(bits & (B.text << i))) continue;
      if (p >= b.length) return s;
      const len = b[p++];
      if (p + len > b.length) return s;
      texts[i] = dec.decode(b.slice(p, p + len));
      p += len;
    }
    if (bits & B.text && texts[0] !== undefined) s.text = cleanText(texts[0]);
    if (bits & B.greetz && texts[1] !== undefined) s.greetz = cleanGreetzList(texts[1].split(','));
    if (bits & B.credits && texts[2] !== undefined) s.credits = cleanText(texts[2], 24);
    return s;
  } catch {
    return s;
  }
}
