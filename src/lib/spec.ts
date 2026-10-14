// the spec — everything that defines a cracktro besides the name.
// 'auto' fields resolve from the name's seed, so a bare /<name> link
// keeps behaving exactly like it always did.
import { mulberry32, pick, shuffle } from './prng.ts';
import type { RampName } from './demo.ts';

export type SectionId = 'classic' | 'plasma' | 'blitter' | 'copper';
export type FontId = 'ps2p' | 'silk' | 'vt';
export type LogoMode = 'wave' | 'still' | 'bounce';
export type WaveId = 'off' | 'calm' | 'classic' | 'wild';
export type TuneId = 'auto' | 'a' | 'b' | 'c' | 'd' | 'off';
export type SpeedId = 0 | 1 | 2 | 3;

export const SECTION_ORDER: SectionId[] = ['classic', 'copper', 'plasma', 'blitter'];
export const FONT_ORDER: FontId[] = ['ps2p', 'silk', 'vt'];
export const LOGO_ORDER: LogoMode[] = ['wave', 'still', 'bounce'];
export const WAVE_ORDER: WaveId[] = ['off', 'calm', 'classic', 'wild'];
export const TUNE_ORDER: TuneId[] = ['auto', 'a', 'b', 'c', 'd', 'off'];
// scroll speed multipliers — 0.6 chill, 1.0 stock, 1.6 fast, 2.4 turbo
export const SPEEDS = [0.6, 1, 1.6, 2.4] as const;
// scroller wave: [amplitude px, spatial frequency, temporal frequency]
export const WAVES: Record<WaveId, [number, number, number]> = {
  off: [0, 0.055, 3.2],
  calm: [2.5, 0.04, 2.2],
  classic: [5, 0.055, 3.2],
  wild: [9, 0.09, 4.4],
};

export interface Spec {
  name: string;                    // from the path, never the hash
  ramp: RampName | 'auto';
  sections: SectionId[] | 'auto';  // explicit set keeps canonical order
  font: FontId | 'auto';
  speed: SpeedId | 'auto';
  wave: WaveId | 'auto';
  logo: LogoMode | 'auto';
  tune: TuneId;
  text: string;                    // '' = generated scrolltext
  greetz: string[];                // [] = generated crew list
  credits: string;                 // '' = 'GREETS DEV'
}

export interface Resolved {
  name: string;
  seed: number;
  ramp: RampName;
  sections: SectionId[];
  font: FontId;
  speed: number;
  wave: [number, number, number];
  logo: LogoMode;
  tune: TuneId;                    // resolved: 'a'..'d' | 'off'
  tuneSeed: number;
  text: string;
  greetz: string[];
  credits: string;
}

const DEFAULT_GREETZ = 'GREETS DEV';

export function defaultSpec(name: string): Spec {
  return {
    name, ramp: 'auto', sections: 'auto', font: 'auto', speed: 'auto',
    wave: 'auto', logo: 'auto', tune: 'auto', text: '', greetz: [], credits: '',
  };
}

// the tune dial re-seeds the tracker: A is the name's own song,
// B/C/D are alternates cut from the same seed
const TUNE_XOR = { a: 0, b: 0x51ab, c: 0xa5f3, d: 0xc39d } as const;

export function resolveSpec(s: Spec, seed: number, autoRamp: RampName, mkGreetz: (credits: string) => string[]): Resolved {
  const credits = s.credits.trim().toUpperCase() || DEFAULT_GREETZ;
  const tune = s.tune === 'auto' ? 'a' : s.tune;
  return {
    name: s.name,
    seed,
    ramp: s.ramp === 'auto' ? autoRamp : s.ramp,
    sections: s.sections === 'auto'
      ? shuffle(mulberry32(seed ^ 0x51de), ['classic', 'plasma', 'blitter'] as SectionId[])
      : SECTION_ORDER.filter((x) => (s.sections as SectionId[]).includes(x)),
    font: s.font === 'auto' ? 'ps2p' : s.font,
    speed: SPEEDS[s.speed === 'auto' ? 1 : s.speed],
    wave: WAVES[s.wave === 'auto' ? 'classic' : s.wave],
    logo: s.logo === 'auto' ? 'wave' : s.logo,
    tune,
    tuneSeed: tune === 'off' ? seed : seed ^ TUNE_XOR[tune],
    text: s.text,
    greetz: s.greetz.length ? s.greetz : mkGreetz(credits),
    credits,
  };
}

// randomise rolls every style dial but leaves the words alone — texts are
// personal, style is the toy
export function randomizeStyle(s: Spec, rng: () => number, ramps: RampName[]): Spec {
  const secs = SECTION_ORDER.filter(() => rng() < 0.8);
  return {
    ...s,
    ramp: pick(rng, ramps),
    sections: secs.length ? secs : ['classic'],
    font: pick(rng, FONT_ORDER),
    speed: pick(rng, [0, 1, 2, 3] as SpeedId[]),
    wave: pick(rng, WAVE_ORDER),
    logo: pick(rng, LOGO_ORDER),
    tune: s.tune === 'off' ? 'off' : pick(rng, ['a', 'b', 'c', 'd'] as TuneId[]),
  };
}

// named rigs — one press dresses the whole machine; everything still editable
export interface Preset { id: string; label: string; patch: Partial<Spec> }
export const PRESETS: Preset[] = [
  { id: '94', label: '1994', patch: { font: 'ps2p', logo: 'wave', wave: 'classic', speed: 1, sections: 'auto', ramp: 'auto' } },
  { id: 'rage', label: 'RAGE', patch: { ramp: 'alert', sections: ['blitter', 'copper'], font: 'ps2p', logo: 'bounce', wave: 'wild', speed: 3 } },
  { id: 'deep', label: 'DEEP', patch: { ramp: 'ice', sections: ['plasma'], font: 'vt', logo: 'still', wave: 'calm', speed: 0 } },
  { id: 'acid', label: 'ACID', patch: { ramp: 'jungle', sections: ['copper', 'classic'], font: 'silk', logo: 'bounce', wave: 'wild', speed: 2 } },
];

// sanitizers — the raster font covers a cracktro-era charset, anything else
// becomes a gap rather than a tofu box
const SAFE = /[^\p{L}\p{N} .,!'"\-+*/&?()·:=;<>]/gu;
export const cleanText = (s: string, max = 240) =>
  s.replace(SAFE, ' ').replace(/\s+/g, ' ').slice(0, max);
export const cleanGreet = (s: string) =>
  s.replace(SAFE, '').replace(/,/g, '').slice(0, 16);
export const cleanName = (s: string) =>
  s.replace(/[^\p{L}\p{N} '\-_.]/gu, '').slice(0, 14).trim();
