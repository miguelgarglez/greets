import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Demo, RAMPS } from './lib/demo.ts';
import type { RampName } from './lib/demo.ts';
import { loadPixelFont } from './lib/font.ts';
import { hashName, mulberry32, pick } from './lib/prng.ts';
import { makeScrolltext, makeGreetz } from './lib/scrolltext.ts';
import { generateTune } from './lib/tune.ts';
import { bootAudio } from './lib/audio.ts';
import type { Deck } from './lib/audio.ts';
import { WebHaptics } from 'web-haptics';

function pathName(): string | null {
  const raw = decodeURIComponent(location.pathname.replace(/^\/+/, '')).trim();
  // a path that still holds a slash isn't a name — back to the landing
  if (raw.includes('/')) return null;
  const s = raw.replace(/[^\p{L}\p{N} '\-_.]/gu, '').slice(0, 14).trim();
  return s || null;
}
const BAD_PATH = decodeURIComponent(location.pathname.replace(/^\/+/, '')).includes('/');

type Phase = 'landing' | 'toboot' | 'preboot' | 'poweron' | 'running';
const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

export default function App() {
  const [name, setName] = useState<string | null>(pathName);
  const [phase, setPhase] = useState<Phase>(name ? 'preboot' : 'landing');
  const [draft, setDraft] = useState('');
  const [rockerDown, setRockerDown] = useState(false);
  const demoName = name ?? 'STRANGER';
  const seed = hashName(demoName);
  const ramp = pick(mulberry32(seed ^ 0xface), Object.keys(RAMPS)) as RampName;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const deckRef = useRef<Deck | null>(null);
  const hapticsRef = useRef<WebHaptics | null>(null);
  const mutedRef = useRef(false);
  try { mutedRef.current = localStorage.getItem('greets-muted') === '1'; } catch { /* private mode */ }
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // the demo engine lives outside react; draft flows in via ref
  const draftRef = useRef(draft);
  draftRef.current = draft;
  // the boot thud — web-haptics covers iOS via audio ticks; muted kills it too
  const thud = () => {
    if (REDUCED || mutedRef.current) return;
    hapticsRef.current ??= new WebHaptics();
    void hapticsRef.current.trigger(18);
  };
  const powerRef = useRef({ started: 0, done: 0, fromLanding: false, pressAt: 0 });

  useEffect(() => {
    let stop = false;
    let raf = 0;
    (async () => {
      const font = await loadPixelFont();
      if (stop || !canvasRef.current) return;
      const demo = new Demo(canvasRef.current, { font, name: demoName, seed, ramp, scrolltext: makeScrolltext(demoName, TOUCH) });
      const greetz = makeGreetz(demoName);
      const tune = generateTune(seed);
      const t0 = performance.now();
      const frame = (now: number) => {
        if (stop) return;
        const t = (now - t0) / 1000;
        const ph = phaseRef.current;
        if (REDUCED && ph === 'running') { demo.muted = mutedRef.current; demo.renderReduced(); return; }
        if (ph === 'landing') demo.renderBios(t, draftRef.current, BAD_PATH);
        else if (ph === 'toboot') {
          const u = (now - powerRef.current.started) / 350;
          // the typed name stays on the glass until the slit covers it — the
          // wipe opens straight onto the beam, no second prompt
          demo.renderBios(t, draftRef.current);
          demo.wipe(u);
          if (u >= 1) {
            powerRef.current.started = now;
            powerRef.current.fromLanding = true;
            thud();
            const d = deckRef.current;
            if (d) { void d.ctx.resume(); d.play(); }
            setPhase('poweron');
          }
        }
        else if (ph === 'preboot') demo.renderPreboot(t, TOUCH, now - powerRef.current.pressAt < 260);
        else if (ph === 'poweron') {
          const u = (now - powerRef.current.started) / 600;
          if (u >= 1) { powerRef.current.done = now; setPhase('running'); }
          else demo.renderPowerOn(u, powerRef.current.fromLanding ? draftRef.current : null, t);
        }
        else {
          const sinceBoot = (now - powerRef.current.done) / 1000;
          const lt = t - Math.floor(t / 9) * 9;
          if (sinceBoot < 1.4) demo.renderIntro(sinceBoot, lt, powerRef.current.fromLanding ? draftRef.current : null);
          else { demo.muted = mutedRef.current; demo.renderLoop(t, greetz); }
        }
        if (!(REDUCED && ph === 'running')) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      // prebuild audio so the gesture plays instantly
      deckRef.current = bootAudio(tune);
      deckRef.current.gain.gain.value = mutedRef.current ? 0 : 0.8;
    })();
    return () => { stop = true; cancelAnimationFrame(raf); deckRef.current?.stop(); deckRef.current?.ctx.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  useEffect(() => {
    const boot = () => {
      if (phaseRef.current === 'preboot') {
        powerRef.current.started = performance.now();
        powerRef.current.fromLanding = false;
        setPhase('poweron');
        thud();
        const d = deckRef.current;
        if (d) { void d.ctx.resume(); d.play(); }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (phaseRef.current === 'preboot') { e.preventDefault(); boot(); }
      else if ((e.key === 'm' || e.key === 'M') && phaseRef.current === 'running') {
        const d = deckRef.current;
        if (d) {
          mutedRef.current = !mutedRef.current;
          d.gain.gain.value = mutedRef.current ? 0 : 0.8;
          try { localStorage.setItem('greets-muted', mutedRef.current ? '1' : '0'); } catch { /* private mode */ }
        }
      }
    };
    const onTap = () => {
      if (phaseRef.current === 'preboot') {
        // the power key shows the press for a beat before the beam fires
        powerRef.current.pressAt = performance.now();
        setTimeout(boot, 240);
      } else if (phaseRef.current === 'running') {
        const d = deckRef.current;
        if (d) {
          mutedRef.current = !mutedRef.current;
          d.gain.gain.value = mutedRef.current ? 0 : 0.8;
          try { localStorage.setItem('greets-muted', mutedRef.current ? '1' : '0'); } catch { /* private mode */ }
        }
      }
    };
    addEventListener('keydown', onKey);
    addEventListener('pointerdown', onTap);
    return () => { removeEventListener('keydown', onKey); removeEventListener('pointerdown', onTap); };
  }, []);

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
      {TOUCH && phase === 'preboot' && (
        <button
          className={'rocker' + (rockerDown ? ' down' : '')}
          style={{ '--hot': RAMPS[ramp][6] } as CSSProperties}
          aria-label="power on"
          onPointerDown={() => { setRockerDown(true); setTimeout(() => setRockerDown(false), 400); }}
        />
      )}
    </div>
  );
}
