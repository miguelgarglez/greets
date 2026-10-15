// the control deck — demoscene chrome for the machine under the tube.
// one rack at a time: tabs hold the groups, the MAKE rail never leaves,
// and the tube stays in view while you work it
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { RAMPS } from './lib/demo.ts';
import type { RampName } from './lib/demo.ts';
import { SECTION_ORDER, FONT_ORDER, LOGO_ORDER, WAVE_ORDER, SPEEDS, PRESETS, cleanText, cleanGreetzList } from './lib/spec.ts';
import type { Spec, SectionId, Resolved } from './lib/spec.ts';
import type { Exported } from './lib/export.ts';

export interface ExportUi {
  busy: boolean;
  kind: 'gif' | 'video' | null;
  frac: number;
  label: string;
  result: Exported | null;
  error: string | null;
}

export type Preview = '' | 'scroll' | 'scrollhold' | 'greetz' | SectionId;
type Tab = 'rigs' | 'words' | 'look' | 'motion' | 'tune';
const TABS: { id: Tab; label: string }[] = [
  { id: 'rigs', label: 'RIGS' },
  { id: 'words', label: 'WORDS' },
  { id: 'look', label: 'LOOK' },
  { id: 'motion', label: 'MOTION' },
  { id: 'tune', label: 'TUNE' },
];

const SPEED_LABELS = ['CHILL', 'STD', 'FAST', 'TURBO'];
const TUNE_LABELS = ['A', 'B', 'C', 'D'];
const SEC_LABELS: Record<SectionId, string> = { classic: 'CLASSIC', copper: 'COPPER', plasma: 'PLASMA', blitter: 'BLITTER' };
const FONT_LABELS = { ps2p: 'BLOCK', silk: 'SILK', vt: 'VT' };

// every key in the bay confirms a thumb press the way the boot does
const HapticCtx = createContext<(() => void) | null>(null);

function Chip(props: {
  on: boolean; label: string; title?: string; hot: string;
  onPress: () => void; disabled?: boolean; swatch?: string[]; toggle?: boolean;
}) {
  const haptic = useContext(HapticCtx);
  return (
    <button
      type="button"
      className={'key' + (props.on ? ' on' : '')}
      style={{ '--hot': props.hot, '--dim': props.swatch ? 'transparent' : undefined } as CSSProperties}
      title={props.title}
      disabled={props.disabled}
      onClick={() => { haptic?.(); props.onPress(); }}
      aria-pressed={props.toggle ? props.on : undefined}
    >
      {props.swatch && (
        <span className="swatch" aria-hidden>
          {props.swatch.map((c, i) => <i key={i} style={{ background: c }} />)}
        </span>
      )}
      {/* key on the word itself, minus live counters — a relabel is a swap
          the eye can catch, but a ticking percent must not restart it */}
      <span className="klabel" key={props.label.replace(/\s*\d+%$/, '')}>{props.label}</span>
    </button>
  );
}

function Row(props: { label: string; cls?: string; children: React.ReactNode }) {
  return (
    <div className="drow" role="group" aria-label={props.label}>
      <div className="dlabel" aria-hidden>{props.label}</div>
      <div className={'dkeys' + (props.cls ? ' ' + props.cls : '')}>{props.children}</div>
    </div>
  );
}

function Field(props: { cap: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={'field' + (props.wide ? ' wide' : '')}>
      <span className="fcap" aria-hidden>{props.cap}</span>
      {props.children}
    </label>
  );
}

