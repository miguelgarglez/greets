// export — prints the live demo to a file.
// GIF: a seamless ping-pong loop of the first section on a 600px square.
// video: 1280x720 — a real mp4 with the tune when WebCodecs can encode one,
// else a MediaRecorder take of the same composition (mp4 on Safari, webm
// elsewhere).
import { Demo, W, H, RAMPS } from './demo.ts';
import type { DemoAssets, RampName } from './demo.ts';
import { bakeLogo } from './font.ts';
import type { PixelFont } from './font.ts';
import type { Tune } from './tune.ts';
import { renderTune } from './synth.ts';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export interface Progress { (frac: number, label: string): void }
export interface Exported { blob: Blob; ext: 'gif' | 'mp4' | 'webm'; w: number; h: number; seconds: number; thumb: string }

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

// a small polaroid of the last rendered frame — the deck's result chip shows
// it so a finished export lands as an artifact, not a filename
function thumbOf(src: HTMLCanvasElement): string {
  const t = document.createElement('canvas');
  t.width = 96; t.height = 96;
  const c = t.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  const s = Math.min(96 / src.width, 96 / src.height);
  const w = Math.round(src.width * s), h = Math.round(src.height * s);
  c.fillStyle = '#05050a';
  c.fillRect(0, 0, 96, 96);
  c.drawImage(src, (96 - w) / 2, (96 - h) / 2, w, h);
  return t.toDataURL('image/png');
}

// one demo raster composed into an export frame: the tube picture centered
// on a dark matte, split from the matte by two copper hairlines
function composite(out: CanvasRenderingContext2D, src: HTMLCanvasElement, ramp: string[], dw: number, dh: number) {
  const W2 = out.canvas.width, H2 = out.canvas.height;
  out.imageSmoothingEnabled = false;
  out.fillStyle = '#05050a';
  out.fillRect(0, 0, W2, H2);
  const x = Math.round((W2 - dw) / 2), y = Math.round((H2 - dh) / 2);
  out.drawImage(src, x, y, dw, dh);
  out.fillStyle = ramp[4];
  if (H2 > dh) {
    out.fillRect(0, y - 3, W2, 2);
    out.fillRect(0, y + dh + 1, W2, 2);
  } else {
    out.fillRect(x - 3, 0, 2, H2);
    out.fillRect(x + dw + 1, 0, 2, H2);
  }
}

function freshDemo(assets: DemoAssets): { demo: Demo; cv: HTMLCanvasElement } {
  const cv = document.createElement('canvas');
  return { demo: new Demo(cv, assets), cv };
}

// ---------- GIF ----------

const GIF_SIZE = 600, GIF_FPS = 15, GIF_SECONDS = 4;
const GIF_DEMO_H = Math.round(GIF_SIZE * H / W);          // 375 — the picture
const GIF_LABEL_H = GIF_SIZE - GIF_DEMO_H - 2;            // 223 — the disk-label band under it

// the square frame is a card, not a letterbox: demo picture on top, a printed
// label band below — name in logo shading, credits small, copper rules, the
// same scanline texture as the tube
function bakeLabel(font: PixelFont, name: string, credits: string, ramp: string[]): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = GIF_SIZE; cv.height = GIF_LABEL_H;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#0a0a10';
  c.fillRect(0, 0, GIF_SIZE, GIF_LABEL_H);
  c.fillStyle = 'rgba(0,0,0,0.28)';
  for (let y = 1; y < GIF_LABEL_H; y += 3) c.fillRect(0, y, GIF_SIZE, 1);
  let s = 7;
  let logo = bakeLogo(font, name, s, [[0, ramp[6]], [0.5, ramp[4]], [1, ramp[2]]]);
  while (logo.w > GIF_SIZE - 60 && s > 2) { s -= 0.5; logo = bakeLogo(font, name, s, [[0, ramp[6]], [0.5, ramp[4]], [1, ramp[2]]]); }
  c.drawImage(logo.cv, Math.round((GIF_SIZE - logo.w) / 2), 42);
  const ruleW = Math.min(GIF_SIZE - 120, Math.max(160, logo.w));
  c.fillStyle = ramp[4];
  c.fillRect(Math.round((GIF_SIZE - ruleW) / 2), 136, ruleW, 3);
  const sub = bakeLogo(font, credits || 'GREETS', 2, [[0, ramp[5]], [1, ramp[5]]]);
  c.drawImage(sub.cv, Math.round((GIF_SIZE - sub.w) / 2), 162);
  return cv;
}

