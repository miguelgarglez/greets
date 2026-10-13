// name-seeded scrolltext — the cracktro speaks
import { hashName, mulberry32, pick, shuffle } from './prng.ts';

const OPENERS = [
  'GREETS TO', 'YOYO', 'HELLO', 'RESPECT TO', 'ALL HAIL', 'CREDITS WHERE DUE —',
];
const BOASTS = [
  'THIS INTRO WAS CRUNCHED IN 0.0 SECONDS',
  'NO LLMS WERE HARMED IN THE MAKING OF THIS DEMO',
  'WRITTEN IN RAW TYPESCRIPT ON A DEADLINE',
  '100% PROCEDURAL - NO SAMPLES - NO SHAME',
  'IF YOU CAN READ THIS YOU ARE ELITE',
  'SINE TABLES BY NATURE - PLAGIARIZED BY US',
  'RUNS AT 50 FPS ON A TOASTER',
  'THIS DEMO IS PUBLIC DOMAIN - GO FORTH AND COPY',
  'YOUR NAME IS NOW A MELODY. DEAL WITH IT.',
  'GREETINGS FLY OUT TO EVERY SCROLLER EVER WRITTEN',
  'THE RAINBOW BARS NEVER LIE',
  'SHARE THIS LINK - SPREAD THE GREETS',
];
const CLOSERS = [
  'PRESS RESET TO PLAY AGAIN',
  'LAMMERS WILL BE FORMATTED',
  'SEE YOU AT THE NEXT PARTY',
  'EOF - TEXT RESTARTS',
  'WRAP IS NOT A BUG - IT IS TRADITION',
];
const CREW = ['FAIRLIGHT', 'RAZOR 1911', 'SCOOPEX', 'SANITY', 'RED SECTOR', 'QUARTET', 'PHENOMENA', 'TRISTAR', 'THE SILENTS', 'CRIONICS'];

export function makeScrolltext(name: string): string {
  const rng = mulberry32(hashName(name) ^ 0x5eed);
  const parts = [
    `${pick(rng, OPENERS)} ${name.toUpperCase()} ... `,
    pick(rng, BOASTS) + ' ... ',
    `GREETINGS ALSO FLY TO ${shuffle(rng, [...CREW]).slice(0, 4).join(' - ')} ... `,
    pick(rng, BOASTS) + ' ... ',
    pick(rng, CLOSERS) + '     ',
  ];
  return parts.join('').toUpperCase();
}

export function makeGreetz(name: string): string[] {
  const rng = mulberry32(hashName(name) ^ 0xbeef);
  const picks = shuffle(rng, [...CREW]).slice(0, 5);
  const list = [...picks.slice(0, 2), 'YOU', ...picks.slice(2), 'GREETS.DEV'];
  return list;
}
