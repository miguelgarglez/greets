import { useEffect, useRef } from 'react';
import { Demo, RAMPS } from '../src/lib/demo.ts';
import type { RampName } from '../src/lib/demo.ts';
import { loadPixelFont } from '../src/lib/font.ts';
import { hashName, mulberry32, pick } from '../src/lib/prng.ts';
import { makeScrolltext } from '../src/lib/scrolltext.ts';

export type Section = 'loop' | 'classic' | 'plasma' | 'blitter' | 'preboot';

// runs the real demo engine on a canvas; `section` locks a frame for stills
export function Stage({ name, section, t0 = 4 }: { name: string; section: Section; t0?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let stop = false;
    let raf = 0;
    (async () => {
      const font = await loadPixelFont();
      if (stop || !ref.current) return;
      const seed = hashName(name);
      const rng = mulberry32(seed ^ 0xface);
      const ramp = pick(rng, Object.keys(RAMPS)) as RampName;
      const demo = new Demo(ref.current, { font, name, seed, ramp, scrolltext: makeScrolltext(name) });
      const t00 = performance.now();
      const frame = (now: number) => {
        if (stop) return;
        const t = (now - t00) / 1000 + t0;
        const sec = section === 'loop' ? demo.sectionAt(Math.floor(t / 9)) : section;
        if (sec === 'classic') demo.renderClassic(t);
        else if (sec === 'plasma') demo.renderPlasma(t);
        else if (sec === 'preboot') demo.renderPreboot(t);
        else demo.renderBlitter(t);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    })();
    return () => { stop = true; cancelAnimationFrame(raf); };
  }, [name, section, t0]);
  return <canvas ref={ref} className="demoscreen" />;
}

// scanlines + vignette + flicker, pure css
export function Crt() {
  return (
    <div className="crt" aria-hidden>
      <div className="crt-lines" />
      <div className="crt-glow" />
      <div className="crt-flicker" />
    </div>
  );
}
