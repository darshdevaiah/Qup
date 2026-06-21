import type { PlaySoundOptions } from "@/lib/sound/sound-types";

type SynthContext = {
  ctx: AudioContext;
  destination: AudioNode;
  masterGain: number;
  intensity: number;
};

function clampIntensity(value?: number): number {
  if (value === undefined) return 1;
  return Math.min(1, Math.max(0, value));
}

function gain(
  ctx: AudioContext,
  level: number,
  attack: number,
  release: number,
  peak: number,
): GainNode {
  const node = ctx.createGain();
  const now = ctx.currentTime;
  const amp = level * peak;
  node.gain.setValueAtTime(0.0001, now);
  node.gain.linearRampToValueAtTime(amp, now + attack);
  node.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
  return node;
}

function pan(ctx: AudioContext, value: number): StereoPannerNode {
  const node = ctx.createStereoPanner();
  node.pan.value = value;
  return node;
}

function tone(
  sc: SynthContext,
  freq: number,
  type: OscillatorType,
  peak: number,
  attack: number,
  release: number,
  panValue = 0,
) {
  const osc = sc.ctx.createOscillator();
  const env = gain(sc.ctx, sc.masterGain * sc.intensity, attack, release, peak);
  const panner = pan(sc.ctx, panValue);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, sc.ctx.currentTime);
  osc.connect(env);
  env.connect(panner);
  panner.connect(sc.destination);
  const stopAt = sc.ctx.currentTime + attack + release + 0.06;
  osc.start();
  osc.stop(stopAt);
  return stopAt - sc.ctx.currentTime;
}

function noiseBurst(
  sc: SynthContext,
  peak: number,
  attack: number,
  release: number,
  filterFreq: number,
  panValue = 0,
) {
  const bufferSize = Math.floor(sc.ctx.sampleRate * (attack + release + 0.05));
  const buffer = sc.ctx.createBuffer(1, bufferSize, sc.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * 0.35;
  }

  const source = sc.ctx.createBufferSource();
  source.buffer = buffer;
  const filter = sc.ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 0.7;
  const env = gain(sc.ctx, sc.masterGain * sc.intensity, attack, release, peak);
  const panner = pan(sc.ctx, panValue);
  source.connect(filter);
  filter.connect(env);
  env.connect(panner);
  panner.connect(sc.destination);
  const stopAt = sc.ctx.currentTime + attack + release + 0.04;
  source.start();
  source.stop(stopAt);
  return stopAt - sc.ctx.currentTime;
}

function whoosh(sc: SynthContext) {
  const duration = 0.22 + (1 - sc.intensity) * 0.12;
  const bufferSize = Math.floor(sc.ctx.sampleRate * duration);
  const buffer = sc.ctx.createBuffer(1, bufferSize, sc.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * 0.22;
  }

  const source = sc.ctx.createBufferSource();
  source.buffer = buffer;
  const filter = sc.ctx.createBiquadFilter();
  filter.type = "lowpass";
  const now = sc.ctx.currentTime;
  filter.frequency.setValueAtTime(280 + sc.intensity * 220, now);
  filter.frequency.exponentialRampToValueAtTime(900, now + duration * 0.65);
  filter.Q.value = 0.5;

  const env = sc.ctx.createGain();
  const peak = 0.045 * sc.masterGain * (0.35 + sc.intensity * 0.55);
  env.gain.setValueAtTime(0.0001, now);
  env.gain.linearRampToValueAtTime(peak, now + 0.04);
  env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(filter);
  filter.connect(env);
  env.connect(sc.destination);
  source.start();
  source.stop(now + duration + 0.02);
  return duration;
}

function swell(
  sc: SynthContext,
  rising: boolean,
  duration: number,
  peak: number,
) {
  const osc = sc.ctx.createOscillator();
  const filter = sc.ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  const env = sc.ctx.createGain();
  const now = sc.ctx.currentTime;
  const amp = peak * sc.masterGain;

  osc.type = "sine";
  osc.frequency.setValueAtTime(rising ? 58 : 72, now);
  if (rising) {
    osc.frequency.exponentialRampToValueAtTime(96, now + duration);
  } else {
    osc.frequency.exponentialRampToValueAtTime(48, now + duration);
  }

  env.gain.setValueAtTime(0.0001, now);
  if (rising) {
    env.gain.linearRampToValueAtTime(amp, now + duration * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  } else {
    env.gain.linearRampToValueAtTime(amp * 0.7, now + 0.05);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  }

  const noise = sc.ctx.createBufferSource();
  const nBuf = sc.ctx.createBuffer(
    1,
    Math.floor(sc.ctx.sampleRate * duration),
    sc.ctx.sampleRate,
  );
  const nData = nBuf.getChannelData(0);
  for (let i = 0; i < nData.length; i += 1) {
    nData[i] = (Math.random() * 2 - 1) * 0.08;
  }
  noise.buffer = nBuf;
  const nEnv = sc.ctx.createGain();
  nEnv.gain.value = amp * 0.25;

  osc.connect(filter);
  filter.connect(env);
  noise.connect(nEnv);
  env.connect(sc.destination);
  nEnv.connect(sc.destination);

  const stopAt = now + duration + 0.05;
  osc.start(now);
  noise.start(now);
  osc.stop(stopAt);
  noise.stop(stopAt);
  return duration;
}

export function synthesizeSound(
  event: import("@/lib/sound/sound-types").SoundEvent,
  ctx: AudioContext,
  destination: AudioNode,
  masterGain: number,
  options?: PlaySoundOptions,
): number {
  const sc: SynthContext = {
    ctx,
    destination,
    masterGain,
    intensity: clampIntensity(options?.intensity),
  };

  switch (event) {
    case "vote-drag-start":
      return noiseBurst(sc, 0.07, 0.004, 0.028, 2400, -0.08);

    case "vote-drag-tick":
      return tone(sc, 520 + sc.intensity * 80, "sine", 0.025, 0.003, 0.04, 0.05);

    case "vote-commit":
      tone(sc, 196, "sine", 0.11, 0.008, 0.1, -0.12);
      tone(sc, 392, "triangle", 0.045, 0.012, 0.14, 0.1);
      return 0.16;

    case "vote-bloom":
      tone(sc, 329.6, "sine", 0.055, 0.02, 0.22, 0);
      tone(sc, 493.9, "triangle", 0.028, 0.03, 0.28, 0.14);
      return 0.32;

    case "queue-whoosh":
      return whoosh(sc);

    case "overlay-open":
      return swell(sc, true, 0.48, 0.09 * sc.intensity);

    case "overlay-close":
      return swell(sc, false, 0.38, 0.07 * sc.intensity);

    case "song-transition":
      noiseBurst(sc, 0.04, 0.01, 0.18, 680, 0);
      tone(sc, 261.6, "sine", 0.05, 0.015, 0.2, -0.18);
      return 0.22;

    case "battle-enter":
      return swell(sc, true, 0.55, 0.1 * sc.intensity);

    case "battle-resolve":
      tone(sc, 220, "sine", 0.08, 0.01, 0.2, -0.1);
      tone(sc, 329.6, "triangle", 0.05, 0.02, 0.32, 0.12);
      return 0.36;

    case "song-placed":
      tone(sc, 174.6, "sine", 0.09, 0.006, 0.12, -0.05);
      tone(sc, 349.2, "sine", 0.04, 0.02, 0.24, 0.08);
      return 0.28;

    default:
      return 0;
  }
}
