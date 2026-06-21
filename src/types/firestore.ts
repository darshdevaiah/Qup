/** Currently playing track (no voting). */
export type NowPlayingSong = {
  title: string;
  artist: string;
  albumArt: string;
  spotifyUrl: string;
  /** Display name of who added this track (from queue promotion). */
  addedBy?: string;
  /** Track length in ms (local playback simulation). */
  durationMs?: number;
  /** Unix timestamp (ms) when this track began playing in the room. */
  startedAt?: number;
};

/** A track in the room queue with voting metadata. */
export type QueuedSong = {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  spotifyUrl: string;
  /** Unix timestamp (ms) when the song was added. */
  addedAt: number;
  /** Room display name of who added the track. */
  addedBy: string;
  /** Spotify track duration when known. */
  durationMs?: number;
  voteCount: number;
  voters: string[];
};

/** Fields required when adding a track from Spotify search. */
export type AddToQueueInput = {
  title: string;
  artist: string;
  albumArt?: string;
  spotifyUrl?: string;
  /** Spotify track ID (stable duplicate key). */
  spotifyTrackId?: string;
  /** Room display name of who is adding the track. */
  addedBy?: string;
  durationMs?: number;
};

export type AddSongResult = {
  action: "added" | "boosted";
  songId: string;
};

export type BattlePhase = "intro" | "live" | "result";

export type BattleTrigger = "auto" | "manual";

/** Firestore-synced battle session (optional on room doc). */
export type RoomBattle = {
  active: boolean;
  leftSongId: string;
  rightSongId: string;
  startedAt: number;
  introEndsAt: number;
  endsAt: number;
  winningSongId: string | null;
  trigger: BattleTrigger;
  version: number;
};

/** DJ host session settings — synced on the room document. */
export type RoomHostSettings = {
  hostId: string;
  votingPaused: boolean;
  queueLocked: boolean;
  explicitFilterEnabled: boolean;
  crowdMode: boolean;
};

/** Room document stored at `rooms/{id}`. */
export type Room = {
  /** Uppercase room code — matches the Firestore document id. */
  code?: string;
  name: string;
  /** Unix timestamp (ms) when the room was created. */
  createdAt?: number;
  currentSong: NowPlayingSong | null;
  queue: QueuedSong[];
  battle?: RoomBattle | null;
  host?: RoomHostSettings;
  /** Pinned queue item — sorts above vote order until cleared. */
  pinnedSongId?: string | null;
};

export type CreateRoomResult = {
  code: string;
};

/** Firestore collection paths used by Qup. */
export const COLLECTIONS = {
  rooms: "rooms",
  health: "_health",
} as const;