function compositeSquare(sctx: CanvasRenderingContext2D, src: HTMLCanvasElement, label: HTMLCanvasElement, ramp: string[]) {
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(src, 0, 0, GIF_SIZE, GIF_DEMO_H);
  sctx.fillStyle = ramp[4];
  sctx.fillRect(0, GIF_DEMO_H, GIF_SIZE, 2);
  sctx.drawImage(label, 0, GIF_DEMO_H + 2);
}

export async function exportGif(assets: DemoAssets, greetz: string[], rampName: RampName, credits: string, onProgress: Progress, signal: AbortSignal): Promise<Exported> {
  const { demo, cv } = freshDemo(assets);
  const ramp = RAMPS[rampName];
  const shot = document.createElement('canvas');
  shot.width = shot.height = GIF_SIZE;
  const sctx = shot.getContext('2d', { willReadFrequently: true })!;
  const label = bakeLabel(assets.font, assets.name, credits, ramp);
  // indexed frames — 0.36MB each instead of 1.4MB rgba, and cancelled takes
  // stay cancellable: capture and write both yield and check the signal
  const frames: Uint8Array[] = [];
  const n = Math.round(GIF_SECONDS * GIF_FPS);
  // section 0 sits at t in [0,9); start past the wipe so every frame is full
  const t0 = 0.55;
  // one global palette from the first frame — the demo only uses the ramp,
  // so it quantizes clean and the file stays small
  let palette: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (signal.aborted) throw new DOMException('cancelled', 'AbortError');
    demo.renderLoop(t0 + i / GIF_FPS, greetz);
    compositeSquare(sctx, cv, label, ramp);
    const rgba = new Uint8Array(sctx.getImageData(0, 0, GIF_SIZE, GIF_SIZE).data.buffer);
    if (i === 0) palette = quantize(rgba, 160, { format: 'rgba4444' });
    frames.push(applyPalette(rgba, palette, 'rgba4444'));
    // yield every capture — a cancelled take has to die between frames,
    // not after a synchronous quantize batch
    onProgress(i / n * 0.6, 'SHOOTING FRAMES');
    await nextFrame();
  }
  const gif = GIFEncoder();
  const total = n * 2;
  const order: number[] = [];
  // both endpoints written: the wrap lands on frame 0 exactly — a boomerang
  // that skips its endpoints stutters at the two places the eye watches
  for (let i = 0; i < n; i++) order.push(i);
  for (let i = n - 1; i >= 0; i--) order.push(i);
  for (let i = 0; i < order.length; i++) {
    if (signal.aborted) throw new DOMException('cancelled', 'AbortError');
    // one global palette on the first frame — later frames just index into it
    gif.writeFrame(frames[order[i]], GIF_SIZE, GIF_SIZE, { palette: i === 0 ? palette : undefined, delay: Math.round(1000 / GIF_FPS) });
    if (i % 6 === 0) { onProgress(0.6 + i / order.length * 0.4, 'WEAVING THE LOOP'); await nextFrame(); }
  }
  gif.finish();
  onProgress(1, 'DONE');
  return { blob: new Blob([gif.bytes().slice().buffer as ArrayBuffer], { type: 'image/gif' }), ext: 'gif', w: GIF_SIZE, h: GIF_SIZE, seconds: total / GIF_FPS, thumb: thumbOf(shot) };
}

// ---------- video ----------

const VID_W = 1280, VID_H = 720, VID_FPS = 30, VID_SECONDS = 8.4;
// the take is a portrait, not a surveillance feed: it opens just after the
// wipe on section 0 — the section that carries the name — and cuts before
// the section boundary, so the recipient is on screen first frame to last
const VID_T0 = 0.55;

