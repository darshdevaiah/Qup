import {
  readMasterVolume,
  readSoundEnabled,
  writeMasterVolume,
  writeSoundEnabled,
} from "@/lib/sound/sound-settings";
import { synthesizeSound } from "@/lib/sound/sound-synth";
import type { PlaySoundOptions, SoundEvent } from "@/lib/sound/sound-types";
import { SOUND_DEBOUNCE_MS } from "@/lib/sound/sound-types";

const MAX_CONCURRENT = 5;

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private unlocked = false;
  private enabled = true;
  private volume = readMasterVolume();
  private lastPlayed = new Map<SoundEvent, number>();
  private activeUntil = 0;
  private activeLayers = 0;

  constructor() {
    if (typeof window !== "undefined") {
      this.enabled = readSoundEnabled();
      this.volume = readMasterVolume();
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get masterVolume(): number {
    return this.volume;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    writeSoundEnabled(enabled);
  }

  setMasterVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    writeMasterVolume(this.volume);
    if (this.master) {
      this.master.gain.setTargetAtTime(this.volume, this.getCtx().currentTime, 0.04);
    }
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;

    const ctx = this.getCtx();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }
    this.unlocked = true;
  }

  play(event: SoundEvent, options?: PlaySoundOptions): void {
    if (typeof window === "undefined" || !this.enabled) return;
    if (!this.debounceOk(event)) return;
    if (!this.layerOk()) return;

    const ctx = this.getCtx();

    if (ctx.state === "suspended") {
      void ctx.resume().then(() => {
        this.unlocked = true;
        this.emit(event, options);
      });
      return;
    }

    this.unlocked = true;
    this.emit(event, options);
  }

  private emit(event: SoundEvent, options?: PlaySoundOptions): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;

    const destination = this.compressor ?? this.master!;
    const duration = synthesizeSound(event, ctx, destination, 1, options);

    this.lastPlayed.set(event, Date.now());
    this.activeLayers += 1;
    const endAt = Date.now() + duration * 1000 + 40;
    this.activeUntil = Math.max(this.activeUntil, endAt);
    window.setTimeout(() => {
      this.activeLayers = Math.max(0, this.activeLayers - 1);
    }, duration * 1000 + 50);
  }

  private debounceOk(event: SoundEvent): boolean {
    const minGap = SOUND_DEBOUNCE_MS[event];
    const last = this.lastPlayed.get(event) ?? 0;
    return Date.now() - last >= minGap;
  }

  private layerOk(): boolean {
    if (this.activeLayers < MAX_CONCURRENT) return true;
    return Date.now() > this.activeUntil;
  }

  private getCtx(): AudioContext {
    if (this.ctx) return this.ctx;

    const ctx = new AudioContext({ latencyHint: "interactive" });
    const master = ctx.createGain();
    master.gain.value = this.volume;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.18;

    master.connect(compressor);
    compressor.connect(ctx.destination);

    this.ctx = ctx;
    this.master = master;
    this.compressor = compressor;
    return ctx;
  }
}

let engineSingleton: SoundEngine | null = null;

export function getSoundEngine(): SoundEngine {
  if (!engineSingleton) {
    engineSingleton = new SoundEngine();
  }
  return engineSingleton;
}
