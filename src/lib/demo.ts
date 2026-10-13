// the demo — one 320×200 raster canvas, four sections on a 50Hz clock.
// everything is seeded: same name, same demo.
import type { PixelFont } from './font.ts';
import { bakeLogo } from './font.ts';
import { mulberry32, pick, shuffle } from './prng.ts';

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

export interface DemoAssets {
  font: PixelFont;
  name: string;
  seed: number;
  ramp: RampName;
  scrolltext: string;
}

interface Star { x: number; y: number; z: number }

export class Demo {
  private ctx: CanvasRenderingContext2D;
  private font: PixelFont;
  private logo: { cv: HTMLCanvasElement; w: number; h: number };
  private stars: Star[];
  private ramp: string[];
  private scrolltext: string;
  private plasmaImg: ImageData;
  private plasmaPal: Uint32Array;
  private sections: string[];
  private colLetter: Int16Array;

  constructor(cv: HTMLCanvasElement, a: DemoAssets) {
    cv.width = W; cv.height = H;
    this.ctx = cv.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.font = a.font;
    this.ramp = RAMPS[a.ramp];
    this.scrolltext = a.scrolltext;
    const rng = mulberry32(a.seed);
    this.stars = Array.from({ length: 150 }, () => ({ x: rng() * W, y: rng() * H, z: pick(rng, [0.25, 0.55, 1]) }));
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
    this.plasmaImg = new ImageData(W, H);
    this.plasmaPal = this.buildPlasmaPalette(a.ramp);
    this.sections = shuffle(rng, ['classic', 'plasma', 'blitter']);
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
    const x0 = (W - this.logo.w) / 2;
    const draws = trail ? [{ d: -0.11, a: 0.25 }, { d: -0.055, a: 0.45 }, { d: 0, a: 1 }] : [{ d: 0, a: 1 }];
    for (const { d, a } of draws) {
      c.globalAlpha = a;
      for (let x = 0; x < this.logo.w; x++) {
        const y = cy + Math.sin((t + d) * 2.6 + x * 0.045) * 9;
        c.drawImage(this.logo.cv, x, 0, 1, this.logo.h, x0 + x, y, 1, this.logo.h);
      }
    }
    c.globalAlpha = 1;
  }

