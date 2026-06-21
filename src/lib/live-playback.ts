import type { NowPlayingSong } from "@/types/firestore";

export const NOW_PLAYING_ART_LAYOUT_ID = "now-playing-art";

export function nowPlayingFingerprint(song: NowPlayingSong): string {
  return (
    song.spotifyUrl ||
    `${song.title}::${song.artist}::${song.albumArt || ""}`
  );
}

/** Spotify track length only — never a synthetic fallback. */
export function spotifyDurationMs(durationMs?: number): number | null {
  if (
    typeof durationMs !== "number" ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0
  ) {
    return null;
  }

  return Math.floor(durationMs);
}

export function playbackSessionKey(song: NowPlayingSong): string {
  const track = nowPlayingFingerprint(song);
  const started =
    typeof song.startedAt === "number" && song.startedAt > 0
      ? String(song.startedAt)
      : "pending";
  return `${track}::${started}`;
}

export function resolveServerStartedAt(song: NowPlayingSong): number | null {
  if (typeof song.startedAt === "number" && song.startedAt > 0) {
    return song.startedAt;
  }

  return null;
}

export function computePlaybackState(
  startedAt: number,
  durationMs: number | null,
  now: number,
): {
  elapsedMs: number;
  progress: number;
  isComplete: boolean;
  hasDuration: boolean;
} {
  const elapsedMs = Math.max(0, now - startedAt);

  if (!durationMs || durationMs <= 0) {
    return {
      elapsedMs,
      progress: 0,
      isComplete: false,
      hasDuration: false,
    };
  }

  const progress = Math.min(1, Math.max(0, elapsedMs / durationMs));

  return {
    elapsedMs,
    progress,
    isComplete: progress >= 1,
    hasDuration: true,
  };
}

/** Smooth toward target without moving backwards (per session). */
export function smoothProgress(
  current: number,
  target: number,
  factor = 0.2,
): number {
  if (target <= current) {
    return target;
  }

  return Math.min(1, current + (target - current) * factor);
}
