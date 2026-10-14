// the demo — one 320×200 raster canvas, four sections on a 50Hz clock.
// everything is seeded: same name, same demo.
import type { PixelFont } from './font.ts';
import { bakeLogo } from './font.ts';
import { mulberry32, pick } from './prng.ts';
import type { SectionId, LogoMode } from './spec.ts';

export const W = 320, H = 200;

// copper ramps — dark → saturated → hot
export const RAMPS: Record<string, string[]> = {
  blue:   ['#060614', '#10104a', '#2020a0', '#3a3ae0', '#6060ff', '#9a9aff', '#dcdcFF', '#ffffff'],
  jungle: ['#041006', '#0a3010', '#14601e', '#209030', '#34c048', '#70e080', '#b8ffc0', '#ffffff'],
  sunset: ['#140410', '#40102e', '#78205a', '#b03480', '#e04aa0', '#ff70c0', '#ffb0e0', '#ffffff'],
  fire:   ['#140602', '#3c1404', '#782a06', '#b8480a', '#e86a10', '#ffa030', '#ffd880', '#ffffff'],
  ice:    ['#021014', '#06303c', '#0a6068', '#10909a', '#18c0c8', '#50e0e8', '#b0fff8', '#ffffff'],
  violet: ['#0e0414', '#2a0e3c', '#501c70', '#782aa0', '#a03ad0', '#cc60f0', '#e8b0ff', '#ffffff'],
  alert:  ['#120206', '#380a10', '#701418', '#a81e20', '#e02a28', '#ff5040', '#ffa088', '#ffffff'],
  gold:   ['#100e02', '#302a06', '#60540a', '#908010', '#c0b018', '#e8d840', '#fff8a0', '#ffffff'],
};
export type RampName = keyof typeof RAMPS;

export type { SectionId, LogoMode } from './spec.ts';

export interface DemoAssets {
  font: PixelFont;
  name: string;
  seed: number;
  ramp: RampName;
  scrolltext: string;
  sections: SectionId[];          // ordered; the greetz roll always follows
  scrollSpeed: number;            // 1 = stock
  wave: [number, number, number]; // scroller sine: amp, spatial freq, temporal freq
  logoMode: LogoMode;
}

interface Star { x: number; y: number; z: number }

export class Demo {
  private ctx: CanvasRenderingContext2D;
  private font!: PixelFont;
  private name = '';
  private logo!: { cv: HTMLCanvasElement; w: number; h: number };
  private stars: Star[] = [];
  private ramp!: string[];
  private scrolltext = '';
  private plasmaImg: ImageData;
  private plasmaPal!: Uint32Array;
  private sections: SectionId[] = [];
  private colLetter!: Int16Array;
  private scrollSpeed = 1;
  private wave: [number, number, number] = [5, 0.055, 3.2];
  private logoMode: LogoMode = 'wave';

  constructor(cv: HTMLCanvasElement, a: DemoAssets) {
    cv.width = W; cv.height = H;
    this.ctx = cv.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.plasmaImg = new ImageData(W, H);
    this.applyAssets(a);
  }

  private bakeLogo() {
    const a = { font: this.font, name: this.name };
    let scale = a.name.length <= 7 ? 4 : a.name.length <= 10 ? 3 : 2;
    const baked = bakeLogo(a.font, a.name, scale, [[0, '#ffffff'], [0.55, '#e8e8ff'], [0.8, this.ramp[4]], [1, this.ramp[2]]]);
    let logo: { cv: HTMLCanvasElement; w: number; h: number };
    // the name must always land inside the glass, trail included
    if (baked.w > 288) {
      const f = 288 / baked.w;
      const cv = document.createElement('canvas');
      cv.width = 288; cv.height = Math.round(baked.h * f);
      const c = cv.getContext('2d')!;
      c.imageSmoothingEnabled = false;
      c.drawImage(baked.cv, 0, 0, 288, cv.height);
      logo = { cv, w: 288, h: cv.height };
      for (const s of baked.spans) { s[0] *= f; s[1] *= f; }
    } else {
      logo = { cv: baked.cv, w: baked.w, h: baked.h };
    }
    this.logo = logo;
    // letter index for every logo column — the intro reveals the logo per letter
    this.colLetter = new Int16Array(Math.ceil(logo.w)).fill(-1);
    baked.spans.forEach(([x0, x1], i) => {
      for (let x = Math.round(x0); x < Math.round(x1) && x < this.colLetter.length; x++) this.colLetter[x] = i;
    });
    this.solidCache.clear();
    this.glyphCache.clear();
    this.plasmaMaskCv = null;
  }