  private scroller(t: number, scale = 2, yBase = H - 24) {
    const c = this.ctx;
    const speed = 55;
    const adv = this.font.px * scale * 1.0;
    const total = this.scrolltext.length * adv + W + 40;
    const off = (t * speed) % total;
    let x = W - off;
    for (let i = 0; i < this.scrolltext.length; i++) {
      const g = this.font.get(this.scrolltext[i]);
      const cw = g ? g.w * scale : adv * 0.6;
      if (x > -adv && x < W + adv && g) {
        const y = yBase + Math.sin(t * 3.2 + x * 0.055) * 5;
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
          + Math.sin(Math.hypot(x - W / 2, y - H / 2) * 0.05 - t * 1.3);
        const idx = Math.max(0, Math.min(63, Math.round((v + 4) / 8 * 63)));
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
    m.fillStyle = 'rgba(3,3,8,0.96)';
    m.fillRect(0, 0, W, H);
    m.globalCompositeOperation = 'destination-out';
    m.drawImage(this.logo.cv, (W - this.logo.w) / 2, H * 0.3 + Math.sin(t * 1.2) * 6);
    c.drawImage(this.plasmaMaskCv, 0, 0);
    this.copper(t);
    this.scroller(t);
  }

  renderGreetz(t: number, greetz: string[]) {
    const c = this.ctx;
    c.fillStyle = '#05050a';
    c.fillRect(0, 0, W, H);
    // the roll owns the middle band: copper parked at the margins, no scroller
    c.save();
    c.beginPath();
    c.rect(0, 34, W, H - 64);
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

  private lastDraftLen = 0;
  private flashStart = -9;
  private flashIdx = -1;

  // bios/landing: static starfield + boot text, name typed live
  renderBios(t: number, draft: string) {
    const c = this.ctx;
    c.fillStyle = '#05050a';
    c.fillRect(0, 0, W, H);
    this.starfield(t * 0.15);
    this.tinyText('TYPE A NAME', 52, t, 2);
    const shown = (draft.toUpperCase() || '').slice(0, 12);
    if (shown.length > this.lastDraftLen) { this.flashStart = t; this.flashIdx = shown.length - 1; }
    this.lastDraftLen = shown.length;
    const w = this.font.textW(shown, 0) * 2;
    let x = (W - w) / 2;
    let i = 0;
    for (const ch of shown) {
      const gl = this.font.get(ch);
      if (!gl) { x += 10; i++; continue; }
      const flashing = i === this.flashIdx && t - this.flashStart < 0.28;
      // the new letter lands in the ramp's hot stop, then settles to white
      if (flashing) c.drawImage(this.hotGlyph(ch, 2), x, 96);
      else c.drawImage(gl.cv, x, 96, gl.w * 2, gl.h * 2);
      x += gl.w * 2 + 2;
      i++;
    }
    if (Math.floor(t * 2) % 2 === 0) {
      c.fillStyle = this.ramp[6];
      c.fillRect(x, 96 + 18, 14, 3);
    }
    // a keystroke kicks the copper — the machine reacts too
    const flash = t - this.flashStart < 0.28;
    this.copper(t, 8, 178, flash ? 6 : 0, flash ? 3 : 0);
  }

  // preboot: the demo, paused and dimmed, waiting for the gesture.
  // one blinking boot line and nothing else — the name hasn't arrived yet
  renderPreboot(t: number, touch = false) {
    this.renderClassic(0, false);
    const c = this.ctx;
    c.fillStyle = 'rgba(4,4,10,0.62)';
    c.fillRect(0, 0, W, H);
    if ((t * 1.5) % 1 < 0.75) {
      const msg = touch ? '- TAP TO BOOT -' : '- PRESS ANY KEY TO BOOT -';
      // biggest scale whose real drawn width still fits the raster
      let s = 2;
      while (s > 1 && this.drawnW(msg, s) > W - 16) s -= 0.5;
      this.tinyText(msg, H / 2 + 28, 0, s);
    }
  }

  // crt power-on: the beam collapses in, then the slit opens into the demo
  renderPowerOn(u: number) {
    const c = this.ctx;
    if (u < 0.12) {
      c.fillStyle = '#05050a';
      c.fillRect(0, 0, W, H);
      c.fillStyle = '#ffffff';
      c.fillRect(0, H / 2 - 1, W, 3);
      return;
    }
    this.renderClassic(0, false, false);
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

  // prefers-reduced-motion: one frozen frame, honestly labelled
  renderReduced() {
    this.renderClassic(2);
    this.tinyText('- MOTION OFF -', H * 0.78, 0);
  }

  // the first beat after boot: the real baked logo lands letter by letter,
  // each one glowing hot over its own chrome. u is seconds since the slit
  // opened; t is the section clock and the trail is drawn from the first
  // column, so the last intro frame IS the first classic frame — no cut.
  renderIntro(u: number, t: number) {
    const c = this.ctx;
    c.fillStyle = '#05050a';
    c.fillRect(0, 0, W, H);
    this.starfield(t);
    this.copper(t);
    const hot = this.solidLogo(this.ramp[6]);
    const x0 = (W - this.logo.w) / 2;
    const draws = [{ d: -0.11, a: 0.25 }, { d: -0.055, a: 0.45 }, { d: 0, a: 1 }];
    const nLetters = Math.max(...this.colLetter) + 1;
    for (let x = 0; x < this.logo.w; x++) {
      const li = this.colLetter[x];
      if (li < 0) continue;
      const appear = 0.25 + li * 0.1;
      if (u <= appear) continue;
      for (const { d, a } of draws) {
        const y = H * 0.3 + Math.sin((t + d) * 2.6 + x * 0.045) * 9;
        c.globalAlpha = a;
        c.drawImage(this.logo.cv, x, 0, 1, this.logo.h, x0 + x, y, 1, this.logo.h);
      }
      c.globalAlpha = 1;
      if (u - appear < 0.22) {
        // hot additive glow over the landing columns — chrome, brighter
        const y = H * 0.3 + Math.sin(t * 2.6 + x * 0.045) * 9;
        c.globalCompositeOperation = 'lighter';
        c.drawImage(hot, x, 0, 1, this.logo.h, x0 + x, y, 1, this.logo.h);
        c.globalCompositeOperation = 'source-over';
      }
    }
    // the scroller waits for the whole name, then slides in from the right
    if (u > 0.25 + nLetters * 0.1 + 0.15) this.scroller(t);
  }

  renderLoop(t: number, greetz: string[]) {
    const i = Math.floor(t / 9) % (this.sections.length + 1);
    const lt = t - Math.floor(t / 9) * 9;
    if (i === this.sections.length) this.renderGreetz(lt, greetz);
    else {
      const s = this.sections[i];
      if (s === 'classic') this.renderClassic(lt);
      else if (s === 'plasma') this.renderPlasma(lt);
      else this.renderBlitter(lt);
    }
    // sections never teleport: a copper-clock wipe reveals the new frame
    this.wipe(lt / 0.45);
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

  renderBlitter(t: number) {
    const c = this.ctx;
    c.fillStyle = '#05050a';
    c.fillRect(0, 0, W, H);
    this.starfield(t);
    this.copper(t);
    // the logo bounces dvd-style with trail, clamped to the band between the
    // copper bars; cosine easing so the turns read as motion, not math
    const lw = this.logo.w, lh = this.logo.h;
    // the red foot must clear the lower copper — clamp a few px above it
    const yTop = 42, yBot = Math.max(yTop + 8, 134 - lh);
    const bh = yBot - yTop, bw = W - lw;
    const bounceX = (tt: number) => bw * (0.5 - 0.5 * Math.cos(tt * 80 * Math.PI / bw));
    const bounceY = (tt: number) => yTop + bh * (0.5 - 0.5 * Math.cos(tt * 55 * Math.PI / bh));
    for (const [d, a] of [[-0.09, 0.2], [-0.045, 0.4]] as const) {
      c.globalAlpha = a;
      c.drawImage(this.logo.cv, bounceX(t + d), bounceY(t + d));
    }
    c.globalAlpha = 1;
    c.drawImage(this.logo.cv, bounceX(t), bounceY(t));
    this.scroller(t);
  }
}
