import { useEffect, useRef, useState } from 'react';
import { Demo, RAMPS } from './lib/demo.ts';
import type { RampName } from './lib/demo.ts';
import { loadPixelFont } from './lib/font.ts';
import { hashName, mulberry32, pick } from './lib/prng.ts';
import { makeScrolltext, makeGreetz } from './lib/scrolltext.ts';
import { generateTune } from './lib/tune.ts';
import { bootAudio } from './lib/audio.ts';
import type { Deck } from './lib/audio.ts';

function pathName(): string | null {
  const raw = decodeURIComponent(location.pathname.replace(/^\/+/, '')).trim();
  const s = raw.replace(/[^\p{L}\p{N} '\-_.]/gu, '').slice(0, 14).trim();
  return s || null;
}

type Phase = 'landing' | 'toboot' | 'preboot' | 'poweron' | 'running';
const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// the seeded copper ramp, also worn by the void bars outside the tube
function rampFor(name: string): RampName {
  return pick(mulberry32(hashName(name) ^ 0xface), Object.keys(RAMPS)) as RampName;
}
// hard copper stripes, matching the raster's copperBar bands (dark -> hot -> dark)
function vbarGradient(ramp: RampName): string {
  const r = RAMPS[ramp];
  const sym = [r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[6], r[5], r[4], r[3], r[2]];
  const stops = sym.map((c, i) => `${c} ${(i * 100 / 12).toFixed(1)}% ${((i + 1) * 100 / 12).toFixed(1)}%`);
  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}


export default function App() {
  const [name, setName] = useState<string | null>(pathName);
  const [phase, setPhase] = useState<Phase>(name ? 'preboot' : 'landing');
  const [draft, setDraft] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const deckRef = useRef<Deck | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // the demo engine lives outside react; draft flows in via ref
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const powerRef = useRef({ started: 0, done: 0 });

  useEffect(() => {
    let stop = false;
    let raf = 0;
    (async () => {
      const font = await loadPixelFont();
      if (stop || !canvasRef.current) return;
      const demoName = name ?? 'STRANGER';
      const seed = hashName(demoName);
      const rng = mulberry32(seed ^ 0xface);
      const ramp = pick(rng, Object.keys(RAMPS)) as RampName;
      const demo = new Demo(canvasRef.current, { font, name: demoName, seed, ramp, scrolltext: makeScrolltext(demoName) });
      const greetz = makeGreetz(demoName);
      const tune = generateTune(seed);
      const t0 = performance.now();
      const frame = (now: number) => {
        if (stop) return;
        const t = (now - t0) / 1000;
        const ph = phaseRef.current;
        if (REDUCED && ph === 'running') { demo.renderReduced(); return; }
        if (ph === 'landing') demo.renderBios(t, draftRef.current);
        else if (ph === 'toboot') {
          const u = (now - powerRef.current.started) / 350;
          demo.renderPreboot(t, navigator.maxTouchPoints > 0);
          demo.wipe(u);
          if (u >= 1) setPhase('preboot');
        }
        else if (ph === 'preboot') demo.renderPreboot(t, navigator.maxTouchPoints > 0);
        else if (ph === 'poweron') {
          const u = (now - powerRef.current.started) / 600;
          if (u >= 1) { powerRef.current.done = now; setPhase('running'); }
          else demo.renderPowerOn(u);
        }
        else {
          const sinceBoot = (now - powerRef.current.done) / 1000;
          const lt = t - Math.floor(t / 9) * 9;
          if (sinceBoot < 1.4) demo.renderIntro(sinceBoot, lt);
          else demo.renderLoop(t, greetz);
        }
        if (!(REDUCED && ph === 'running')) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      // prebuild audio so the gesture plays instantly
      deckRef.current = bootAudio(tune);
    })();
    return () => { stop = true; cancelAnimationFrame(raf); deckRef.current?.stop(); deckRef.current?.ctx.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  useEffect(() => {
    const boot = () => {
      if (phaseRef.current === 'preboot') {
        powerRef.current.started = performance.now();
        setPhase('poweron');
        if (!REDUCED) navigator.vibrate?.(18);
        const d = deckRef.current;
        if (d) { void d.ctx.resume(); d.play(); }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (phaseRef.current === 'preboot') { e.preventDefault(); boot(); }
    };
    addEventListener('keydown', onKey);
    addEventListener('pointerdown', boot);
    return () => { removeEventListener('keydown', onKey); removeEventListener('pointerdown', boot); };
  }, []);

  useEffect(() => {
    const ramp = rampFor(name ?? 'STRANGER');
    document.documentElement.style.setProperty('--vbar', vbarGradient(ramp));
    document.documentElement.style.setProperty('--vbar-glow', RAMPS[ramp][4] + '55');
  }, [name]);

  const submit = () => {
    const s = draft.trim();
    if (!s) return;
    history.pushState(null, '', '/' + encodeURIComponent(s.toLowerCase()));
    setName(s);
    powerRef.current.started = performance.now();
    setPhase('toboot');
  };

  return (
    <div className="app">
      <div className="room" />
      <div className="vbar top" />
      <div className="vbar bottom" />
      <div className="tube">
        <canvas ref={canvasRef} className="demoscreen" aria-label={`cracktro greeting ${name ?? ''}`} />
        <div className="crt" aria-hidden>
          <div className="crt-lines" />
          <div className="crt-glow" />
          {!REDUCED && <div className="crt-flicker" />}
        </div>
        {phase === 'landing' && (
          <input
            ref={inputRef}
            className="nameinput"
            aria-label="type a name"
            autoFocus
            value={draft}
            maxLength={14}
            onChange={(e) => setDraft(e.target.value.replace(/[^\p{L}\p{N} '\-_.]/gu, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); submit(); } }}
          />
        )}
      </div>
    </div>
  );
}