  private applyAssets(a: DemoAssets) {
    const fontChanged = this.font !== a.font;
    const rampChanged = this.ramp !== RAMPS[a.ramp];
    this.font = a.font;
    this.ramp = RAMPS[a.ramp];
    this.scrolltext = a.scrolltext;
    this.scrollSpeed = a.scrollSpeed;
    this.wave = a.wave;
    this.logoMode = a.logoMode;
    this.sections = a.sections;
    if (fontChanged || rampChanged || this.name !== a.name) {
      this.name = a.name;
      this.bakeLogo();
    }
    if (rampChanged) this.plasmaPal = this.buildPlasmaPalette(a.ramp);
    if (!this.stars.length) {
      const rng = mulberry32(a.seed);
      this.stars = Array.from({ length: 150 }, () => ({ x: rng() * W, y: rng() * H, z: pick(rng, [0.25, 0.55, 1]) }));
    }
  }

  // live re-bake from the control deck — the demo keeps playing under it
  configure(a: DemoAssets) {
    this.applyAssets(a);
  }

  private buildPlasmaPalette(ramp: RampName): Uint32Array {
    const r = RAMPS[ramp];
    // cross a cold ramp through the low indices so the field carries a second
    // hue — letters cut into it read as plasma, not dyed type
    const cold = RAMPS[ramp === 'ice' ? 'blue' : 'ice'];
    const pal = new Uint32Array(64);
    const hex = (s: string) => parseInt(s.slice(1), 16);
    for (let i = 0; i < 64; i++) {
      // skip the two darkest stops or the field reads as mud
      const f = 2 + i / 63 * (r.length - 3);
      const w = hex(r[Math.round(f)]);
      const d = hex(cold[Math.round(f)]);
      // low values lean cold, highs lean to the name's ramp
      const k = Math.min(1, Math.max(0, (i - 12) / 40));
      const mix = (a: number, b: number) => Math.round(a + (b - a) * k);
      const n = (mix(w >> 16 & 0xff, d >> 16 & 0xff) << 16)
        | (mix(w >> 8 & 0xff, d >> 8 & 0xff) << 8)
        | mix(w & 0xff, d & 0xff);
      pal[i] = 0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff);
    }
    return pal;
  }

  sectionAt(i: number) { return this.sections[i % this.sections.length]; }

  // ---------- effects ----------

  private starfield(t: number, dy = 0) {
    const c = this.ctx;
    for (const s of this.stars) {
      const x = (s.x - t * 40 * s.z) % W;
      const px = x < 0 ? x + W : x;
      const b = s.z > 0.9 ? 255 : s.z > 0.4 ? 170 : 90;
      c.fillStyle = `rgb(${b},${b},${Math.min(255, b + 30)})`;
      c.fillRect(px, s.y + dy, s.z > 0.9 ? 2 : 1, 1);
    }
  }

  // a single copper bar: 24px tall, hot in the middle, dark at edges,
  // with the ramp phase cycling like a real copperlist
  private copperBar(y: number, phase: number) {
    const c = this.ctx;
    const L = this.ramp.length;
    for (let i = 0; i < 12; i++) {
      const k = Math.abs(i - 5.5) / 5.5;
      const idx = (Math.round((1 - k) * (L - 1)) + Math.round(phase)) % L;
      c.fillStyle = this.ramp[Math.max(1, idx)];
      c.fillRect(0, y + i * 2, W, 2);
    }
  }

  private copper(t: number, topY = 10, botY = 146, kick = 0, dy = 0) {
    const w = Math.sin(t * 1.7) * 4;
    this.copperBar(topY + w + dy, t * 3 + kick);
    this.copperBar(botY - w - dy, t * 3 + 3 + kick);
  }

  private waveLogo(t: number, cy: number, trail = true) {
    const c = this.ctx;
    if (this.logoMode === 'still') {
      c.drawImage(this.logo.cv, (W - this.logo.w) / 2, cy);
      return;
    }
    const x0 = (W - this.logo.w) / 2;
    const draws = trail ? [{ d: -0.11, a: 0.25 }, { d: -0.055, a: 0.45 }, { d: 0, a: 1 }] : [{ d: 0, a: 1 }];
    if (this.logoMode === 'bounce') {
      for (const { d, a } of draws) {
        c.globalAlpha = a;
        const p = this.bouncePos(t + d);
        c.drawImage(this.logo.cv, p[0], p[1]);
      }
      c.globalAlpha = 1;
      return;
    }
    for (const { d, a } of draws) {
      c.globalAlpha = a;
      for (let x = 0; x < this.logo.w; x++) {
        const y = cy + Math.sin((t + d) * 2.6 + x * 0.045) * 9;
        c.drawImage(this.logo.cv, x, 0, 1, this.logo.h, x0 + x, y, 1, this.logo.h);
      }
    }
    c.globalAlpha = 1;
  }

  // dvd-style bounce position, clamped inside the copper band — shared by
  // the blitter section and the bounce logo mode
  private bouncePos(t: number): [number, number] {
    const lw = this.logo.w, lh = this.logo.h;
    const yTop = 42, yBot = Math.max(yTop + 8, 134 - lh);
    const bh = yBot - yTop, bw = W - lw - 16;
    return [
      8 + bw * (0.5 - 0.5 * Math.cos(t * 80 * Math.PI / bw)),
      yTop + bh * (0.5 - 0.5 * Math.cos(t * 55 * Math.PI / bh)),
    ];
  }

  private scroller(t: number, scale = 2, yBase = H - 22) {
    const c = this.ctx;
    const speed = 55 * this.scrollSpeed;
    const [amp, sf, tf] = this.wave;
    const adv = this.font.px * scale * 1.0;
    const total = this.scrolltext.length * adv + W + 40;
    const off = (t * speed) % total;
    let x = W - off;
    for (let i = 0; i < this.scrolltext.length; i++) {
      const g = this.font.get(this.scrolltext[i]);
      const cw = g ? g.w * scale : adv * 0.6;
      if (x > -adv && x < W + adv && g) {
        const y = yBase + Math.sin(t * tf + x * sf) * amp;
        c.drawImage(g.cv, x, y, g.w * scale, g.h * scale);
      }
      x += cw + 1;
    }
  }

  private plasma(t: number) {
    const d = this.plasmaImg.data, pal = this.plasmaPal;
    let i = 0;
    for (let y = 0; y < H; y++) {
      const sy = Math.sin(y * 0.055 - t * 0.9) + Math.sin(y * 0.021 + t * 0.5);
      for (let x = 0; x < W; x++) {
        const v = sy
          + Math.sin(x * 0.043 + t * 1.1)
          + Math.sin((x + y) * 0.03 + t * 0.7)
          + Math.sin(Math.hypot(x - W / 2, y - H / 2) * 0.05 - t * 1.3)
          + Math.sin(x * 0.11 - t * 1.7) * 0.7
          + Math.sin((x - y) * 0.09 + t * 1.5) * 0.7;
        const idx = Math.max(0, Math.min(63, Math.round((v + 6.4) / 12.8 * 63)));
        d[i] = pal[idx] & 0xff; d[i + 1] = (pal[idx] >> 8) & 0xff; d[i + 2] = (pal[idx] >> 16) & 0xff; d[i + 3] = 255;
        i += 4;
      }
    }
    this.ctx.putImageData(this.plasmaImg, 0, 0);
  }

  // ---------- sections ----------

  // drawn width of a string at a scale — glyph widths plus the tracking the
  // draw loop actually adds, so centering and scale-fitting measure the real
  // raster span instead of underestimating
  private drawnW(str: string, scale: number): number {
    let w = 0;
    for (const ch of str) w += (this.font.get(ch)?.w ?? this.font.px * 0.5) * scale + scale;
    return Math.max(0, w - scale);
  }

  // tiny centered line of pixel text inside the demo frame
  private tinyText(str: string, y: number, t: number, scale = 1) {
    const c = this.ctx;
    let x = (W - this.drawnW(str, scale)) / 2;
    for (const ch of str) {
      const gl = this.font.get(ch);
      if (!gl) { x += this.font.px * 0.5 * scale + scale; continue; }
      const bob = Math.sin(t * 2 + x * 0.08) * scale;
      c.drawImage(gl.cv, x, y + bob, gl.w * scale, gl.h * scale);
      x += gl.w * scale + scale;
    }
  }

  renderClassic(t: number, logo = true, scroll = true) {
    const c = this.ctx;
    c.fillStyle = '#05050a';
    c.fillRect(0, 0, W, H);
    this.starfield(t);
    this.copper(t);
    if (logo) this.waveLogo(t, H * 0.3);
    if (scroll) this.scroller(t);
  }

  private solidCache = new Map<string, HTMLCanvasElement>();
  private glyphCache = new Map<string, HTMLCanvasElement>();
  // a glyph re-tinted in the ramp's hot stop, for additive flashes
  private hotGlyph(ch: string, scale: number): HTMLCanvasElement {
    const key = ch + '@' + scale;
    let cv = this.glyphCache.get(key);
    if (cv) return cv;
    const gl = this.font.get(ch);
    cv = document.createElement('canvas');
    cv.width = Math.max(1, (gl?.w ?? 4) * scale); cv.height = Math.max(1, (gl?.h ?? 8) * scale);
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    if (gl) ctx.drawImage(gl.cv, 0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = this.ramp[6];
    ctx.fillRect(0, 0, cv.width, cv.height);
    this.glyphCache.set(key, cv);
    return cv;
  }

  private solidLogo(color: string): HTMLCanvasElement {
    let cv = this.solidCache.get(color);
    if (cv) return cv;
    cv = document.createElement('canvas');
    cv.width = this.logo.w; cv.height = this.logo.h;
    const ctx = cv.getContext('2d')!;
    ctx.drawImage(this.logo.cv, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, cv.width, cv.height);
    this.solidCache.set(color, cv);
    return cv;
  }

  private plasmaMaskCv: HTMLCanvasElement | null = null;
  // the name as a window cut out of the dark: live plasma shows through the
  // glyphs while the field stays near-black. rebuilt each frame so the
  // window drifts.
  renderPlasma(t: number) {
    this.plasma(t);
    const c = this.ctx;
    if (!this.plasmaMaskCv) {
      this.plasmaMaskCv = document.createElement('canvas');
      this.plasmaMaskCv.width = W; this.plasmaMaskCv.height = H;
    }
    const m = this.plasmaMaskCv.getContext('2d')!;
    m.globalCompositeOperation = 'source-over';
    m.fillStyle = 'rgba(46,46,64,0.6)';
    m.fillRect(0, 0, W, H);
    m.globalCompositeOperation = 'destination-out';
    // the window is the logo — it obeys the logo dial: held, drifting, or loose
    const [mx, my] = this.logoMode === 'bounce' ? this.bouncePos(t)
      : [(W - this.logo.w) / 2, H * 0.3 + (this.logoMode === 'still' ? 0 : Math.sin(t * 1.2) * 6)];
    m.drawImage(this.logo.cv, mx, my);
    c.drawImage(this.plasmaMaskCv, 0, 0);
    this.copper(t);
    this.scroller(t);
  }

  renderGreetz(t: number, greetz: string[]) {
    const c = this.ctx;
    c.fillStyle = '#05050a';
    c.fillRect(0, 0, W, H);
    // the roll owns the middle band: copper parked at the margins, no
    // scroller, and the window ends a full glyph above the bar so no line
    // is ever sliced by the copper
    c.save();
    c.beginPath();
    c.rect(0, 36, W, 118);
    c.clip();
    const lineH = 22;
    const total = greetz.length * lineH;
    const off = (t * 34) % (total + H) - lineH;
    greetz.forEach((n, i) => {
      const y = H - off - i * lineH;
      if (y < -lineH || y > H + lineH) return;
      const scale = n === 'YOU' ? 2.6 : 2;
      let x = (W - this.drawnW(n, scale)) / 2;
      for (const ch of n) {
        const gl = this.font.get(ch);
        if (!gl) { x += 8 * scale * 0.5; continue; }
        const bounce = n === 'YOU' ? Math.sin(t * 4 + x * 0.05) * 3 : 0;
        c.drawImage(gl.cv, x, y + bounce, gl.w * scale, gl.h * scale);
        x += gl.w * scale + 2;
      }
    });
    c.restore();
    this.copperBar(6, t * 3);
    this.copperBar(H - 30, t * 3 + 3);
  }

  // the greetz pin mode: a credit board, not a roll — every name the field
  // will produce is laid out at once so editing it shows what you edited
  renderGreetzBoard(greetz: string[]) {
    const c = this.ctx;
    c.fillStyle = '#05050a';
    c.fillRect(0, 0, W, H);
    c.save();
    c.beginPath();
    c.rect(0, 36, W, 118);
    c.clip();
    // pack the names into rows inside the band; YOU still gets its size —
    // shrink a step if a long roll would spill past the copper
    let scale = 1.6, lineH = 26;
    {
      let rows = 1, rx = 18;
      for (const n of greetz) {
        const w = this.drawnW(n, n === 'YOU' ? 2.2 : scale) + 16;
        if (rx + w > W - 14) { rows++; rx = 18; }
        rx += w;
      }
      if (48 + rows * lineH > 150) { scale = 1.1; lineH = 19; }
    }
    let x = 18, y = 48;
    for (const n of greetz) {
      const s = n === 'YOU' ? 2.2 : scale;
      const w = this.drawnW(n, s);
      if (x + w > W - 14) { x = 18; y += lineH; }
      for (const ch of n) {
        const gl = this.font.get(ch);
        if (!gl) { x += 8 * s * 0.5; continue; }
        c.drawImage(gl.cv, x, y + (n === 'YOU' ? -4 : 0), gl.w * s, gl.h * s);
        x += gl.w * s + 2;
      }
      x += 16;
    }
    c.restore();
    this.copperBar(6, 1.3);
    this.copperBar(H - 30, 4.3);
  }

  private lastDraftLen = 0;
  private flashStart = -9;
  private flashIdx = -1;

  // the typed name row — shared by the bios, the slit, and the intro fade,
  // so the word you typed and the word that waves are one continuous object
  private drawDraft(shown: string, t: number, alpha = 1, fade?: (i: number) => number) {
    const c = this.ctx;
    const w = this.drawnW(shown, 2);
    let x = (W - w) / 2;
    let i = 0;
    for (const ch of shown) {
      const gl = this.font.get(ch);
      if (!gl) { x += this.font.px * 0.5 * 2 + 2; i++; continue; }
      const a = fade ? alpha * fade(i) : alpha;
      if (a > 0) {
        c.globalAlpha = a;
        const flashing = i === this.flashIdx && t - this.flashStart < 0.28;
        if (flashing && a >= 1) c.drawImage(this.hotGlyph(ch, 2), x, 96);
        else c.drawImage(gl.cv, x, 96, gl.w * 2, gl.h * 2);
      }
      x += gl.w * 2 + 2;
      i++;
    }
    c.globalAlpha = 1;
    return x;
  }

  // bios/landing: static starfield + boot text, name typed live.
  // a path with a slash lands here too, honestly labelled
  renderBios(t: number, draft: string, badPath = false) {
    const c = this.ctx;
    c.fillStyle = '#05050a';
    c.fillRect(0, 0, W, H);
    this.starfield(t * 0.15);
    const shown = (draft.toUpperCase() || '').slice(0, 12);
    if (shown.length > this.lastDraftLen) { this.flashStart = t; this.flashIdx = shown.length - 1; }
    this.lastDraftLen = shown.length;
    this.tinyText(badPath ? 'NOT A NAME' : 'TYPE A NAME', 52, t, 2);
    const x = this.drawDraft(shown, t);
    if (Math.floor(t * 2) % 2 === 0) {
      c.fillStyle = this.ramp[6];
      c.fillRect(x, 96 + 18, 14, 3);
    }
    if (shown) this.tinyText('PRESS ENTER', 138, t, 1);
    // a keystroke kicks the copper — the machine reacts too
    const flash = t - this.flashStart < 0.28;
    this.copper(t, 8, 178, flash ? 6 : 0, flash ? 3 : 0);
  }

  // a pixel power key — the visible boot target on touch, drawn pressed
  // while the gesture is held
  private powerKey(cx: number, cy: number, pressed: boolean) {
    const c = this.ctx;
    const bm = [
      '....#....',
      '....#....',
      '.#..#..#.',
      '#...#...#',
      '#...#...#',
      '#.......#',
      '.#.....#.',
      '..#####..',
    ];
    const s = 2, ox = cx - bm[0].length, oy = cy - bm.length + (pressed ? 1 : 0);
    c.fillStyle = pressed ? this.ramp[7] : this.ramp[5];
    for (let y = 0; y < bm.length; y++)
      for (let x = 0; x < bm[y].length; x++)
        if (bm[y][x] === '#') c.fillRect(ox + x * s, oy + y * s, s, s);
  }

  // preboot: the demo, paused and dimmed, waiting for the gesture.
  // the words stay on the glass — only the dashes breathe — plus a power key
  // parked in open starfield, clear of the copper
  renderPreboot(t: number, touch = false, pressed = false) {
    this.renderClassic(0, false);
    const c = this.ctx;
    c.fillStyle = 'rgba(4,4,10,0.62)';
    c.fillRect(0, 0, W, H);
    const core = touch ? 'TAP TO BOOT' : 'PRESS ANY KEY TO BOOT';
    const full = '- ' + core + ' -';
    let s = 2;
    while (s > 1 && this.drawnW(full, s) > W - 16) s -= 0.5;
    const y = H / 2 - 10;
    this.tinyText(core, y, 0, s);
    if ((t * 1.5) % 1 < 0.75) {
      // the dashes blink, the words hold
      const x0 = (W - this.drawnW(full, s)) / 2;
      const gl = this.font.get('-');
      if (gl) {
        c.drawImage(gl.cv, x0, y, gl.w * s, gl.h * s);
        c.drawImage(gl.cv, x0 + this.drawnW(full, s) - gl.w * s, y, gl.w * s, gl.h * s);
      }
    }
    // on touch the DOM rocker under the tube is the control — the glass
    // keeps its standby mark only where it is the control
    if (!touch) this.powerKey(W / 2, y + 44, pressed);
  }

  // crt power-on: the beam collapses in, then the slit opens. coming from the
  // landing it opens on the typed name itself; from a permalink on the frame.
  renderPowerOn(u: number, draft: string | null = null, t = 0) {
    const c = this.ctx;
    if (u < 0.12) {
      c.fillStyle = '#05050a';
      c.fillRect(0, 0, W, H);
      c.fillStyle = '#ffffff';
      c.fillRect(0, H / 2 - 1, W, 3);
      return;
    }
    if (draft) {
      // the slit opens on the typed word alone — already sitting in the cells
      // the chrome will cover, so the handoff is one continuous object
      c.fillStyle = '#05050a';
      c.fillRect(0, 0, W, H);
      this.starfield(t * 0.15);
      this.drawDraft(draft.toUpperCase().slice(0, 12), t);
    } else {
      this.renderClassic(0, false, false);
    }
    const o = (u - 0.12) / 0.88;
    const hh = (1 - o) * (H / 2);
    c.fillStyle = '#05050a';
    c.fillRect(0, 0, W, hh);
    c.fillRect(0, H - hh, W, hh);
    if (hh > 0.5) {
      c.fillStyle = this.ramp[7];
      c.fillRect(0, hh - 1, W, 1);
      c.fillRect(0, H - hh, W, 1);
    }
  }

  // prefers-reduced-motion: one frozen frame, honestly labelled in open
  // pixels — a complete parked scrolltext line, and the state of the tune.
  // a deck pin wins, so the still shows the thing being edited
  renderReduced(greetz: string[] = []) {
    if (this.previewMode === 'greetz') { this.renderGreetzBoard(greetz); }
    else if (this.previewMode === 'plasma') this.renderPlasma(0);
    else if (this.previewMode === 'copper') this.renderCopper(0);
    else if (this.previewMode === 'blitter') this.renderBlitter(0);
    else this.renderClassic(2, true, false);
    const line = this.scrolltext.split('+++')[0].trim();
    let s = 2;
    while (s > 1 && this.drawnW(line, s) > W - 16) s -= 0.5;
    this.tinyText(line, H - 34, 0, s);
    this.tinyText('- MOTION OFF -', 112, 0);
    this.tinyText(this.muted ? 'M TO UNMUTE THE TUNE' : 'THE TUNE STILL PLAYS', 128, 0, 1);
  }

  // the first beat after boot: the real baked logo lands letter by letter,
  // each one glowing hot over its own chrome. u is seconds since the slit
  // opened; t is the section clock and the trail is drawn from the first
  // column, so the last intro frame IS the first classic frame — no cut.
  renderIntro(u: number, t: number, draft: string | null = null) {
    const c = this.ctx;
    c.fillStyle = '#05050a';
    c.fillRect(0, 0, W, H);
    this.starfield(t);
    this.copper(t);
    const hot = this.solidLogo(this.ramp[6]);
    const x0 = (W - this.logo.w) / 2;
    const draws = [{ d: -0.11, a: 0.25 }, { d: -0.055, a: 0.45 }, { d: 0, a: 1 }];
    const nLetters = Math.max(...this.colLetter) + 1;
    // each typed letter holds its cell until its own chrome column lands on
    // that spot, then hands off — one object, never a cut
    if (draft) {
      this.drawDraft(draft.toUpperCase().slice(0, 12), t, 1, (i) => {
        const ap = 0.25 + i * 0.1;
        return u < ap ? 1 : Math.max(0, 1 - (u - ap) / 0.18);
      });
    }
    // chrome letters land on the typed name's own baseline, then the whole
    // word lifts into its wave — one object, not a replacement
    const cy0 = draft ? 104 - this.logo.h / 2 : H * 0.3;
    const lift = 0.25 + nLetters * 0.1 + 0.15;
    const k = draft ? Math.min(1, Math.max(0, (u - lift) / 0.45)) : 1;
    const e = k * k * (3 - 2 * k);
    const cy = cy0 + (H * 0.3 - cy0) * e;
    for (let x = 0; x < this.logo.w; x++) {
      const li = this.colLetter[x];
      if (li < 0) continue;
      const appear = 0.25 + li * 0.1;
      if (u <= appear) continue;
      for (const { d, a } of draws) {
        const y = cy + Math.sin((t + d) * 2.6 + x * 0.045) * 9;
        c.globalAlpha = a;
        c.drawImage(this.logo.cv, x, 0, 1, this.logo.h, x0 + x, y, 1, this.logo.h);
      }
      c.globalAlpha = 1;
      if (u - appear < 0.22) {
        // hot additive glow over the landing columns — chrome, brighter
        const y = cy + Math.sin(t * 2.6 + x * 0.045) * 9;
        c.globalCompositeOperation = 'lighter';
        c.drawImage(hot, x, 0, 1, this.logo.h, x0 + x, y, 1, this.logo.h);
        c.globalCompositeOperation = 'source-over';
      }
    }
    // the scroller waits for the whole name, then slides in from the right
    if (u > 0.25 + nLetters * 0.1 + 0.15) this.scroller(t);
  }

  muted = false;
  // while the deck is open it can pin the tube to the part being edited —
  // a knob you can't see move isn't a knob. '' means free rotation; a
  // section id pins that section; 'scroll' pins the classic scroller
  previewMode: '' | 'scroll' | 'greetz' | SectionId = '';

  // returns true when a pin owns the frame — shared by the live loop and
  // the reduced-motion still so the pin works in both
  private renderPinned(t: number, greetz: string[]): boolean {
    const m = this.previewMode;
    if (!m) return false;
    const lt = t - Math.floor(t / 9) * 9;
    if (m === 'greetz') this.renderGreetzBoard(greetz);
    else if (m === 'scroll' || m === 'classic') this.renderClassic(lt);
    else if (m === 'plasma') this.renderPlasma(lt);
    else if (m === 'copper') this.renderCopper(lt);
    else this.renderBlitter(lt);
    return true;
  }

  renderLoop(t: number, greetz: string[]) {
    if (this.renderPinned(t, greetz)) return;
    const i = Math.floor(t / 9) % (this.sections.length + 1);
    const lt = t - Math.floor(t / 9) * 9;
    if (i === this.sections.length) this.renderGreetz(lt, greetz);
    else {
      const s = this.sections[i];
      if (s === 'classic') this.renderClassic(lt);
      else if (s === 'plasma') this.renderPlasma(lt);
      else if (s === 'copper') this.renderCopper(lt);
      else this.renderBlitter(lt);
    }
    // sections never teleport: a copper-clock wipe reveals the new frame
    this.wipe(lt / 0.45);
    if (this.muted) this.tinyText('SND OFF', 3, 0, 1);
  }

  // dark shutters parting from center, edged with the ramp — one transition
  // grammar for section changes and the landing -> preboot beat
  wipe(u: number) {
    if (u >= 1) return;
    const c = this.ctx;
    const half = Math.round((1 - u) * W * 0.55);
    c.fillStyle = '#05050a';
    c.fillRect(0, 0, half, H);
    c.fillRect(W - half, 0, half, H);
    c.fillStyle = this.ramp[4];
    c.fillRect(half, 0, 2, H);
    c.fillRect(W - half - 2, 0, 2, H);
  }

  // a wall of raster bars — the full screen breathing in the name's ramp,
  // each bar riding its own sine so the field rolls like sheet metal
  renderCopper(t: number) {
    const c = this.ctx;
    c.fillStyle = this.ramp[0];
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 7; i++) {
      const y = -8 + i * 30 + Math.sin(t * 1.3 + i * 0.9) * 14;
      this.copperBar(y, t * 3 + i * 1.7);
    }
    this.waveLogo(t, H * 0.34);
    this.scroller(t);
  }

  renderBlitter(t: number) {
    const c = this.ctx;
    c.fillStyle = '#05050a';
    c.fillRect(0, 0, W, H);
    this.starfield(t);
    this.copper(t);
    // the blitter's bounce is its identity — but the logo dial still rules:
    // still parks it mid-band, wave bends the same flight per column
    if (this.logoMode === 'still') {
      c.drawImage(this.logo.cv, (W - this.logo.w) / 2, (134 - this.logo.h) / 2 + 10);
    } else {
      for (const [d, a] of [[-0.09, 0.2], [-0.045, 0.4], [0, 1]] as const) {
        c.globalAlpha = a;
        const p = this.bouncePos(t + d);
        if (this.logoMode === 'wave') {
          for (let x = 0; x < this.logo.w; x++) {
            const y = p[1] + Math.sin((t + d) * 2.6 + x * 0.045) * 7;
            c.drawImage(this.logo.cv, x, 0, 1, this.logo.h, p[0] + x, y, 1, this.logo.h);
          }
        } else {
          c.drawImage(this.logo.cv, p[0], p[1]);
        }
      }
      c.globalAlpha = 1;
    }
    this.scroller(t);
  }
}