export default function Deck(props: {
  spec: Spec;
  resolved: Resolved;
  hot: string;
  exp: ExportUi;
  canUndo: boolean;
  linkState: 'idle' | 'copied' | 'manual';
  onPatch: (p: Partial<Spec>) => void;
  onUndo: () => void;
  onPreview: (p: Preview) => void;
  onRename: (n: string) => void;
  onExport: (kind: 'gif' | 'video') => void;
  onCancelExport: () => void;
  onSave: () => void;
  onShareFile: () => void;
  onShareLink: () => void;
  onRandomize: () => void;
  onReset: () => void;
  onClose: () => void;
  onTap?: () => void;
  linkNote: string;
}) {
  const { spec, resolved, hot, exp } = props;
  // every key press confirms itself — the same thud the boot and EDIT use;
  // patch stays silent so typing isn't a drumroll
  const haptic = () => props.onTap?.();
  const [tab, setTab] = useState<Tab>('rigs');
  const [nameDraft, setNameDraft] = useState('');
  // the greetz field edits a comma list — keep a raw draft so the comma the
  // user just typed isn't eaten by the join round-trip; only re-sync the
  // draft from spec when the field isn't the thing typing it
  const [greetzDraft, setGreetzDraft] = useState(spec.greetz.join(', '));
  const [greetzFocus, setGreetzFocus] = useState(false);
  const [scrollFocus, setScrollFocus] = useState(false);
  const xRef = useRef<HTMLButtonElement>(null);
  // the manual link hands itself over — focused and selected the moment it
  // appears, so one ⌘C is the whole interaction
  const urlRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (props.linkState === 'manual') { urlRef.current?.focus({ preventScroll: true }); urlRef.current?.select(); }
  }, [props.linkState]);
  // the exit key takes focus after the entrance, not while it is still
  // parked off-screen — focusing it early scrolls the page to it
  useEffect(() => {
    const t = setTimeout(() => {
      // don't steal focus out from under someone already typing in the bay
      if (xRef.current && !xRef.current.closest('.deck')?.contains(document.activeElement))
        xRef.current.focus({ preventScroll: true });
    }, 720);
    return () => clearTimeout(t);
  }, []);
  // SAVE relabels once the download has actually been handed over — the
  // receipt row is where a finished artifact answers
  const [saved, setSaved] = useState(false);
  useEffect(() => setSaved(false), [exp.result]);
  useEffect(() => { if (!greetzFocus) setGreetzDraft(spec.greetz.join(', ')); }, [spec.greetz, greetzFocus]);

  // a lit PARTS key is a preview: first press shows you the section on the
  // tube; pressing the one already on the glass takes it out of the cycle.
  // declared before the pin effect so the effect can reset it — otherwise a
  // tab round-trip leaves a stale id and the next press deletes its part
  const secPinRef = useRef<SectionId | ''>('');
  // the tube shows the thing you're turning: words and motion pin the
  // scroller, the greetz field pins the roll, everything else free-wheels
  useEffect(() => {
    secPinRef.current = '';
    // while the scroll field is focused the tube holds the whole phrase
    // still and fitted; unfocused, the pin crawls it
    props.onPreview(greetzFocus ? 'greetz' : scrollFocus ? 'scrollhold' : tab === 'words' || tab === 'motion' ? 'scroll' : '');
    return () => props.onPreview('');
  }, [tab, greetzFocus, scrollFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  // text inputs swallow their own keys except Escape — the deck must still
  // be able to close while a field has focus
  const inputKeys = (e: React.KeyboardEvent) => { if (e.key !== 'Escape') e.stopPropagation(); };
  const secs = spec.sections === 'auto' ? ['classic', 'plasma', 'blitter'] as SectionId[] : spec.sections;
  const setSec = (id: SectionId) => {
    const has = secs.includes(id);
    if (has && secPinRef.current !== id) { secPinRef.current = id; props.onPreview(id); return; }
    if (has && secs.length === 1) {
      // the last lit part can't leave the cycle — a second press on it is
      // "show me the whole thing again", not a dead key with a stuck pin
      secPinRef.current = '';
      props.onPreview('scroll');
      return;
    }
    const next = has ? secs.filter((s) => s !== id) : [...secs, id];
    // stored canonical — the lit rig key and the played cycle always agree
    props.onPatch({ sections: SECTION_ORDER.filter((x) => next.includes(x)) });
    // pin what you just switched on; when one goes dark, fall back to the
    // scroller rather than stare at the part you removed
    secPinRef.current = has ? '' : id;
    props.onPreview(has ? 'scroll' : id);
  };
  const sameSecs = (a: SectionId[], b: unknown) =>
    Array.isArray(b) && a.length === b.length && a.every((x) => b.includes(x));
  const rigOn = (patch: Partial<Spec>) =>
    Object.entries(patch).every(([k, v]) =>
      k === 'sections' && v !== 'auto' && spec.sections !== 'auto'
        ? sameSecs(spec.sections as SectionId[], v)
        : String(spec[k as keyof Spec]) === String(v));
  const bar = (n: number) => '▓'.repeat(Math.round(n * 8)) + '░'.repeat(8 - Math.round(n * 8));
  const exportLabel = (kind: 'gif' | 'video', base: string) =>
    exp.busy && exp.kind === kind ? `${base} ${Math.round(exp.frac * 100)}%` : base;

  return (
    <HapticCtx.Provider value={haptic}>
    <div className="deck" role="dialog" aria-label="control deck" style={{ '--hot': hot } as CSSProperties}>
      <div className="deckhead">
        <span className="decktitle">CONTROL DECK</span>
        {/* a group of latched keys, not tablist chrome — screen readers get
            the truth: four toggles, one lit */}
        <div className="dtabs" role="group" aria-label="deck groups">
          {TABS.map((t) => (
            <button key={t.id} type="button" aria-pressed={tab === t.id}
              className={'key tab' + (tab === t.id ? ' on' : '')}
              onClick={() => {
                // switching groups unpins the greetz board even if the
                // field's blur doesn't fire under a synthetic click — but
                // only blur what's inside the body, or focus falls off the
                // tab row entirely
                haptic();
                setGreetzFocus(false);
                const ae = document.activeElement as HTMLElement | null;
                if (ae?.closest?.('.deckbody')) ae.blur();
                setTab(t.id);
              }}>
              {t.label}
            </button>
          ))}
        </div>
        {/* the deck is a dialog — opening it hands focus to its exit key,
            but only once the bay has landed; autoFocus during the entrance
            fill scrolls an off-screen key into view and yanks the tube */}
        <button type="button" ref={xRef} className="key deckx" onClick={() => { haptic(); props.onClose(); }} aria-label="close deck">×</button>
      </div>

      <div className="deckbody">
        {/* the group is a keyed panel — switching groups slides the sheet
            in instead of teleporting it */}
        <div className="dpanel" key={tab}>
        {tab === 'rigs' && (
          <>
            <Row label="RIGS" cls="rigkeys">
              {PRESETS.map((pr) => (
                <Chip key={pr.id} toggle on={rigOn(pr.patch)} hot={hot} label={pr.label}
                  title="a whole style in one key" onPress={() => props.onPatch(pr.patch)} />
              ))}
            </Row>
            <Row label="HANDS">
              <Chip on={false} hot={hot} label="⚄ RANDOMISE" onPress={props.onRandomize} />
              <Chip on={false} hot={hot} label="↩ UNDO" disabled={!props.canUndo} onPress={props.onUndo} />
              <Chip on={false} hot={hot} label="RESET" title="back to the seeded defaults" onPress={props.onReset} />
              <span className="dnote">A RIG IS A WHOLE STYLE IN ONE KEY</span>
            </Row>
            <Row label="NOW">
              <span className="dnote big">
                {/* the line may only break AT a dot — the dot trails its
                    segment so a wrapped row never opens with a stray "·" */}
                {(() => {
                  const parts = `${resolved.ramp.toUpperCase()} · ${resolved.font.toUpperCase()} · LOGO ${resolved.logo.toUpperCase()} · SCROLL ${resolved.speed}× · TUNE ${resolved.tune.toUpperCase()}`.split(' · ');
                  return parts.map((s, i) => (
                    <span key={i}>{i > 0 && ' '}<span className="nowseg">{i < parts.length - 1 ? `${s} ·` : s}</span></span>
                  ));
                })()}
              </span>
            </Row>
          </>
        )}

        {tab === 'words' && (
          <div className="dfields">
            <Field cap="NAME · ↵ RENAMES">
              <input
                className="dinput" aria-label="name" maxLength={14}
                placeholder={resolved.name.toUpperCase()} value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value.replace(/[^\p{L}\p{N} '\-_.]/gu, '').slice(0, 14))}
                onKeyDown={(e) => { if (e.key === 'Enter' && nameDraft.trim()) { props.onRename(nameDraft.trim()); setNameDraft(''); e.currentTarget.blur(); e.preventDefault(); return; } inputKeys(e); }}
              />
            </Field>
            <Field cap="CREDITS">
              <input
                className="dinput" aria-label="credits" maxLength={24}
                placeholder="GREETS DEV" value={spec.credits}
                onChange={(e) => props.onPatch({ credits: cleanText(e.target.value, 24) })}
                onKeyDown={inputKeys}
              />
            </Field>
            <Field cap="SCROLLTEXT · EMPTY = AUTO" wide>
              {/* blurred, the field shows the head of the sentence — the
                  caret only owns the tail while you're actually typing;
                  while focused, the glass echoes the whole fitted line */}
              <input
                className="dinput" aria-label="scrolltext" maxLength={200}
                placeholder="EMPTY = GENERATED" value={spec.text}
                onFocus={() => setScrollFocus(true)}
                onBlur={(e) => { setScrollFocus(false); e.currentTarget.scrollLeft = 0; }}
                onChange={(e) => props.onPatch({ text: cleanText(e.target.value) })}
                onKeyDown={inputKeys}
              />
            </Field>
            <Field cap="GREETZ · COMMA LIST" wide>
              <input
                className="dinput" aria-label="greets list"
                placeholder="WHO ELSE GETS A SHOUT" value={greetzDraft}
                onFocus={() => setGreetzFocus(true)}
                onBlur={() => setGreetzFocus(false)}
                onChange={(e) => { setGreetzDraft(e.target.value); props.onPatch({ greetz: cleanGreetzList(e.target.value.split(',')) }); }}
                onKeyDown={inputKeys}
              />
            </Field>
          </div>
        )}

        {tab === 'look' && (
          <>
            <Row label="COLOR">
              {(Object.keys(RAMPS) as RampName[]).map((r) => (
                <Chip key={r} toggle on={resolved.ramp === r} hot={hot} label={r.toUpperCase()}
                  swatch={[RAMPS[r][2], RAMPS[r][4], RAMPS[r][6]]}
                  onPress={() => props.onPatch({ ramp: r })} />
              ))}
            </Row>
            <Row label="FONT">
              {FONT_ORDER.map((f) => (
                <Chip key={f} toggle on={resolved.font === f} hot={hot} label={FONT_LABELS[f]}
                  onPress={() => props.onPatch({ font: f })} />
              ))}
            </Row>
          </>
        )}

        {tab === 'motion' && (
          <>
            <Row label="PARTS">
              {SECTION_ORDER.map((s) => (
                <Chip key={s} toggle on={secs.includes(s)} hot={hot} label={SEC_LABELS[s]}
                  onPress={() => setSec(s)} />
              ))}
              <span className="dnote">+ GREETZ ALWAYS</span>
            </Row>
            <Row label="LOGO">
              {LOGO_ORDER.map((l) => (
                <Chip key={l} toggle on={resolved.logo === l} hot={hot} label={l.toUpperCase()}
                  onPress={() => props.onPatch({ logo: l })} />
              ))}
            </Row>
            <Row label="SCROLL">
              {SPEEDS.map((s, i) => (
                <Chip key={s} toggle on={spec.speed === i || (spec.speed === 'auto' && i === 1)} hot={hot}
                  label={SPEED_LABELS[i]} title={`${s}×`}
                  onPress={() => props.onPatch({ speed: i as Spec['speed'] })} />
              ))}
              {WAVE_ORDER.map((w) => (
                <Chip key={w} toggle on={(spec.wave === 'auto' ? 'classic' : spec.wave) === w} hot={hot} label={'W·' + w.toUpperCase()}
                  onPress={() => props.onPatch({ wave: w })} />
              ))}
            </Row>
          </>
        )}

        {tab === 'tune' && (
          <>
            <Row label="TUNE">
              {TUNE_LABELS.map((t, i) => (
                <Chip key={t} toggle on={resolved.tune === ('abcd'[i])} hot={hot} label={'♪' + t}
                  onPress={() => props.onPatch({ tune: 'abcd'[i] as Spec['tune'] })} />
              ))}
              <Chip toggle on={resolved.tune === 'off'} hot={hot} label="OFF"
                onPress={() => props.onPatch({ tune: 'off' })} />
            </Row>
            <Row label="NOTE">
              <span className="dnote">EVERY NAME GETS ITS OWN SONG · THE SEED WRITES IT</span>
            </Row>
          </>
        )}
        </div>
      </div>

      <div className="deckfoot">
        <span className="dlabel">MAKE</span>
        <div className="dkeys">
          {exp.busy ? (
            <>
              <Chip on={false} hot={hot} disabled onPress={() => {}} label={exportLabel(exp.kind ?? 'gif', exp.kind === 'video' ? '▶ FILM' : '◉ GIF')} />
              <span className="prog" aria-live="polite">{bar(exp.frac)} <span className="klabel" key={exp.label}>{exp.label}</span></span>
              <Chip on={false} hot={hot} label="CANCEL" onPress={props.onCancelExport} />
            </>
          ) : exp.result ? (
            <>
              <img className="resthumb" src={exp.result.thumb} alt="" />
              <span className="prog done" aria-live="polite">
                {`greets-${resolved.name.toLowerCase()}.${exp.result.ext} · ${(exp.result.blob.size / 1048576).toFixed(1)}M`}
              </span>
              <Chip on={saved} hot={hot} label={saved ? 'SAVED ✓' : 'SAVE'}
                onPress={() => { props.onSave(); setSaved(true); }} />
              <Chip on={false} hot={hot} label="SHARE" onPress={props.onShareFile} />
              <Chip on={false} hot={hot} label="×" title="dismiss" onPress={props.onCancelExport} />
            </>
          ) : (
            <>
              <Chip on={false} hot={hot} label={exportLabel('gif', '◉ GIF')} title="600px square loop" onPress={() => props.onExport('gif')} />
              <Chip on={false} hot={hot} label={exportLabel('video', '▶ FILM')} title="720p video with the tune" onPress={() => props.onExport('video')} />
              <Chip on={props.linkState !== 'idle'} hot={hot}
                label={props.linkState === 'copied' ? '⧉ COPIED' : props.linkState === 'manual' ? '⧉ COPY THIS' : '⧉ LINK'}
                onPress={props.onShareLink} />
              {props.linkState === 'manual' ? (
                // the clipboard refused — the URL holds as a real field that
                // selects itself until the next press, not a note that hides
                <input ref={urlRef} className="dinput urlline" readOnly value={props.linkNote} aria-label="share link"
                  onFocus={(e) => e.currentTarget.select()} />
              ) : (
                <span className="dnote big" aria-live="polite">{props.linkNote}</span>
              )}
            </>
          )}
          {exp.error && <span className="prog err" role="alert">{exp.error}</span>}
        </div>
      </div>
    </div>
    </HapticCtx.Provider>
  );
}
