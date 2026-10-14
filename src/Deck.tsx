// the control deck — demoscene chrome for the machine under the tube.
// one rack at a time: tabs hold the groups, the MAKE rail never leaves,
// and the tube stays in view while you work it
import { useEffect, useState } from 'react';
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

export type Preview = '' | 'scroll' | 'greetz' | SectionId;
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

function Chip(props: {
  on: boolean; label: string; title?: string; hot: string;
  onPress: () => void; disabled?: boolean; swatch?: string[]; toggle?: boolean;
}) {
  return (
    <button
      type="button"
      className={'key' + (props.on ? ' on' : '')}
      style={{ '--hot': props.hot, '--dim': props.swatch ? 'transparent' : undefined } as CSSProperties}
      title={props.title}
      disabled={props.disabled}
      onClick={props.onPress}
      aria-pressed={props.toggle ? props.on : undefined}
    >
      {props.swatch && (
        <span className="swatch" aria-hidden>
          {props.swatch.map((c, i) => <i key={i} style={{ background: c }} />)}
        </span>
      )}
      {props.label}
    </button>
  );
}

function Row(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="drow" role="group" aria-label={props.label}>
      <div className="dlabel" aria-hidden>{props.label}</div>
      <div className="dkeys">{props.children}</div>
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
  linkNote: string;
}) {
  const { spec, resolved, hot, exp } = props;
  const [tab, setTab] = useState<Tab>('rigs');
  const [nameDraft, setNameDraft] = useState('');
  // the greetz field edits a comma list — keep a raw draft so the comma the
  // user just typed isn't eaten by the join round-trip; only re-sync the
  // draft from spec when the field isn't the thing typing it
  const [greetzDraft, setGreetzDraft] = useState(spec.greetz.join(', '));
  const [greetzFocus, setGreetzFocus] = useState(false);
  useEffect(() => { if (!greetzFocus) setGreetzDraft(spec.greetz.join(', ')); }, [spec.greetz, greetzFocus]);

  // the tube shows the thing you're turning: words and motion pin the
  // scroller, the greetz field pins the roll, everything else free-wheels
  useEffect(() => {
    props.onPreview(greetzFocus ? 'greetz' : tab === 'words' || tab === 'motion' ? 'scroll' : '');
    return () => props.onPreview('');
  }, [tab, greetzFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  // text inputs swallow their own keys except Escape — the deck must still
  // be able to close while a field has focus
  const inputKeys = (e: React.KeyboardEvent) => { if (e.key !== 'Escape') e.stopPropagation(); };
  const secs = spec.sections === 'auto' ? ['classic', 'plasma', 'blitter'] as SectionId[] : spec.sections;
  const setSec = (id: SectionId) => {
    const has = secs.includes(id);
    if (has && secs.length === 1) return; // never an empty demo
    const next = has ? secs.filter((s) => s !== id) : [...secs, id];
    // stored canonical — the lit rig key and the played cycle always agree
    props.onPatch({ sections: SECTION_ORDER.filter((x) => next.includes(x)) });
    props.onPreview(id);
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
    <div className="deck" role="dialog" aria-label="control deck" style={{ '--hot': hot } as CSSProperties}>
      <div className="deckhead">
        <span className="decktitle">CONTROL DECK</span>
        <div className="dtabs" role="tablist" aria-label="deck groups">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
              className={'key tab' + (tab === t.id ? ' on' : '')}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {/* the deck is a dialog — opening it hands focus to its exit key */}
        <button type="button" autoFocus className="key deckx" onClick={props.onClose} aria-label="close deck">×</button>
      </div>

      <div className="deckbody">
        {tab === 'rigs' && (
          <>
            <Row label="RIGS">
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
          </>
        )}

        {tab === 'words' && (
          <div className="dfields">
            <Field cap="NAME · ↵ RENAMES">
              <input
                className="dinput" aria-label="name" maxLength={14}
                placeholder={resolved.name.toUpperCase()} value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value.replace(/[^\p{L}\p{N} '\-_.]/gu, '').slice(0, 14))}
                onKeyDown={(e) => { if (e.key === 'Enter' && nameDraft.trim()) { props.onRename(nameDraft.trim()); setNameDraft(''); e.preventDefault(); return; } inputKeys(e); }}
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
              <input
                className="dinput" aria-label="scrolltext" maxLength={240}
                placeholder="LEAVE EMPTY FOR THE GENERATED ONE" value={spec.text}
                onChange={(e) => props.onPatch({ text: cleanText(e.target.value) })}
                onKeyDown={inputKeys}
              />
            </Field>
            <Field cap="GREETZ · COMMA LIST · EMPTY = AUTO" wide>
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
                  disabled={secs.includes(s) && secs.length === 1}
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

      <div className="deckfoot">
        <span className="dlabel">MAKE</span>
        <div className="dkeys">
          {exp.busy ? (
            <>
              <Chip on={false} hot={hot} disabled onPress={() => {}} label={exportLabel(exp.kind ?? 'gif', exp.kind === 'video' ? '▶ FILM' : '◉ GIF')} />
              <span className="prog" aria-live="polite">{bar(exp.frac)} {exp.label}</span>
              <Chip on={false} hot={hot} label="CANCEL" onPress={props.onCancelExport} />
            </>
          ) : exp.result ? (
            <>
              <img className="resthumb" src={exp.result.thumb} alt="" />
              <span className="prog done" aria-live="polite">
                {`greets-${resolved.name.toLowerCase()}.${exp.result.ext} · ${(exp.result.blob.size / 1048576).toFixed(1)}M`}
              </span>
              <Chip on={false} hot={hot} label="SAVE" onPress={props.onSave} />
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
              <span className="dnote" aria-live="polite">{props.linkNote}</span>
            </>
          )}
          {exp.error && <span className="prog err" role="alert">{exp.error}</span>}
        </div>
      </div>
    </div>
  );
}
