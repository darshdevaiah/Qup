import { detectQueueBattle, type QueueBattleState } from "@/lib/queue-battle";
import { sortQueueByVotes } from "@/lib/queue";
import type { NowPlayingSong, QueuedSong } from "@/types/firestore";

export const SONG_CHANGED_WINDOW_MS = 20_000;
export const QUEUE_ACTIVITY_WINDOW_MS = 14_000;

export type RoomActionContextId =
  | "battle"
  | "song_changed"
  | "empty_queue"
  | "user_never_added"
  | "high_energy"
  | "chill"
  | "active_queue"
  | "your_turn";

export type RoomActionContext = {
  id: RoomActionContextId;
  emoji: string;
  label: string;
  ariaLabel: string;
};

export type RoomActionSignals = {
  queueSignature: string;
  sortedQueue: QueuedSong[];
  battle: QueueBattleState;
  queueLength: number;
  totalVotes: number;
  maxVotes: number;
  hasCurrentSong: boolean;
  userHasAdded: boolean;
  moodText: string;
  songJustChanged: boolean;
  queueJustActive: boolean;
};

const HYPE_KEYWORDS = [
  "party",
  "dance",
  "hype",
  "bass",
  "fire",
  "heat",
  "club",
  "edm",
  "trap",
  "drill",
  "banger",
  "rage",
  "turn up",
  "remix",
  "anthem",
];

const CHILL_KEYWORDS = [
  "chill",
  "lofi",
  "lo-fi",
  "sleep",
  "slow",
  "acoustic",
  "jazz",
  "ambient",
  "rain",
  "soft",
  "cozy",
  "moon",
  "night",
  "dream",
  "calm",
  "peace",
  "gentle",
  "mellow",
  "soul",
];

/** Stable fingerprint for realtime queue + vote changes. */
export function getQueueSignature(queue: QueuedSong[]): string {
  return sortQueueByVotes(queue)
    .map((song) => `${song.id}:${song.voteCount}:${song.addedAt}`)
    .join("|");
}

export function getCurrentSongFingerprint(song: NowPlayingSong | null): string {
  if (!song) {
    return "";
  }

  return (
    song.spotifyUrl ||
    `${song.title}::${song.artist}::${song.albumArt || ""}`
  );
}

function collectText(
  queue: QueuedSong[],
  currentSong: NowPlayingSong | null,
): string {
  const parts = [
    currentSong?.title,
    currentSong?.artist,
    ...queue.slice(0, 6).map((s) => s.title),
    ...queue.slice(0, 6).map((s) => s.artist),
  ].filter(Boolean) as string[];

  return parts.join(" ").toLowerCase();
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  return keywords.some((word) => text.includes(word));
}

function isWithinWindow(timestamp: number | null, now: number, windowMs: number): boolean {
  if (!timestamp) {
    return false;
  }

  return now - timestamp < windowMs;
}

function userHasAddedToRoom(
  queue: QueuedSong[],
  currentSong: NowPlayingSong | null,
  displayName: string,
): boolean {
  if (!displayName) {
    return true;
  }

  if (currentSong?.addedBy === displayName) {
    return true;
  }

  return queue.some((song) => song.addedBy === displayName);
}

function isHighEnergyRoom(
  queue: QueuedSong[],
  text: string,
  totalVotes: number,
  maxVote: number,
): boolean {
  if (queue.length === 0) {
    return false;
  }

  if (maxVote >= 3 || totalVotes >= 7) {
    return true;
  }

  if (queue.length >= 3 && totalVotes >= 4) {
    return true;
  }

  return matchesKeywords(text, HYPE_KEYWORDS);
}

function isChillRoom(
  queue: QueuedSong[],
  text: string,
  totalVotes: number,
): boolean {
  if (queue.length === 0) {
    return false;
  }

  if (totalVotes <= 2 && queue.length <= 4 && matchesKeywords(text, CHILL_KEYWORDS)) {
    return true;
  }

  if (totalVotes <= 1 && queue.length <= 3) {
    return matchesKeywords(text, CHILL_KEYWORDS);
  }

  return false;
}