async function canEncodeMp4(): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return false;
  try {
    const v = await VideoEncoder.isConfigSupported({ codec: 'avc1.42E028', width: VID_W, height: VID_H, framerate: VID_FPS, bitrate: 5_000_000 });
    return !!v.supported;
  } catch { return false; }
}

async function canEncodeAac(): Promise<boolean> {
  if (typeof AudioEncoder === 'undefined') return false;
  try {
    const a = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', numberOfChannels: 2, sampleRate: 44100, bitrate: 128000 });
    return !!a.supported;
  } catch { return false; }
}

async function exportMp4(assets: DemoAssets, greetz: string[], rampName: RampName, pcm: Float32Array | null, onProgress: Progress, signal: AbortSignal): Promise<Exported> {
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const { demo, cv } = freshDemo(assets);
  const ramp = RAMPS[rampName];
  const out = document.createElement('canvas');
  out.width = VID_W; out.height = VID_H;
  const octx = out.getContext('2d')!;

  const hasAudio = !!pcm && (await canEncodeAac());

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: VID_W, height: VID_H },
    ...(hasAudio ? { audio: { codec: 'aac' as const, sampleRate: 44100, numberOfChannels: 2 } } : {}),
    fastStart: 'in-memory',
  });
  const errors: Error[] = [];
  const venc = new VideoEncoder({
    output: (c, m) => muxer.addVideoChunk(c, m),
    error: (e) => errors.push(e),
  });
  venc.configure({ codec: 'avc1.42E028', width: VID_W, height: VID_H, framerate: VID_FPS, bitrate: 5_000_000 });
  const aenc = hasAudio ? new AudioEncoder({
    output: (c, m) => muxer.addAudioChunk(c, m),
    error: (e) => errors.push(e),
  }) : null;
  aenc?.configure({ codec: 'mp4a.40.2', numberOfChannels: 2, sampleRate: 44100, bitrate: 128000 });

  try {
    const dw = Math.round(VID_H * W / H);
    const totalFrames = VID_SECONDS * VID_FPS;
    const bail = () => { if (signal.aborted || errors.length) throw errors[0] ?? new DOMException('cancelled', 'AbortError'); };
    for (let i = 0; i < totalFrames; i++) {
      bail();
      demo.renderLoop(VID_T0 + i / VID_FPS, greetz);
      composite(octx, cv, ramp, dw, VID_H);
      const vf = new VideoFrame(out, { timestamp: Math.round(i * 1e6 / VID_FPS), duration: Math.round(1e6 / VID_FPS) });
      venc.encode(vf, { keyFrame: i % (VID_FPS * 3) === 0 });
      vf.close();
      if (i % 6 === 0) { onProgress(i / totalFrames * 0.85, 'PRINTING FRAMES'); await nextFrame(); }
    }
    if (aenc && pcm) {
      const need = Math.min(pcm.length, VID_SECONDS * 44100);
      const CHUNK = 8192;
      for (let off = 0; off < need; off += CHUNK) {
        bail();
        const len = Math.min(CHUNK, need - off);
        const data = new Float32Array(len * 2);
        for (let s = 0; s < len; s++) { data[s] = pcm[off + s]; data[len + s] = pcm[off + s]; }
        const ad = new AudioData({ format: 'f32-planar', sampleRate: 44100, numberOfFrames: len, numberOfChannels: 2, timestamp: Math.round(off * 1e6 / 44100), data });
        aenc.encode(ad);
        ad.close();
      }
    }
    onProgress(0.9, 'MUXING');
    await venc.flush();
    if (aenc) await aenc.flush();
    bail(); // a cancel that lands mid-flush must not publish a file
    muxer.finalize();
    onProgress(1, 'DONE');
    return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), ext: 'mp4', w: VID_W, h: VID_H, seconds: VID_SECONDS, thumb: thumbOf(out) };
  } finally {
    if (venc.state !== 'closed') venc.close();
    if (aenc && aenc.state !== 'closed') aenc.close();
  }
}

