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

type Phase = 'landing' | 'preboot' | 'poweron' | 'running';
const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// the seeded copper ramp, also worn by the void bars outside the tube
function rampFor(name: string): RampName {
  return pick(mulberry32(hashName(name) ^ 0xface), Object.keys(RAMPS)) as RampName;
}
function vbarGradient(ramp: RampName): string {
  const r = RAMPS[ramp];
  return `linear-gradient(to bottom, ${r[0]}, ${r[2]}, ${r[4]}, ${r[r.length - 2]}, ${r[4]}, ${r[2]}, ${r[0]})`;
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
  const powerRef = useRef({ started: 0 });

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
        if (REDUCED && ph === 'running') { demo.renderClassic(2); return; }
        if (ph === 'landing') demo.renderBios(t, draftRef.current);
        else if (ph === 'preboot') demo.renderPreboot(t);
        else if (ph === 'poweron') {
          const u = (now - powerRef.current.started) / 600;
          if (u >= 1) { setPhase('running'); }
          else demo.renderPowerOn(u);
        }
        else demo.renderLoop(t, greetz);
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
    document.documentElement.style.setProperty('--vbar', vbarGradient(rampFor(name ?? 'STRANGER')));
  }, [name]);

  const submit = () => {
    const s = draft.trim();
    if (!s) return;
    history.pushState(null, '', '/' + encodeURIComponent(s.toLowerCase()));
    setName(s);
    setPhase('preboot');
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
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
        )}
      </div>
      <div className="chrome">
        <span className="mark">GREETS</span>
        <span className="hint">
          {phase === 'landing' ? 'a cracktro for any name'
            : `greets.dev/${(name ?? '').toLowerCase()}`}
        </span>
      </div>
    </div>
  );
}
