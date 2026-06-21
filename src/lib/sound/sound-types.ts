export type SoundEvent =
  | "vote-drag-start"
  | "vote-drag-tick"
  | "vote-commit"
  | "vote-bloom"
  | "queue-whoosh"
  | "overlay-open"
  | "overlay-close"
  | "song-transition"
  | "battle-enter"
  | "battle-resolve"
  | "song-placed";

export type PlaySoundOptions = {
  /** 0–1 scales preset loudness / motion depth. */
  intensity?: number;
};

export const SOUND_DEBOUNCE_MS: Record<SoundEvent, number> = {
  "vote-drag-start": 180,
  "vote-drag-tick": 70,
  "vote-commit": 280,
  "vote-bloom": 420,
  "queue-whoosh": 320,
  "overlay-open": 700,
  "overlay-close": 700,
  "song-transition": 900,
  "battle-enter": 1200,
  "battle-resolve": 900,
  "song-placed": 500,
};