function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of ['video/mp4;codecs="avc1.42E028,mp4a.40.2"', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'])
    if (MediaRecorder.isTypeSupported(m)) return m;
  return null;
}

async function exportRecorded(assets: DemoAssets, greetz: string[], rampName: RampName, pcm: Float32Array | null, audioCtx: AudioContext | null, onProgress: Progress, signal: AbortSignal): Promise<Exported> {
  const mime = pickRecorderMime();
  if (!mime) throw new Error('this browser cannot record video');
  const { demo, cv } = freshDemo(assets);
  const ramp = RAMPS[rampName];
  const out = document.createElement('canvas');
  out.width = VID_W; out.height = VID_H;
  const octx = out.getContext('2d')!;
  const stream = out.captureStream(VID_FPS);
  let src: AudioBufferSourceNode | null = null;
  if (pcm && audioCtx) {
    // the ctx was born in the click's activation window; wake it here —
    // a suspended graph records silence and ships a film without its tune
    try { await audioCtx.resume(); } catch { /* falls through to the check */ }
    if (audioCtx.state !== 'running') { void audioCtx.close(); throw new Error('audio blocked by the browser'); }
    const dest = audioCtx.createMediaStreamDestination();
    src = audioCtx.createBufferSource();
    const buf = audioCtx.createBuffer(1, pcm.length, 44100);
    buf.getChannelData(0).set(pcm);
    src.buffer = buf;
    // the take goes to the file only — the live deck already plays the tune
    src.connect(dest);
    for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
    src.start();
  }
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const parts: Blob[] = [];
  let recErr: Error | null = null;
  rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  rec.onerror = (e) => { recErr = e.error; };
  rec.start(500);

  try {
    const dw = Math.round(VID_H * W / H);
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (signal.aborted || recErr) return resolve();
        const el = (performance.now() - t0) / 1000;
        demo.renderLoop(VID_T0 + el, greetz);
        composite(octx, cv, ramp, dw, VID_H);
        onProgress(Math.min(0.98, el / VID_SECONDS), 'RECORDING LIVE');
        if (el < VID_SECONDS) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    await new Promise<void>((r) => { rec.onstop = () => r(); if (rec.state !== 'inactive') rec.stop(); else r(); });
    if (recErr) throw recErr;
    if (signal.aborted) throw new DOMException('cancelled', 'AbortError');
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    onProgress(1, 'DONE');
    return { blob: new Blob(parts, { type: mime.split(';')[0] }), ext: ext as 'mp4' | 'webm', w: VID_W, h: VID_H, seconds: VID_SECONDS, thumb: thumbOf(out) };
  } finally {
    try { src?.stop(); } catch { /* already stopped */ }
    for (const t of stream.getTracks()) t.stop();
    if (audioCtx && audioCtx.state !== 'closed') void audioCtx.close();
  }
}

export async function exportVideo(assets: DemoAssets, greetz: string[], rampName: RampName, tune: Tune | null, onProgress: Progress, signal: AbortSignal): Promise<Exported> {
  const pcm = tune ? renderTune(tune, 44100) : null;
  const sliced = pcm ? pcm.subarray(0, VID_SECONDS * 44100) : null;
  // the recorder path needs an AudioContext — build it now, synchronously
  // inside the click's activation window, before the codec probes await
  const audioCtx = pcm && typeof AudioContext !== 'undefined' ? new AudioContext({ sampleRate: 44100 }) : null;
  // offline mp4 only when it can hold the whole take — a requested tune that
  // can't encode to AAC falls back to the recorder, which keeps the audio
  if ((await canEncodeMp4()) && (!sliced || (await canEncodeAac()))) {
    if (audioCtx && audioCtx.state !== 'closed') void audioCtx.close();
    return exportMp4(assets, greetz, rampName, sliced ? new Float32Array(sliced) : null, onProgress, signal);
  }
  return exportRecorded(assets, greetz, rampName, sliced ? new Float32Array(sliced) : null, audioCtx, onProgress, signal);
}

