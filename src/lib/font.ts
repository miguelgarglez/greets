// rasterizes Press Start 2P glyphs into tight bitmap canvases.
// the font is OFL; we bundle the ttf and crop each glyph's ink box.
export interface Glyph { cv: HTMLCanvasElement; w: number; h: number; ox: number; oy: number }
export interface PixelFont { px: number; get(c: string): Glyph | null; textW(s: string, spacing?: number): number }

export async function loadPixelFont(px = 8): Promise<PixelFont> {
  const face = new FontFace('PS2P', 'url(/fonts/press-start-2p.ttf)');
  await face.load();
  document.fonts.add(face);
  await document.fonts.ready;

  const cache = new Map<string, Glyph>();
  const scratch = document.createElement('canvas');
  scratch.width = scratch.height = px * 3;
  const sx = scratch.getContext('2d', { willReadFrequently: true })!;

  function get(c: string): Glyph | null {
    if (c === ' ') return null;
    let g = cache.get(c);
    if (g) return g;
    sx.clearRect(0, 0, scratch.width, scratch.height);
    sx.font = `${px}px PS2P`;
    sx.textBaseline = 'top';
    sx.fillStyle = '#fff';
    sx.fillText(c, px, px);
    const img = sx.getImageData(0, 0, scratch.width, scratch.height).data;
    let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
    for (let y = 0; y < scratch.height; y++)
      for (let x = 0; x < scratch.width; x++)
        if (img[(y * scratch.width + x) * 4 + 3] > 40) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
    if (x1 < 0) { cache.set(c, null as unknown as Glyph); return null; }
    const cv = document.createElement('canvas');
    cv.width = x1 - x0 + 1; cv.height = y1 - y0 + 1;
    const ctx = cv.getContext('2d')!;
    ctx.font = `${px}px PS2P`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    ctx.fillText(c, px - x0, px - y0);
    g = { cv, w: cv.width, h: cv.height, ox: x0 - px, oy: y0 - px };
    cache.set(c, g);
    return g;
  }

  return {
    px,
    get,
    textW(s, spacing = 1) {
      let w = 0;
      for (const c of s) w += (get(c)?.w ?? px * 0.5) + spacing * (px / 4);
      return w;
    },
  };
}

// bake a colored logo strip: every char upscaled `scale`× with a vertical
// two-stop gradient (classic cracktro shading), returns one canvas + column map
export function bakeLogo(font: PixelFont, text: string, scale: number, stops: [number, string][]): { cv: HTMLCanvasElement; w: number; h: number } {
  const spacing = Math.round(font.px * scale * 0.12);
  const chars = [...text.toUpperCase()].map((c) => font.get(c));
  const w = chars.reduce((a, g) => a + (g?.w ?? font.px * 0.5) * scale + spacing, 0) - spacing;
  const h = font.px * 1.1 * scale;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w); cv.height = Math.ceil(h);
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  let x = 0;
  for (const g of chars) {
    if (!g) { x += font.px * 0.5 * scale + spacing; continue; }
    // draw upscaled then paint the gradient over the ink
    const tmp = document.createElement('canvas');
    tmp.width = g.w * scale; tmp.height = g.h * scale;
    const tc = tmp.getContext('2d')!;
    tc.imageSmoothingEnabled = false;
    tc.drawImage(g.cv, 0, 0, tmp.width, tmp.height);
    const grad = tc.createLinearGradient(0, 0, 0, tmp.height);
    for (const [o, col] of stops) grad.addColorStop(o, col);
    tc.globalCompositeOperation = 'source-in';
    tc.fillStyle = grad;
    tc.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(tmp, x, (h - tmp.height) / 2);
    x += tmp.width + spacing;
  }
  return { cv, w, h };
}