function context(
  id: RoomActionContextId,
  emoji: string,
  label: string,
): RoomActionContext {
  return {
    id,
    emoji,
    label,
    ariaLabel: `${label}. Add a song to the queue.`,
  };
}

/** Derives live room signals used by the floating action pill. */
export function buildRoomActionSignals(input: {
  queue: QueuedSong[];
  currentSong: NowPlayingSong | null;
  displayName: string;
  now: number;
  songChangedAt: number | null;
  queueActivityAt: number | null;
}): RoomActionSignals {
  const { queue, currentSong, displayName, now, songChangedAt, queueActivityAt } =
    input;
  const sortedQueue = sortQueueByVotes(queue);
  const battle = detectQueueBattle(sortedQueue);
  const totalVotes = queue.reduce((sum, song) => sum + song.voteCount, 0);
  const maxVotes = queue.reduce((max, song) => Math.max(max, song.voteCount), 0);

  return {
    queueSignature: getQueueSignature(queue),
    sortedQueue,
    battle,
    queueLength: queue.length,
    totalVotes,
    maxVotes,
    hasCurrentSong: Boolean(currentSong),
    userHasAdded: userHasAddedToRoom(queue, currentSong, displayName),
    moodText: collectText(queue, currentSong),
    songJustChanged:
      Boolean(currentSong) &&
      isWithinWindow(songChangedAt, now, SONG_CHANGED_WINDOW_MS),
    queueJustActive:
      queue.length > 0 &&
      isWithinWindow(queueActivityAt, now, QUEUE_ACTIVITY_WINDOW_MS),
  };
}

/** Picks the most relevant floating action label for the current room mood. */
export function deriveRoomActionContextFromSignals(
  signals: RoomActionSignals,
): RoomActionContext {
  const {
    battle,
    queueLength,
    hasCurrentSong,
    userHasAdded,
    moodText,
    songJustChanged,
    queueJustActive,
    sortedQueue,
    totalVotes,
    maxVotes,
  } = signals;

  const queue = sortedQueue;

  if (battle.active) {
    return context("battle", "🔥", "Break the tie");
  }

  if (songJustChanged || queueJustActive) {
    return context("song_changed", "🎶", "Your turn next?");
  }

  if (queueLength === 0 && !hasCurrentSong) {
    return context("empty_queue", "🎵", "Start the vibe");
  }

  if (queueLength === 0 && hasCurrentSong) {
    return context("active_queue", "♪", "Add your pick");
  }

  if (!userHasAdded) {
    return context("user_never_added", "✨", "Put everyone on");
  }

  if (isHighEnergyRoom(queue, moodText, totalVotes, maxVotes)) {
    return context("high_energy", "🧨", "Drop heat");
  }

  if (isChillRoom(queue, moodText, totalVotes)) {
    return context("chill", "🌙", "Queue the mood");
  }

  if (queueLength > 0) {
    return context("active_queue", "♪", "Add your pick");
  }

  return context("your_turn", "♪", "Your turn");
}

/** @deprecated Use buildRoomActionSignals + deriveRoomActionContextFromSignals */
export function deriveRoomActionContext(input: {
  queue: QueuedSong[];
  currentSong: NowPlayingSong | null;
  displayName: string;
  songChangedAt: number | null;
  queueActivityAt?: number | null;
  now?: number;
}): RoomActionContext {
  const signals = buildRoomActionSignals({
    queue: input.queue,
    currentSong: input.currentSong,
    displayName: input.displayName,
    now: input.now ?? Date.now(),
    songChangedAt: input.songChangedAt,
    queueActivityAt: input.queueActivityAt ?? null,
  });

  return deriveRoomActionContextFromSignals(signals);
}
