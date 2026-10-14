// the control deck — demoscene chrome for the machine under the tube.
// every row is a rack unit; every control is a chunky key that clicks down.
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { RAMPS } from './lib/demo.ts';
import type { RampName } from './lib/demo.ts';
import { SECTION_ORDER, FONT_ORDER, LOGO_ORDER, WAVE_ORDER, SPEEDS, cleanText, cleanGreet } from './lib/spec.ts';
import type { Spec, SectionId, Resolved } from './lib/spec.ts';
import type { Exported } from './lib/export.ts';

export interface ExportUi {
  busy: boolean;
  frac: number;
  label: string;
  result: Exported | null;
  error: string | null;
}

const SPEED_LABELS = ['CHILL', 'STD', 'FAST', 'TURBO'];
const TUNE_LABELS = ['A', 'B', 'C', 'D'];
const SEC_LABELS: Record<SectionId, string> = { classic: 'CLASSIC', copper: 'COPPER', plasma: 'PLASMA', blitter: 'BLITTER' };
const FONT_LABELS = { ps2p: 'BLOCK', silk: 'SILK', vt: 'VT' };

function Chip(props: {
  on: boolean; label: string; title?: string; hot: string;
  onPress: () => void; disabled?: boolean; swatch?: string[];
}) {
  return (
    <button
      type="button"
      className={'key' + (props.on ? ' on' : '')}
      style={{ '--hot': props.hot, '--dim': props.swatch ? 'transparent' : undefined } as CSSProperties}
      title={props.title}
      disabled={props.disabled}
      onClick={props.onPress}
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
    <div className="drow">
      <div className="dlabel">{props.label}</div>
      <div className="dkeys">{props.children}</div>
    </div>
  );
}

