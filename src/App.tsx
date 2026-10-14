import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Demo, RAMPS } from './lib/demo.ts';
import type { DemoAssets, RampName } from './lib/demo.ts';
import { loadPixelFont } from './lib/font.ts';
import type { FontId } from './lib/spec.ts';
import type { PixelFont } from './lib/font.ts';
import { hashName, mulberry32, pick } from './lib/prng.ts';
import { makeScrolltext, makeGreetz } from './lib/scrolltext.ts';
import { defaultSpec, resolveSpec, randomizeStyle, cleanText } from './lib/spec.ts';
import type { Spec, Resolved } from './lib/spec.ts';
import { encodeSpec, decodeSpec } from './lib/link.ts';
import { generateTune } from './lib/tune.ts';
import { bootAudio } from './lib/audio.ts';
import type { Deck } from './lib/audio.ts';
import { exportGif, exportVideo } from './lib/export.ts';
import ControlDeck from './Deck.tsx';
import type { ExportUi, Preview } from './Deck.tsx';
import { WebHaptics } from 'web-haptics';

function pathName(): string | null {
  const raw = decodeURIComponent(location.pathname.replace(/^\/+/, '')).trim();
  // a path that still holds a slash isn't a name — back to the landing
  if (raw.includes('/')) return null;
  const s = raw.replace(/[^\p{L}\p{N} '\-_.]/gu, '').slice(0, 14).trim();
  return s || null;
}
const badPathNow = () => decodeURIComponent(location.pathname.replace(/^\/+/, '')).includes('/');

type Phase = 'landing' | 'toboot' | 'preboot' | 'poweron' | 'running';
// undo is a rig key: it snapshots only the style dials, never the words
const STYLE_KEYS = ['ramp', 'sections', 'font', 'speed', 'wave', 'logo', 'tune'] as const;
const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

export default function App() {
  const [name, setName] = useState<string | null>(pathName);
  const [spec, setSpec] = useState<Spec>(() => decodeSpec(location.hash, pathName() ?? ''));
  const [phase, setPhase] = useState<Phase>(name ? 'preboot' : 'landing');
  const [deckOpen, setDeckOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [rockerDown, setRockerDown] = useState(false);
  const [exp, setExp] = useState<ExportUi>({ busy: false, kind: null, frac: 0, label: '', result: null, error: null });
  const [linkNote, setLinkNote] = useState('COPIES THE LINK WITH ALL YOUR SETTINGS');
  const [linkState, setLinkState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [canUndo, setCanUndo] = useState(false);
  const demoName = name ?? 'STRANGER';
  const seed = hashName(demoName);
  const autoRamp = pick(mulberry32(seed ^ 0xface), Object.keys(RAMPS)) as RampName;
  const resolved = useMemo<Resolved>(() => resolveSpec(
    { ...spec, name: demoName }, seed, autoRamp,
    (cr) => makeGreetz(demoName, cr),
  ), [spec, demoName, seed]);
  const scrolltext = useMemo(() => {
    const t = cleanText(spec.text).toUpperCase();
    return t ? t + '  +++  ' : makeScrolltext(demoName, TOUCH, resolved.credits);
  }, [spec.text, demoName, resolved.credits]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const deckRef = useRef<Deck | null>(null);
  const demoRef = useRef<Demo | null>(null);
  const hapticsRef = useRef<WebHaptics | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fontsRef = useRef(new Map<FontId, PixelFont>());
  const fontNowRef = useRef<PixelFont | null>(null);
  const greetzRef = useRef<string[]>(resolved.greetz);
  greetzRef.current = resolved.greetz;
  const mutedRef = useRef<boolean>((() => { try { return localStorage.getItem('greets-muted') === '1'; } catch { return false; } })());
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // the demo engine lives outside react; draft flows in via ref
  const draftRef = useRef(draft);
  draftRef.current = draft;
  // the boot thud — web-haptics covers iOS via audio ticks; muted kills it too
  const thud = (n = 18) => {
    if (REDUCED || mutedRef.current) return;
    hapticsRef.current ??= new WebHaptics();
    void hapticsRef.current.trigger(n);
  };
  const powerRef = useRef({ started: 0, done: 0, pressAt: 0 });

  const assetsFor = (font: PixelFont): DemoAssets => ({
    font, name: demoName, seed, ramp: resolved.ramp, scrolltext,
    sections: resolved.sections, scrollSpeed: resolved.speed,
    wave: resolved.wave, logoMode: resolved.logo,
  });

  const getFont = async (id: FontId): Promise<PixelFont> => {
    let f = fontsRef.current.get(id);
    if (!f) { f = await loadPixelFont(id); fontsRef.current.set(id, f); }
    return f;
  };

  // the URL is the spec — every patch rewrites the hash, every external
  // navigation re-decodes it
  useEffect(() => {
    // a slashed path is the NO DISK landing, not a broken link — keep the
    // address honest so reload shows the same error crawl — re-read the
    // path every run: leaving /no/disk by typing a name turns the writer
    // back on, or the new spec could never reach the hash
    if (badPathNow()) return;
    const h = encodeSpec(spec);
    const url = (name ? '/' + encodeURIComponent(name.toLowerCase()) : '/') + (h ? '#' + h : '');
    if (location.pathname + location.hash !== url) history.replaceState(null, '', url);
  }, [spec, name]);

  const nameRef = useRef(name);
  nameRef.current = name;
  useEffect(() => {
    const onNav = () => {
      const n = pathName();
      setSpec(decodeSpec(location.hash, n ?? ''));
      if (n !== nameRef.current) {
        // the route owns the phase: back to '/' means landing, a different
        // name means a fresh tube that still has to be powered on — and a
        // clean bench: no undo stack or half-printed export from the old name
        setDeckOpen(false);
        setPhase(n ? 'preboot' : 'landing');
        clearSession();
      }
      setName(n);
    };
    addEventListener('hashchange', onNav);
    addEventListener('popstate', onNav);
    return () => { removeEventListener('hashchange', onNav); removeEventListener('popstate', onNav); };
  }, []);

  useEffect(() => {
    let stop = false;
    let raf = 0;
    let alive = true;
    (async () => {
      const font = await getFont(resolved.font);
      if (stop || !canvasRef.current || !alive) return;
      fontNowRef.current = font;
      const demo = new Demo(canvasRef.current, assetsFor(font));
      demoRef.current = demo;
      const t0 = performance.now();
      const frame = (now: number) => {
        if (stop) return;
        const t = (now - t0) / 1000;
        const ph = phaseRef.current;
        if (REDUCED && ph === 'running') { demo.muted = mutedRef.current; demo.previewMode = previewRef.current; demo.renderReduced(greetzRef.current); return; }
        if (ph === 'landing') demo.renderBios(t, draftRef.current, badPathNow());
        else if (ph === 'toboot') {
          const u = (now - powerRef.current.started) / 350;
          // the typed name stays on the glass until the slit covers it — the
          // wipe opens straight onto the beam, no second prompt
          demo.renderBios(t, draftRef.current);
          demo.wipe(u);
          if (u >= 1) {
            powerRef.current.started = now;
            thud();
            const d = deckRef.current;
            if (d) { void d.ctx.resume(); d.play(); }
            setPhase('poweron');
          }
        }
        else if (ph === 'preboot') demo.renderPreboot(t, TOUCH, now - powerRef.current.pressAt < 260);
        else if (ph === 'poweron') {
          const u = (now - powerRef.current.started) / 600;
          if (u >= 1) { powerRef.current.done = now; demo.sndOnUntil = now + 2400; setPhase('running'); }
          else demo.renderPowerOn(u, name, t);
        }
        else {
          const sinceBoot = (now - powerRef.current.done) / 1000;
          const lt = t - Math.floor(t / 9) * 9;
          demo.muted = mutedRef.current; demo.previewMode = previewRef.current;
          // a deck pin outranks the post-boot intro — the thing being edited
          // is the thing on the glass
          if (sinceBoot < 1.4 && !previewRef.current) demo.renderIntro(sinceBoot, lt, name);
          else demo.renderLoop(t, greetzRef.current);
        }
        if (!(REDUCED && ph === 'running')) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    })();
    return () => {
      stop = true; alive = false; cancelAnimationFrame(raf); demoRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  // live re-bake when the deck changes anything but the name
  const configTok = useRef(0);
  useEffect(() => {
    const tok = ++configTok.current;
    (async () => {
      const font = await getFont(resolved.font);
      if (tok !== configTok.current) return;
      fontNowRef.current = font;
      const d = demoRef.current;
      if (d) {
        d.configure(assetsFor(font));
        // reduced-motion mode renders on demand, not on a raf loop
        if (REDUCED && phaseRef.current === 'running') { d.muted = mutedRef.current; d.previewMode = previewRef.current; d.renderReduced(greetzRef.current); }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved]);

  // one owner for the audio: a whole deck per (name, tune). OFF and A share
  // a seed but not a deck, so the key carries the choice, not just the seed.
  // a deck created while the demo is already running starts playing on its
  // own — the gesture that powered the tube also unlocks later contexts
  const audioKey = name ? `${name}|${resolved.tune}|${resolved.tuneSeed}` : '';
  useEffect(() => {
    if (!audioKey) return;
    const deck = resolved.tune === 'off' ? null : bootAudio(generateTune(resolved.tuneSeed));
    deckRef.current = deck;
    if (deck) {
      deck.gain.gain.value = mutedRef.current ? 0 : 0.8;
      if (phaseRef.current === 'running' || phaseRef.current === 'poweron') { void deck.ctx.resume(); deck.play(); }
    }
    return () => {
      if (deckRef.current === deck) deckRef.current = null;
      deck?.stop();
      if (deck && deck.ctx.state !== 'closed') void deck.ctx.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioKey]);

  const [muted, setMuted] = useState(mutedRef.current);
  // the region speaks on the toggle, not on arrival — entering 'running'
  // is not a mute change and must not announce itself as one
  const [muteMsg, setMuteMsg] = useState('');
  const toggleMute = () => {
    const d = deckRef.current;
    if (!d) return;
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    setMuteMsg(mutedRef.current ? 'sound off' : 'sound on');
    d.gain.gain.value = mutedRef.current ? 0 : 0.8;
    try { localStorage.setItem('greets-muted', mutedRef.current ? '1' : '0'); } catch { /* private mode */ }
    const dm = demoRef.current;
    if (REDUCED && dm) { dm.muted = mutedRef.current; dm.previewMode = previewRef.current; dm.renderReduced(greetzRef.current); }
  };

  const deckOpenRef = useRef(deckOpen);
  deckOpenRef.current = deckOpen;
  // closing hands focus back to the EDIT key so the toggle is one control
  const closeDeck = () => {
    setDeckOpen(false);
    requestAnimationFrame(() => (document.querySelector('.fab') as HTMLElement | null)?.focus());
  };

  // the tube sizes itself from the room above the deck — --deckh is the
  // bay's measured height. the deck is content-sized, so the measurement
  // is one-way: a bigger bay just means a smaller tube, never the reverse
  useEffect(() => {
    const root = document.documentElement;
    // the tube is moving for the next beat — the raster must not fire its
    // own shutters through the resize (the wipe mid-park is the slit)
    demoRef.current?.holdWipe(850);
    if (!deckOpen) { root.style.removeProperty('--deckh'); return; }
    const el = document.querySelector('.deck') as HTMLElement | null;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      // publish the content height, not the squeezed border box — during the
      // entrance the column can overflow and flex shrinks the bay, and a
      // squeezed (or detached, zero) frame must never retarget the tube
      const h = Math.max(el.scrollHeight, Math.round(el.getBoundingClientRect().height));
      if (h > 0) root.style.setProperty('--deckh', `${h}px`);
    });
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty('--deckh'); };
  }, [deckOpen]);

  useEffect(() => {
    const boot = () => {
      if (phaseRef.current === 'preboot') {
        powerRef.current.started = performance.now();
        setPhase('poweron');
        thud();
        const d = deckRef.current;
        if (d) { void d.ctx.resume(); d.play(); }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      // escape is the deck's own release — it must work while a field is focused
      if (e.key === 'Escape') {
        if (deckOpenRef.current) { e.preventDefault(); closeDeck(); }
        return;
      }
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable]')) return;
      if (phaseRef.current === 'preboot') { e.preventDefault(); boot(); }
      else if ((e.key === 'm' || e.key === 'M') && phaseRef.current === 'running') toggleMute();
      else if ((e.key === 'e' || e.key === 'E') && phaseRef.current === 'running') { if (deckOpenRef.current) closeDeck(); else setDeckOpen(true); thud(8); }
    };
    const onTap = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('.deck, .fab')) return;
      if (phaseRef.current === 'preboot') {
        // the power key shows the press for a beat before the beam fires
        powerRef.current.pressAt = performance.now();
        setTimeout(boot, 240);
      // a tube tap mutes only while the deck is closed — with the bay open
      // the tube is a preview, not a switch, and the tap would be invisible
      } else if (phaseRef.current === 'running' && !deckOpenRef.current) toggleMute();
    };
    addEventListener('keydown', onKey);
    addEventListener('pointerdown', onTap);
    return () => { removeEventListener('keydown', onKey); removeEventListener('pointerdown', onTap); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = () => {
    const s = draft.trim();
    if (!s) return;
    history.pushState(null, '', '/' + encodeURIComponent(s.toLowerCase()));
    setName(s);
    powerRef.current.started = performance.now();
    setPhase('toboot');
  };

  // style patches are undoable, word edits are not — undo is a rig key,
  // not a per-keystroke text history. the snapshot only covers the style
  // keys, so undoing a ramp can never eat a scrolltext typed afterwards
  const undoRef = useRef<Partial<Spec>[]>([]);
  const specRef = useRef(spec);
  specRef.current = spec;
  const pushUndo = () => {
    const snap: Partial<Spec> = {};
    for (const k of STYLE_KEYS) (snap as Record<string, unknown>)[k] = specRef.current[k];
    undoRef.current.push(snap);
    if (undoRef.current.length > 24) undoRef.current.shift();
    setCanUndo(true);
  };
  const patch = (p: Partial<Spec>) => {
    if (STYLE_KEYS.some((k) => k in p)) pushUndo();
    setSpec((s) => ({ ...s, ...p }));
    thud(8);
  };
  const undo = () => {
    const prev = undoRef.current.pop();
    if (!prev) return;
    if (!undoRef.current.length) setCanUndo(false);
    setSpec((s) => ({ ...s, ...prev }));
    thud(8);
  };
  // the deck pins the tube to the part being edited
  const previewRef = useRef<Preview>('');
  const setPreview = (p: Preview) => {
    previewRef.current = p;
    const d = demoRef.current;
    if (d && REDUCED && phaseRef.current === 'running') { d.muted = mutedRef.current; d.previewMode = previewRef.current; d.renderReduced(greetzRef.current); }
  };
  // exports are jobs — a cancelled or superseded job never gets to publish
  const jobRef = useRef(0);
  const doExport = async (kind: 'gif' | 'video') => {
    const font = fontNowRef.current;
    if (!font || exp.busy || abortRef.current) return;
    const job = ++jobRef.current;
    const ac = new AbortController();
    abortRef.current = ac;
    setExp({ busy: true, kind, frac: 0, label: 'WARMING UP', result: null, error: null });
    const live = () => jobRef.current === job;
    const prog = (frac: number, label: string) => { if (live()) setExp((e) => ({ ...e, frac, label })); };
    try {
      const assets = assetsFor(font);
      const tune = resolved.tune === 'off' ? null : generateTune(resolved.tuneSeed);
      const r = kind === 'gif'
        ? await exportGif(assets, resolved.greetz, resolved.ramp, resolved.credits, prog, ac.signal)
        : await exportVideo(assets, resolved.greetz, resolved.ramp, tune, prog, ac.signal);
      if (live()) setExp({ busy: false, kind, frac: 1, label: 'DONE', result: r, error: null });
    } catch (e) {
      if (!live()) return;
      const msg = e instanceof DOMException && e.name === 'AbortError' ? 'CANCELLED'
        : e instanceof Error && /audio/i.test(e.message) ? 'THE BROWSER MUTED THE FILM'
        : e instanceof Error && /record|encode/i.test(e.message) ? 'THIS BROWSER CANNOT PRINT FILM'
        : 'THE PRESS JAMMED';
      setExp({ busy: false, kind: null, frac: 0, label: '', result: null, error: msg });
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
    }
  };
  const cancelExport = () => {
    jobRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    setExp({ busy: false, kind: null, frac: 0, label: '', result: null, error: null });
  };
  // a new name (route change or rename) wipes the bench: undo, the export
  // rail, and any job still printing
  const clearSession = () => {
    undoRef.current = [];
    setCanUndo(false);
    cancelExport();
    if (linkTimerRef.current) { clearTimeout(linkTimerRef.current); linkTimerRef.current = null; }
    setLinkState('idle');
    setLinkNote('COPIES THE LINK WITH ALL YOUR SETTINGS');
  };
  const rename = (n: string) => {
    history.pushState(null, '', '/' + encodeURIComponent(n.toLowerCase()) + location.hash);
    setSpec((s) => ({ ...s, name: n }));
    // a new name is a new bench: no undo stack or in-flight export that
    // could publish the old picture under the new name
    clearSession();
    // the name is the machine's label — the whole boot replays on the
    // full tube: the bay leaves first, then the beam fires and the
    // letters land on glass that is not parked behind a rack
    setDeckOpen(false);
    setPreview('');
    powerRef.current.started = performance.now();
    setPhase('poweron');
    setName(n);
  };
  const saveResult = () => {
    if (!exp.result) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(exp.result.blob);
    a.download = `greets-${resolved.name.toLowerCase()}.${exp.result.ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const shareFile = async () => {
    if (!exp.result) return;
    const f = new File([exp.result.blob], `greets-${resolved.name.toLowerCase()}.${exp.result.ext}`, { type: exp.result.blob.type });
    try {
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f] });
      else saveResult();
    } catch { /* user closed the sheet */ }
  };
  // only COPIED auto-dismisses — a refused clipboard leaves a field you
  // have to select by hand, and a row that vanishes mid-select is a lie
  const linkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareLink = async () => {
    if (linkTimerRef.current) { clearTimeout(linkTimerRef.current); linkTimerRef.current = null; }
    const url = location.href;
    // the clipboard path — also the answer when the share sheet is refused
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(url);
        setLinkState('copied');
        setLinkNote('COPIED — THE WHOLE SPEC RIDES IN IT');
        linkTimerRef.current = setTimeout(() => {
          linkTimerRef.current = null;
          setLinkState('idle');
          setLinkNote('COPIES THE LINK WITH ALL YOUR SETTINGS');
        }, 2600);
      } catch {
        setLinkState('manual');
        setLinkNote(url);
      }
    };
    try {
      if (navigator.share) await navigator.share({ url });
      else await copy();
    } catch {
      // the sheet was dismissed or refused — the key still answers
      await copy();
    }
  };

  return (
    <div className={'app' + (deckOpen ? ' editing' : '')}>
      <div className="room" />
      <div className="tube">
        <canvas ref={canvasRef} className="demoscreen" aria-label={`cracktro greeting ${name ?? ''}${muted ? ', muted' : ''}`} />
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
          style={{ '--hot': RAMPS[resolved.ramp][6] } as CSSProperties}
          aria-label="power on"
          onPointerDown={() => { setRockerDown(true); setTimeout(() => setRockerDown(false), 400); }}
        />
      )}
      {phase === 'running' && (
        <span className="sr-only" aria-live="polite">{muteMsg}</span>
      )}
      {phase === 'running' && !deckOpen && (
        <button type="button" className="fab" style={{ '--hot': RAMPS[resolved.ramp][6] } as CSSProperties}
          aria-label="open the control deck" onClick={() => { setDeckOpen(true); thud(8); }}>
          EDIT
        </button>
      )}
      {deckOpen && phase === 'running' && (
        <ControlDeck
          spec={spec} resolved={resolved} hot={RAMPS[resolved.ramp][6]} exp={exp}
          canUndo={canUndo} linkState={linkState}
          onPatch={patch}
          onUndo={undo}
          onPreview={setPreview}
          onRename={rename}
          onExport={doExport}
          onCancelExport={cancelExport}
          onSave={saveResult}
          onShareFile={shareFile}
          onShareLink={shareLink}
          onRandomize={() => { pushUndo(); setSpec((s) => randomizeStyle(s, mulberry32(Date.now() & 0xffffffff), Object.keys(RAMPS) as RampName[])); thud(24); }}
          onReset={() => {
            // RESET is a rig key like RANDOMISE — it reseeds the style dials
            // and leaves the words alone, so UNDO can always describe it
            pushUndo();
            const d = defaultSpec(demoName);
            const p: Partial<Spec> = {};
            for (const k of STYLE_KEYS) (p as Record<string, unknown>)[k] = d[k];
            setSpec((s) => ({ ...s, ...p }));
          }}
          onClose={closeDeck}
          onTap={() => thud(8)}
          linkNote={linkNote}
        />
      )}
    </div>
  );
}
