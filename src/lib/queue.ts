import type { QueuedSong } from "@/types/firestore";

/**
 * UI-only sort: highest voteCount first. Does not mutate the input array.
 * Ties keep Firestore array order (stable sort via original index).
 */
export function sortQueueByVotes(queue: QueuedSong[]): QueuedSong[] {
  return queue
    .map((song, index) => ({ song, index }))
    .sort((a, b) => {
      const voteDiff =
        (b.song.voteCount ?? 0) - (a.song.voteCount ?? 0);
      if (voteDiff !== 0) return voteDiff;
      return a.index - b.index;
    })
    .map(({ song }) => song);
}

/** Vote sort with optional host pin floating at the top. */
export function sortQueueForDisplay(
  queue: QueuedSong[],
  pinnedSongId?: string | null,
): QueuedSong[] {
  const sorted = sortQueueByVotes(queue);
  if (!pinnedSongId) return sorted;

  const pinIndex = sorted.findIndex((song) => song.id === pinnedSongId);
  if (pinIndex <= 0) return sorted;

  const pinned = sorted[pinIndex];
  return [pinned, ...sorted.filter((song) => song.id !== pinnedSongId)];
}
