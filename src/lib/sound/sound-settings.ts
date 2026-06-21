export const SOUND_ENABLED_KEY = "qup-sound-enabled";
export const SOUND_VOLUME_KEY = "qup-sound-volume";

/** Normalized master level — all presets calibrated against this. */
export const DEFAULT_MASTER_VOLUME = 0.44;

export function prefersReducedSensory(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function readSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (prefersReducedSensory()) return false;

  const stored = localStorage.getItem(SOUND_ENABLED_KEY);
  if (stored === "false") return false;
  if (stored === "true") return true;
  return true;
}

export function readMasterVolume(): number {
  if (typeof window === "undefined") return DEFAULT_MASTER_VOLUME;

  const stored = localStorage.getItem(SOUND_VOLUME_KEY);
  if (!stored) return DEFAULT_MASTER_VOLUME;

  const value = Number.parseFloat(stored);
  if (!Number.isFinite(value)) return DEFAULT_MASTER_VOLUME;
  return Math.min(1, Math.max(0, value));
}

export function writeSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SOUND_ENABLED_KEY, enabled ? "true" : "false");
}

export function writeMasterVolume(volume: number): void {
  localStorage.setItem(
    SOUND_VOLUME_KEY,
    String(Math.min(1, Math.max(0, volume))),
  );
}
