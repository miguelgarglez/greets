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

  constructor(cv: HTMLCanvasElement, a: DemoAssets) {
    cv.width = W; cv.height = H;
    this.ctx = cv.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.font = a.font;
    this.ramp = RAMPS[a.ramp];
    this.scrolltext = a.scrolltext;
    const rng = mulberry32(a.seed);
    this.stars = Array.from({ length: 150 }, () => ({ x: rng() * W, y: rng() * H, z: pick(rng, [0.25, 0.55, 1]) }));
    const scale = a.name.length <= 7 ? 4 : a.name.length <= 10 ? 3 : 2;
    this.logo = bakeLogo(a.font, a.name, scale, [[0, '#ffffff'], [0.55, '#e8e8ff'], [0.8, this.ramp[4]], [1, this.ramp[2]]]);
    this.plasmaImg = new ImageData(W, H);
    this.plasmaPal = this.buildPlasmaPalette(a.ramp);
    this.sections = shuffle(rng, ['classic', 'plasma', 'blitter']);
  }

  private buildPlasmaPalette(ramp: RampName): Uint32Array {
    const r = RAMPS[ramp];
    const pal = new Uint32Array(64);
    for (let i = 0; i < 64; i++) {
      const f = i / 63 * (r.length - 1);
      const c = r[Math.round(f)];
      const n = parseInt(c.slice(1), 16);
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

  private copper(t: number, topY = 10, botY = 146) {
    const w = Math.sin(t * 1.7) * 4;
    this.copperBar(topY + w, t * 3);
    this.copperBar(botY - w, t * 3 + 3);
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

  private scroller(t: number, scale = 2, yBase = H - 20) {
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

  // tiny centered line of pixel text inside the demo frame
  private tinyText(str: string, y: number, t: number) {
    const c = this.ctx;
    let x = (W - this.font.textW(str, 0)) / 2;
    for (const ch of str) {
      const gl = this.font.get(ch);
      if (!gl) { x += 5; continue; }
      const bob = Math.sin(t * 2 + x * 0.08) * 1;
      c.drawImage(gl.cv, x, y + bob, gl.w, gl.h);
      x += gl.w + 1;
    }
  }

  renderClassic(t: number) {
    const c = this.ctx;
    c.fillStyle = '#05050a';
    c.fillRect(0, 0, W, H);
    this.starfield(t);
    this.copper(t);
    this.waveLogo(t, H * 0.3);
    this.tinyText('- ANOTHER GREETS DEV PRODUCTION -', H * 0.56, t);
    this.scroller(t);
  }

  private solidCache = new Map<string, HTMLCanvasElement>();
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

  renderPlasma(t: number) {
    this.plasma(t);
    // the name carved out of the plasma: hot outline, black fill
    const c = this.ctx;
    const x0 = (W - this.logo.w) / 2, y0 = (H - this.logo.h) / 2 + Math.sin(t * 1.2) * 6;
    const hot = this.solidLogo(this.ramp[this.ramp.length - 2]);
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2]] as const)
      c.drawImage(hot, x0 + dx, y0 + dy);
    c.drawImage(this.solidLogo('#050508'), x0, y0);
    this.copper(t, 8, 162);
    this.scroller(t, 2, H - 20);
  }

  renderGreetz(t: number, greetz: string[]) {
    const c = this.ctx;
    c.fillStyle = '#05050a';
    c.fillRect(0, 0, W, H);
    this.copper(t, 6, 168);
    const lineH = 22;
    const total = greetz.length * lineH;
    const off = (t * 34) % (total + H) - lineH;
    c.textBaseline = 'top';
    greetz.forEach((n, i) => {
      const y = H - off - i * lineH;
      if (y < -lineH || y > H + lineH) return;
      const scale = n === 'YOU' ? 2.6 : 2;
      let x = (W - this.font.textW(n, 0) * scale) / 2;
      for (const ch of n) {
        const gl = this.font.get(ch);
        if (!gl) { x += 8 * scale * 0.5; continue; }
        const bounce = n === 'YOU' ? Math.sin(t * 4 + x * 0.05) * 3 : 0;
        c.drawImage(gl.cv, x, y + bounce, gl.w * scale, gl.h * scale);
        x += gl.w * scale + 2;
      }
    });
    this.scroller(t);
  }

  // bios/landing: static starfield + boot text, name typed live
  renderBios(t: number, draft: string) {
    const c = this.ctx;
    c.fillStyle = '#05050a';
    c.fillRect(0, 0, W, H);
    this.starfield(t * 0.15);
    this.tinyText('GREETS BIOS v1.0', 30, t);
    this.tinyText('TYPE A NAME - PRESS ENTER', 58, t);
    // the draft in big letters, cursor blinking
    const shown = (draft.toUpperCase() || '').slice(0, 12);
    const w = this.font.textW(shown, 0) * 2;
    let x = (W - w) / 2;
    for (const ch of shown) {
      const gl = this.font.get(ch);
      if (!gl) { x += 10; continue; }
      c.drawImage(gl.cv, x, 96, gl.w * 2, gl.h * 2);
      x += gl.w * 2 + 2;
    }
    if (Math.floor(t * 2) % 2 === 0) {
      c.fillStyle = '#e8e8ff';
      c.fillRect(x, 96 + 18, 14, 3);
    }
    this.copper(t, 8, 178);
  }

  // preboot: the demo, paused and dimmed, waiting for the gesture
  renderPreboot(t: number) {
    this.renderClassic(0);
    const c = this.ctx;
    c.fillStyle = 'rgba(4,4,10,0.62)';
    c.fillRect(0, 0, W, H);
    if (Math.floor(t * 1.6) % 2 === 0) {
      this.tinyText('- PRESS ANY KEY TO BOOT -', H / 2 + 30, 0);
    }
    this.tinyText('GREETS BIOS READY', 26, t);
  }

  // crt power-on: u 0..1 — dot → horizontal line → full frame
  renderPowerOn(u: number) {
    const c = this.ctx;
    c.fillStyle = '#05050a';
    c.fillRect(0, 0, W, H);
    const e = 1 - Math.pow(1 - u, 3);
    if (u < 0.35) {
      const lw = e * W * 1.2;
      c.fillStyle = '#ffffff';
      c.fillRect(W / 2 - lw / 2, H / 2 - 1, lw, 2);
    } else {
      const hh = ((u - 0.35) / 0.65) * (H / 2);
      c.fillStyle = '#dcdcff';
      c.fillRect(0, H / 2 - hh, W, hh * 2);
    }
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
  }

  renderBlitter(t: number) {
    const c = this.ctx;
    c.fillStyle = '#05050a';
    c.fillRect(0, 0, W, H);
    this.starfield(t);
    this.copper(t, 6, 168);
    // the logo bounces dvd-style with squish + trail
    const lw = this.logo.w, lh = this.logo.h;
    const bx = Math.abs(((t * 80) % (2 * (W - lw))) - (W - lw));
    const by = Math.abs(((t * 55) % (2 * (H - 60 - lh))) - (H - 60 - lh)) + 10;
    for (const [d, a] of [[-0.09, 0.2], [-0.045, 0.4]] as const) {
      c.globalAlpha = a;
      const px = Math.abs(((t + d) * 80) % (2 * (W - lw)) - (W - lw));
      const py = Math.abs(((t + d) * 55) % (2 * (H - 60 - lh)) - (H - 60 - lh)) + 10;
      c.drawImage(this.logo.cv, px, py);
    }
    c.globalAlpha = 1;
    c.drawImage(this.logo.cv, bx, by);
    this.scroller(t);
  }
}
