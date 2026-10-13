// renders a Tune into a looping AudioBuffer on user gesture
import type { Tune } from './tune.ts';
import { renderTune } from './synth.ts';

export interface Deck {
  ctx: AudioContext;
  gain: GainNode;
  play(): void;
  stop(): void;
  duration: number;
}

export function bootAudio(tune: Tune): Deck {
  const ctx = new AudioContext();
  const samples = renderTune(tune, 44100);
  const buf = ctx.createBuffer(1, samples.length, 44100);
  buf.getChannelData(0).set(samples);
  const seconds = samples.length / 44100;

  const gain = ctx.createGain();
  gain.gain.value = 0.8;
  // gentle low-pass to round the digital edges
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 14000;
  gain.connect(lp).connect(ctx.destination);

  let src: AudioBufferSourceNode | null = null;
  return {
    ctx, gain,
    duration: seconds,
    play() {
      src?.stop();
      src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(gain);
      src.start();
    },
    stop() { src?.stop(); src = null; },
  };
}
