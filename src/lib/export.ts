// export — prints the live demo to a file.
// GIF: a seamless ping-pong loop of the first section on a 600px square.
// video: 1280x720 — a real mp4 with the tune when WebCodecs can encode one,
// else a MediaRecorder take of the same composition (mp4 on Safari, webm
// elsewhere).
import { Demo, W, H, RAMPS } from './demo.ts';
import type { DemoAssets, RampName } from './demo.ts';
import type { Tune } from './tune.ts';
import { renderTune } from './synth.ts';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export interface Progress { (frac: number, label: string): void }
export interface Exported { blob: Blob; ext: 'gif' | 'mp4' | 'webm'; w: number; h: number; seconds: number }

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

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

export async function exportGif(assets: DemoAssets, greetz: string[], rampName: RampName, onProgress: Progress, signal: AbortSignal): Promise<Exported> {
  const { demo, cv } = freshDemo(assets);
  const ramp = RAMPS[rampName];
  const frames: Uint8Array[] = [];
  const n = Math.round(GIF_SECONDS * GIF_FPS);
  // section 0 sits at t in [0,9); start past the wipe so every frame is full
  const t0 = 0.55;
  for (let i = 0; i < n; i++) {
    if (signal.aborted) throw new DOMException('cancelled', 'AbortError');
    demo.renderLoop(t0 + i / GIF_FPS, greetz);
    const c2 = document.createElement('canvas');
    c2.width = c2.height = GIF_SIZE;
    composite(c2.getContext('2d')!, cv, ramp, GIF_SIZE, Math.round(GIF_SIZE * H / W));
    frames.push(new Uint8Array(c2.getContext('2d')!.getImageData(0, 0, GIF_SIZE, GIF_SIZE).data.buffer.slice(0)));
    if (i % 4 === 0) { onProgress(i / n / 2, 'SHOOTING FRAMES'); await nextFrame(); }
  }
  const gif = GIFEncoder();
  // one global palette from the first frame — the demo only uses the ramp,
  // so it quantizes clean and the file stays small
  const palette = quantize(frames[0], 160, { format: 'rgba4444' });
  const total = n * 2 - 2;
  const write = (fi: number) => {
    const idx = applyPalette(frames[fi], palette, 'rgba4444');
    gif.writeFrame(idx, GIF_SIZE, GIF_SIZE, { palette, delay: Math.round(1000 / GIF_FPS) });
  };
  for (let i = 0; i < n; i++) write(i);
  for (let i = n - 2; i > 0; i--) write(i);
  gif.finish();
  onProgress(1, 'DONE');
  return { blob: new Blob([gif.bytes().slice().buffer as ArrayBuffer], { type: 'image/gif' }), ext: 'gif', w: GIF_SIZE, h: GIF_SIZE, seconds: total / GIF_FPS };
}

// ---------- video ----------

const VID_W = 1280, VID_H = 720, VID_FPS = 30, VID_SECONDS = 9;
// start late in a section so the take catches the wipe into the next one
const VID_T0 = 7.0;

async function canEncodeMp4(): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return false;
  try {
    const v = await VideoEncoder.isConfigSupported({ codec: 'avc1.42E028', width: VID_W, height: VID_H, framerate: VID_FPS, bitrate: 5_000_000 });
    return !!v.supported;
  } catch { return false; }
}

async function exportMp4(assets: DemoAssets, greetz: string[], rampName: RampName, pcm: Float32Array | null, onProgress: Progress, signal: AbortSignal): Promise<Exported> {
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const { demo, cv } = freshDemo(assets);
  const ramp = RAMPS[rampName];
  const out = document.createElement('canvas');
  out.width = VID_W; out.height = VID_H;
  const octx = out.getContext('2d')!;

  const hasAudio = !!pcm && typeof AudioEncoder !== 'undefined'
    && (await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', numberOfChannels: 2, sampleRate: 44100, bitrate: 128000 }).catch(() => ({ supported: false }))).supported;

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

  const dw = Math.round(VID_H * W / H);
  const totalFrames = VID_SECONDS * VID_FPS;
  for (let i = 0; i < totalFrames; i++) {
    if (signal.aborted || errors.length) { venc.close(); aenc?.close(); throw errors[0] ?? new DOMException('cancelled', 'AbortError'); }
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
      if (signal.aborted || errors.length) { venc.close(); aenc.close(); throw errors[0] ?? new DOMException('cancelled', 'AbortError'); }
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
  venc.close(); aenc?.close();
  if (errors.length) throw errors[0];
  muxer.finalize();
  onProgress(1, 'DONE');
  return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), ext: 'mp4', w: VID_W, h: VID_H, seconds: VID_SECONDS };
}

function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of ['video/mp4;codecs="avc1.42E028,mp4a.40.2"', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'])
    if (MediaRecorder.isTypeSupported(m)) return m;
  return null;
}

async function exportRecorded(assets: DemoAssets, greetz: string[], rampName: RampName, pcm: Float32Array | null, onProgress: Progress, signal: AbortSignal): Promise<Exported> {
  const mime = pickRecorderMime();
  if (!mime) throw new Error('this browser cannot record video');
  const { demo, cv } = freshDemo(assets);
  const ramp = RAMPS[rampName];
  const out = document.createElement('canvas');
  out.width = VID_W; out.height = VID_H;
  const octx = out.getContext('2d')!;
  const stream = out.captureStream(VID_FPS);
  let audioCtx: AudioContext | null = null;
  if (pcm) {
    audioCtx = new AudioContext({ sampleRate: 44100 });
    const dest = audioCtx.createMediaStreamDestination();
    const src = audioCtx.createBufferSource();
    const buf = audioCtx.createBuffer(1, pcm.length, 44100);
    buf.getChannelData(0).set(pcm);
    src.buffer = buf;
    // a real take: the tune plays to the file and to the room
    const live = audioCtx.createGain();
    live.gain.value = 0.5;
    src.connect(live).connect(audioCtx.destination);
    src.connect(dest);
    for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
    src.start();
  }
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const parts: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  rec.start(500);

  const dw = Math.round(VID_H * W / H);
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (signal.aborted) return resolve();
      const el = (performance.now() - t0) / 1000;
      demo.renderLoop(VID_T0 + el, greetz);
      composite(octx, cv, ramp, dw, VID_H);
      onProgress(Math.min(0.98, el / VID_SECONDS), 'RECORDING LIVE');
      if (el < VID_SECONDS) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
  await new Promise<void>((r) => { rec.onstop = () => r(); rec.stop(); });
  audioCtx?.close();
  if (signal.aborted) throw new DOMException('cancelled', 'AbortError');
  const ext = mime.includes('mp4') ? 'mp4' : 'webm';
  onProgress(1, 'DONE');
  return { blob: new Blob(parts, { type: mime.split(';')[0] }), ext: ext as 'mp4' | 'webm', w: VID_W, h: VID_H, seconds: VID_SECONDS };
}

export async function exportVideo(assets: DemoAssets, greetz: string[], rampName: RampName, tune: Tune | null, onProgress: Progress, signal: AbortSignal): Promise<Exported> {
  const pcm = tune ? renderTune(tune, 44100) : null;
  const sliced = pcm ? pcm.subarray(0, VID_SECONDS * 44100) : null;
  if (await canEncodeMp4()) return exportMp4(assets, greetz, rampName, sliced ? new Float32Array(sliced) : null, onProgress, signal);
  return exportRecorded(assets, greetz, rampName, sliced ? new Float32Array(sliced) : null, onProgress, signal);
}