export default function Deck(props: {
  spec: Spec;
  resolved: Resolved;
  hot: string;
  exp: ExportUi;
  onPatch: (p: Partial<Spec>) => void;
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
  const [nameDraft, setNameDraft] = useState('');
  // the greetz field edits a comma list — keep a raw draft so the comma the
  // user just typed isn't eaten by the join round-trip
  const [greetzDraft, setGreetzDraft] = useState(spec.greetz.join(', '));
  useEffect(() => setGreetzDraft(spec.greetz.join(', ')), [spec.greetz]);
  const secs = spec.sections === 'auto' ? ['classic', 'plasma', 'blitter'] as SectionId[] : spec.sections;
  const setSec = (id: SectionId) => {
    const has = secs.includes(id);
    if (has && secs.length === 1) return; // never an empty demo
    const next = has ? secs.filter((s) => s !== id) : [...secs, id];
    props.onPatch({ sections: next });
  };
  const bar = (n: number) => '▓'.repeat(Math.round(n * 12)) + '░'.repeat(12 - Math.round(n * 12));

  return (
    <div className="deck" role="dialog" aria-label="control deck" style={{ '--hot': hot } as CSSProperties}>
      <div className="deckhead">
        <span className="decktitle">CONTROL DECK</span>
        <span className="deckhint">EVERYTHING RIDES IN THE URL</span>
        <button type="button" className="key deckx" onClick={props.onClose} aria-label="close deck">×</button>
      </div>

      <div className="deckbody">
        <Row label="WORDS">
          <input
            className="dinput w-name" aria-label="name"
            placeholder={resolved.name.toUpperCase()} value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value.replace(/[^\p{L}\p{N} '\-_.]/gu, '').slice(0, 14))}
            onKeyDown={(e) => { if (e.key === 'Enter' && nameDraft.trim()) { props.onRename(nameDraft.trim()); setNameDraft(''); } e.stopPropagation(); }}
          />
          <input
            className="dinput w-text" aria-label="scrolltext"
            placeholder="SCROLLTEXT · AUTO" value={spec.text}
            onChange={(e) => props.onPatch({ text: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <input
            className="dinput w-text" aria-label="greets list"
            placeholder="GREETZ · AUTO" value={greetzDraft}
            onChange={(e) => { setGreetzDraft(e.target.value); props.onPatch({ greetz: e.target.value.split(',').map(cleanGreet).filter(Boolean).slice(0, 8) }); }}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <input
            className="dinput w-cred" aria-label="credits"
            placeholder="CREDITS · GREETS DEV" value={spec.credits}
            onChange={(e) => props.onPatch({ credits: cleanText(e.target.value, 24) })}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </Row>

        <Row label="COLOR">
          {(Object.keys(RAMPS) as RampName[]).map((r) => (
            <Chip key={r} on={resolved.ramp === r} hot={hot} label={r.toUpperCase()}
              swatch={[RAMPS[r][2], RAMPS[r][4], RAMPS[r][6]]}
              onPress={() => props.onPatch({ ramp: r })} />
          ))}
        </Row>

        <Row label="PARTS">
          {SECTION_ORDER.map((s) => (
            <Chip key={s} on={secs.includes(s)} hot={hot} label={SEC_LABELS[s]}
              disabled={secs.includes(s) && secs.length === 1}
              onPress={() => setSec(s)} />
          ))}
          <span className="dnote">+ THE GREETZ ROLL, ALWAYS</span>
        </Row>

        <Row label="LOGO">
          {LOGO_ORDER.map((l) => (
            <Chip key={l} on={resolved.logo === l} hot={hot} label={l.toUpperCase()}
              onPress={() => props.onPatch({ logo: l })} />
          ))}
        </Row>

        <Row label="FONT">
          {FONT_ORDER.map((f) => (
            <Chip key={f} on={resolved.font === f} hot={hot} label={FONT_LABELS[f]}
              onPress={() => props.onPatch({ font: f })} />
          ))}
        </Row>

        <Row label="SCROLL">
          {SPEEDS.map((s, i) => (
            <Chip key={s} on={spec.speed === i || (spec.speed === 'auto' && i === 1)} hot={hot}
              label={SPEED_LABELS[i]} title={`${s}×`}
              onPress={() => props.onPatch({ speed: i as Spec['speed'] })} />
          ))}
          {WAVE_ORDER.map((w) => (
            <Chip key={w} on={(spec.wave === 'auto' ? 'classic' : spec.wave) === w} hot={hot} label={'W·' + w.toUpperCase()}
              onPress={() => props.onPatch({ wave: w })} />
          ))}
        </Row>

        <Row label="TUNE">
          {TUNE_LABELS.map((t, i) => (
            <Chip key={t} on={resolved.tune === ('abcd'[i])} hot={hot} label={'♪' + t}
              onPress={() => props.onPatch({ tune: 'abcd'[i] as Spec['tune'] })} />
          ))}
          <Chip on={resolved.tune === 'off'} hot={hot} label="OFF"
            onPress={() => props.onPatch({ tune: 'off' })} />
        </Row>

        <Row label="MAKE">
          {exp.busy ? (
            <>
              <span className="prog">{exp.label} {bar(exp.frac)} {Math.round(exp.frac * 100)}%</span>
              <Chip on={false} hot={hot} label="CANCEL" onPress={props.onCancelExport} />
            </>
          ) : exp.result ? (
            <>
              <span className="prog done">
                {`greets-${resolved.name.toLowerCase()}.${exp.result.ext} · ${(exp.result.blob.size / 1048576).toFixed(1)}M`}
              </span>
              <Chip on={false} hot={hot} label="SAVE" onPress={props.onSave} />
              {typeof navigator !== 'undefined' && 'canShare' in navigator && (
                <Chip on={false} hot={hot} label="SHARE" onPress={props.onShareFile} />
              )}
              <Chip on={false} hot={hot} label="×" title="dismiss" onPress={props.onCancelExport} />
            </>
          ) : (
            <>
              <Chip on={false} hot={hot} label="◉ GIF" title="600px square loop" onPress={() => props.onExport('gif')} />
              <Chip on={false} hot={hot} label="▶ FILM" title="720p video with the tune" onPress={() => props.onExport('video')} />
              <Chip on={false} hot={hot} label="⧉ LINK" onPress={props.onShareLink} />
              <span className="dnote">{props.linkNote}</span>
            </>
          )}
          {exp.error && <span className="prog err">{exp.error}</span>}
        </Row>

        <Row label="LUCK">
          <Chip on={false} hot={hot} label="⚄ RANDOMISE" onPress={props.onRandomize} />
          <Chip on={false} hot={hot} label="RESET" title="back to the seeded defaults" onPress={props.onReset} />
        </Row>
      </div>
    </div>
  );
}

