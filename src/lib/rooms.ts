import {
  doc,
  getDoc,
  type DocumentReference,
  runTransaction,
} from "firebase/firestore";

import {
  DEFAULT_ROOM_HOST_SETTINGS,
} from "@/lib/host-permissions";

import { generateId } from "@/lib/generate-id";
import { getFirestoreDb } from "@/lib/firebase";
import { spotifyDurationMs } from "@/lib/live-playback";
import {
  createRoomBattle,
  detectBattleContenders,
  resolveBattleWinner,
} from "@/lib/battle-state";
import { sortQueueByVotes } from "@/lib/queue";
import { parseRoomHostSettings } from "@/lib/host-permissions";
import { logAlbumArtStage } from "@/lib/spotify/album-art";
import {
  COLLECTIONS,
  type AddSongResult,
  type AddToQueueInput,
  type BattleTrigger,
  type NowPlayingSong,
  type QueuedSong,
  type CreateRoomResult,
  type Room,
  type RoomBattle,
  type RoomHostSettings,
} from "@/types/firestore";

export class AlreadyVotedError extends Error {
  constructor() {
    super("You already voted for this song.");
    this.name = "AlreadyVotedError";
  }
}

export class BattleNotActiveError extends Error {
  constructor() {
    super("No active battle in this room.");
    this.name = "BattleNotActiveError";
  }
}

export class BattleEndedError extends Error {
  constructor() {
    super("This battle has ended.");
    this.name = "BattleEndedError";
  }
}

export class QueueLockedError extends Error {
  constructor() {
    super("The DJ has locked the queue.");
    this.name = "QueueLockedError";
  }
}

export class RoomCodeCollisionError extends Error {
  constructor() {
    super("Room code collision.");
    this.name = "RoomCodeCollisionError";
  }
}

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ROOM_CODE_MAX_ATTEMPTS = 16;
export const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;
export const ROOM_NAME_MAX_LENGTH = 48;

export class RoomNotFoundError extends Error {
  constructor() {
    super("No room found with that code.");
    this.name = "RoomNotFoundError";
  }
}

/** Normalizes user input to an uppercase alphanumeric room code fragment. */
export function normalizeRoomCodeInput(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCodeFormat(code: string): boolean {
  return ROOM_CODE_PATTERN.test(code);
}

/**
 * Validates that a room exists at `rooms/{code}`.
 * Returns the normalized code on success.
 */
export async function validateRoomCode(code: string): Promise<{ code: string }> {
  const normalized = normalizeRoomCodeInput(code);

  if (!isValidRoomCodeFormat(normalized)) {
    throw new Error("Enter a valid 6-character room code.");
  }

  const snapshot = await getDoc(getRoomRef(normalized));
  if (!snapshot.exists()) {
    throw new RoomNotFoundError();
  }

  return { code: normalized };
}

/** Generates a random 6-character uppercase room code (e.g. A7K9XZ). */
export function generateRoomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[bytes[i]! % ROOM_CODE_CHARS.length];
  }
  return code;
}

function sanitizeRoomName(raw: string): string {
  return raw.trim().slice(0, ROOM_NAME_MAX_LENGTH);
}

/**
 * Creates a new room at `rooms/{code}` with the creator as DJ host.
 * Retries code generation on document id collisions.
 */
export async function createRoom(
  roomName: string,
  hostVoterId: string,
): Promise<CreateRoomResult> {
  const name = sanitizeRoomName(roomName);
  const voterId = hostVoterId.trim();

  if (!name) {
    throw new Error("Room name is required.");
  }

  if (!voterId) {
    throw new Error("Session identity is required.");
  }

  const db = getFirestoreDb();
  const host: RoomHostSettings = {
    ...DEFAULT_ROOM_HOST_SETTINGS,
    hostId: voterId,
  };
  const createdAt = Date.now();

  for (let attempt = 0; attempt < ROOM_CODE_MAX_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const roomRef = getRoomRef(code);

    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(roomRef);
        if (snapshot.exists()) {
          throw new RoomCodeCollisionError();
        }

        transaction.set(roomRef, {
          code,
          name,
          createdAt,
          host,
          queue: [],
          currentSong: null,
          battle: null,
        });
      });

      return { code };
    } catch (error) {
      if (error instanceof RoomCodeCollisionError) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Could not generate a unique room code. Please try again.");
}

export function getRoomRef(roomId: string): DocumentReference<Room> {
  return doc(getFirestoreDb(), COLLECTIONS.rooms, roomId) as DocumentReference<Room>;
}

/** Fills missing fields on legacy/malformed queue items from Firestore. */
export function normalizeQueuedSong(
  raw: Record<string, unknown>,
  index: number,
): QueuedSong | null {
  if (!("title" in raw) || !("artist" in raw)) {
    return null;
  }

  const title = String(raw.title);
  const artist = String(raw.artist);

  let addedAt = Date.now();
  if (typeof raw.addedAt === "number" && !Number.isNaN(raw.addedAt)) {
    addedAt = raw.addedAt;
  } else if (typeof raw.addedAt === "string") {
    const parsed = Date.parse(raw.addedAt);
    if (!Number.isNaN(parsed)) {
      addedAt = parsed;
    }
  }

  return {
    id:
      typeof raw.id === "string" && raw.id.length > 0
        ? raw.id
        : `legacy-${index}-${title}-${artist}`,
    title,
    artist,
    albumArt: typeof raw.albumArt === "string" ? raw.albumArt : "",
    spotifyUrl: typeof raw.spotifyUrl === "string" ? raw.spotifyUrl : "",
    addedAt,
    addedBy:
      typeof raw.addedBy === "string"
        ? raw.addedBy.trim().slice(0, 16)
        : "",
    durationMs:
      typeof raw.durationMs === "number" && raw.durationMs > 0
        ? raw.durationMs
        : undefined,
    voteCount: typeof raw.voteCount === "number" ? raw.voteCount : 0,
    voters: Array.isArray(raw.voters)
      ? raw.voters.filter((v): v is string => typeof v === "string")
      : [],
  };
}

function normalizeQueuedSongWithLog(
  raw: Record<string, unknown>,
  index: number,
): QueuedSong | null {
  const song = normalizeQueuedSong(raw, index);
  if (song) {
    logAlbumArtStage("firestore.read.queue", song.title, song.albumArt);
  }
  return song;
}

/** Strips undefined values before any Firestore write. */
export function sanitizeQueuedSongForFirestore(
  song: QueuedSong,
): Record<string, string | number | string[]> {
  const complete: QueuedSong = {
    id: song.id,
    title: song.title,
    artist: song.artist,
    albumArt: song.albumArt || "",
    spotifyUrl: song.spotifyUrl || "",
    addedAt: song.addedAt ?? Date.now(),
    addedBy: song.addedBy ?? "",
    ...(song.durationMs ? { durationMs: song.durationMs } : {}),
    voteCount: song.voteCount ?? 0,
    voters: song.voters ?? [],
  };

  return Object.fromEntries(
    Object.entries(complete).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number | string[]>;
}

function sanitizeQueueForFirestore(
  queue: QueuedSong[],
): Record<string, string | number | string[]>[] {
  return queue.map((song) => sanitizeQueuedSongForFirestore(song));
}

/** Copies queue metadata into currentSong when a track begins playing. */
export function queuedSongToCurrentSong(song: QueuedSong): NowPlayingSong {
  const current: NowPlayingSong = {
    title: song.title,
    artist: song.artist,
    albumArt: song.albumArt || "",
    spotifyUrl: song.spotifyUrl || "",
    startedAt: Date.now(),
  };

  const durationMs = spotifyDurationMs(song.durationMs);
  if (durationMs !== null) {
    current.durationMs = durationMs;
  }

  if (song.addedBy) {
    current.addedBy = song.addedBy;
  }

  return current;
}

export function sanitizeCurrentSongForFirestore(
  song: NowPlayingSong,
): Record<string, string | number> {
  const payload: Record<string, string | number> = {
    title: song.title,
    artist: song.artist,
    albumArt: song.albumArt || "",
    spotifyUrl: song.spotifyUrl || "",
  };

  const durationMs = spotifyDurationMs(song.durationMs);
  if (durationMs !== null) {
    payload.durationMs = durationMs;
  }

  if (typeof song.startedAt === "number" && song.startedAt > 0) {
    payload.startedAt = song.startedAt;
  }

  if (song.addedBy?.trim()) {
    payload.addedBy = song.addedBy.trim().slice(0, 16);
  }

  return payload;
}

function getCurrentSongDedupeKey(song: NowPlayingSong): string | null {
  const trackId = extractSpotifyTrackId(song.spotifyUrl);
  if (trackId) {
    return `track:${trackId}`;
  }

  const url = song.spotifyUrl.trim();
  if (url) {
    return `url:${url}`;
  }

  return null;
}

function songsMatchCurrent(
  current: NowPlayingSong,
  queued: QueuedSong,
): boolean {
  const currentKey = getCurrentSongDedupeKey(current);
  const queuedKey = getSongDedupeKey(queued);

  if (currentKey && queuedKey) {
    return currentKey === queuedKey;
  }

  return current.title === queued.title && current.artist === queued.artist;
}

/** Fills missing albumArt / spotifyUrl on currentSong from a matching queue item. */
export function enrichCurrentSongFromQueue(
  currentSong: NowPlayingSong,
  queue: QueuedSong[],
): NowPlayingSong {
  const match = queue.find((song) => songsMatchCurrent(currentSong, song));
  if (!match) {
    return currentSong;
  }

  const enriched: NowPlayingSong = {
    title: currentSong.title,
    artist: currentSong.artist,
    albumArt: currentSong.albumArt?.trim() || match.albumArt || "",
    spotifyUrl: currentSong.spotifyUrl?.trim() || match.spotifyUrl || "",
    addedBy: currentSong.addedBy?.trim() || match.addedBy || undefined,
    startedAt:
      typeof currentSong.startedAt === "number" && currentSong.startedAt > 0
        ? currentSong.startedAt
        : undefined,
  };

  const durationMs = spotifyDurationMs(
    currentSong.durationMs ?? match.durationMs,
  );
  if (durationMs !== null) {
    enriched.durationMs = durationMs;
  }

  return enriched;
}

/**
 * Promotes the top-voted queue item to currentSong when idle,
 * and backfills missing currentSong metadata from the queue.
 */
export function resolveRoomPlayback(
  currentSong: NowPlayingSong | null,
  queue: QueuedSong[],
): { currentSong: NowPlayingSong | null; queue: QueuedSong[] } {
  const normalizedQueue = deduplicateQueue(queue);

  if (!currentSong) {
    if (normalizedQueue.length === 0) {
      return { currentSong: null, queue: normalizedQueue };
    }

    const next = sortQueueByVotes(normalizedQueue)[0];
    return {
      currentSong: queuedSongToCurrentSong(next),
      queue: normalizedQueue.filter((song) => song.id !== next.id),
    };
  }

  const enriched = enrichCurrentSongFromQueue(currentSong, normalizedQueue);
  return { currentSong: enriched, queue: normalizedQueue };
}

export function roomPlaybackNeedsSync(room: Room): boolean {
  const queue = deduplicateQueue(room.queue);

  if (!room.currentSong) {
    return queue.length > 0;
  }

  const { currentSong } = resolveRoomPlayback(room.currentSong, queue);
  return (
    currentSong!.albumArt !== (room.currentSong.albumArt ?? "") ||
    currentSong!.spotifyUrl !== (room.currentSong.spotifyUrl ?? "")
  );
}

function parseQueuedSong(item: unknown, index: number): QueuedSong | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  return normalizeQueuedSongWithLog(item as Record<string, unknown>, index);
}

export function parseRoomData(data: Record<string, unknown>): Room {
  const currentSong = data.currentSong;
  const queue = data.queue;

  let nowPlaying: NowPlayingSong | null = null;
  if (
    currentSong &&
    typeof currentSong === "object" &&
    "title" in currentSong &&
    "artist" in currentSong
  ) {
    const raw = currentSong as Record<string, unknown>;
    nowPlaying = {
      title: String(raw.title),
      artist: String(raw.artist),
      albumArt: typeof raw.albumArt === "string" ? raw.albumArt : "",
      spotifyUrl: typeof raw.spotifyUrl === "string" ? raw.spotifyUrl : "",
      ...(typeof raw.addedBy === "string" && raw.addedBy.trim()
        ? { addedBy: raw.addedBy.trim().slice(0, 16) }
        : {}),
      ...(typeof raw.durationMs === "number" && raw.durationMs > 0
        ? { durationMs: raw.durationMs }
        : {}),
      ...(typeof raw.startedAt === "number" && raw.startedAt > 0
        ? { startedAt: raw.startedAt }
        : {}),
    };
    logAlbumArtStage(
      "firestore.read.nowPlaying",
      nowPlaying.title,
      nowPlaying.albumArt,
    );
  }

  return {
    code:
      typeof data.code === "string" && data.code.trim()
        ? data.code.trim().toUpperCase()
        : undefined,
    name: typeof data.name === "string" ? data.name : "Untitled Room",
    createdAt:
      typeof data.createdAt === "number" && data.createdAt > 0
        ? data.createdAt
        : undefined,
    currentSong: nowPlaying,
    queue: Array.isArray(queue)
      ? queue
          .map((item, index) => parseQueuedSong(item, index))
          .filter((item): item is QueuedSong => item !== null)
      : [],
    battle: parseRoomBattle(data.battle),
    host: parseRoomHostSettings(data.host),
    pinnedSongId:
      typeof data.pinnedSongId === "string"
        ? data.pinnedSongId
        : data.pinnedSongId === null
          ? null
          : undefined,
  };
}

function parseRoomBattle(raw: unknown): RoomBattle | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (data.active !== true) return null;

  const leftSongId =
    typeof data.leftSongId === "string" ? data.leftSongId : "";
  const rightSongId =
    typeof data.rightSongId === "string" ? data.rightSongId : "";
  if (!leftSongId || !rightSongId) return null;

  const startedAt =
    typeof data.startedAt === "number" ? data.startedAt : Date.now();
  const introEndsAt =
    typeof data.introEndsAt === "number"
      ? data.introEndsAt
      : startedAt + 1200;
  const endsAt =
    typeof data.endsAt === "number" ? data.endsAt : introEndsAt + 15_000;

  return {
    active: true,
    leftSongId,
    rightSongId,
    startedAt,
    introEndsAt,
    endsAt,
    winningSongId:
      typeof data.winningSongId === "string" ? data.winningSongId : null,
    trigger: data.trigger === "manual" ? "manual" : "auto",
    version: typeof data.version === "number" ? data.version : 1,
  };
}

export function sanitizeRoomBattleForFirestore(
  battle: RoomBattle,
): Record<string, string | number | boolean | null> {
  return {
    active: battle.active,
    leftSongId: battle.leftSongId,
    rightSongId: battle.rightSongId,
    startedAt: battle.startedAt,
    introEndsAt: battle.introEndsAt,
    endsAt: battle.endsAt,
    winningSongId: battle.winningSongId,
    trigger: battle.trigger,
    version: battle.version,
  };
}

/** Extracts Spotify track ID from open.spotify.com URLs. */
export function extractSpotifyTrackId(spotifyUrl: string): string | null {
  const match = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
  return match?.[1] ?? null;
}

/** Stable dedupe key: Spotify track ID preferred, else exact spotifyUrl. */
export function getSongDedupeKey(song: QueuedSong): string | null {
  const trackId = extractSpotifyTrackId(song.spotifyUrl);
  if (trackId) {
    return `track:${trackId}`;
  }

  const url = song.spotifyUrl.trim();
  if (url) {
    return `url:${url}`;
  }

  return null;
}

function getIncomingDedupeKey(input: AddToQueueInput): string | null {
  const trackId =
    input.spotifyTrackId?.trim() || extractSpotifyTrackId(input.spotifyUrl ?? "");
  if (trackId) {
    return `track:${trackId}`;
  }

  const url = (input.spotifyUrl ?? "").trim();
  if (url) {
    return `url:${url}`;
  }

  return null;
}

/** Index of an existing queue item for the same Spotify track, or -1. */
export function findDuplicateQueueIndex(
  queue: QueuedSong[],
  input: AddToQueueInput,
): number {
  const incomingKey = getIncomingDedupeKey(input);
  if (!incomingKey) {
    return -1;
  }

  return queue.findIndex((song) => getSongDedupeKey(song) === incomingKey);
}

export function queueHasDuplicates(queue: QueuedSong[]): boolean {
  const seen = new Set<string>();

  for (const song of queue) {
    const key = getSongDedupeKey(song);
    if (!key) {
      continue;
    }
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
  }

  return false;
}

function mergeQueueGroup(songs: QueuedSong[]): QueuedSong {
  const sorted = [...songs].sort((a, b) => a.addedAt - b.addedAt);
  const keeper = sorted[0];

  const voteCount = songs.reduce((sum, song) => sum + song.voteCount, 0);
  const voters = [
    ...new Set(songs.flatMap((song) => song.voters)),
  ];

  const albumArt =
    keeper.albumArt || songs.find((song) => song.albumArt)?.albumArt || "";
  const spotifyUrl =
    keeper.spotifyUrl || songs.find((song) => song.spotifyUrl)?.spotifyUrl || "";

  return {
    ...keeper,
    albumArt,
    spotifyUrl,
    voteCount,
    voters,
  };
}

/**
 * Merges duplicate queue entries (same Spotify track) into one card.
 * Keeps the oldest entry; sums voteCount; unions voters.
 */
export function deduplicateQueue(queue: QueuedSong[]): QueuedSong[] {
  const normalized = normalizeQueue(queue);
  const groups = new Map<string, QueuedSong[]>();
  const withoutKey: QueuedSong[] = [];

  for (const song of normalized) {
    const key = getSongDedupeKey(song);
    if (!key) {
      withoutKey.push(song);
      continue;
    }

    const group = groups.get(key) ?? [];
    group.push(song);
    groups.set(key, group);
  }

  const merged = [...groups.values()].map(mergeQueueGroup);
  return [...merged, ...withoutKey];
}

/**
 * One-time migration: merges duplicate tracks already stored in Firestore.
 * Returns true if the queue document was updated.
 */
/**
 * Ensures currentSong has full metadata and auto-starts the top queue item
 * when nothing is playing. Safe to call from realtime listeners.
 */
export async function syncRoomPlaybackState(roomId: string): Promise<boolean> {
  const db = getFirestoreDb();
  const roomRef = getRoomRef(roomId);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef);

    if (!snapshot.exists()) {
      return false;
    }

    const room = parseRoomData(snapshot.data() as Record<string, unknown>);
    const { currentSong, queue } = resolveRoomPlayback(
      room.currentSong,
      room.queue,
    );

    const currentUnchanged =
      JSON.stringify(room.currentSong) === JSON.stringify(currentSong);
    const queueUnchanged =
      JSON.stringify(deduplicateQueue(room.queue)) === JSON.stringify(queue);

    if (currentUnchanged && queueUnchanged) {
      return false;
    }

    transaction.update(roomRef, {
      currentSong: currentSong
        ? sanitizeCurrentSongForFirestore(currentSong)
        : null,
      queue: sanitizeQueueForFirestore(queue),
    });

    return true;
  });
}

export async function cleanupRoomQueueDuplicates(
  roomId: string,
): Promise<boolean> {
  const db = getFirestoreDb();
  const roomRef = getRoomRef(roomId);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef);

    if (!snapshot.exists()) {
      return false;
    }

    const room = parseRoomData(snapshot.data() as Record<string, unknown>);
    const normalized = normalizeQueue(room.queue);
    const deduped = deduplicateQueue(normalized);

    const hadDuplicates =
      deduped.length !== normalized.length || queueHasDuplicates(normalized);

    if (!hadDuplicates) {
      return false;
    }

    transaction.update(roomRef, {
      queue: sanitizeQueueForFirestore(deduped),
    });

    return true;
  });
}

function normalizeQueue(queue: QueuedSong[]): QueuedSong[] {
  return queue.map((item, index) =>
    normalizeQueuedSong(item as unknown as Record<string, unknown>, index)!,
  );
}

export function createQueuedSong(input: AddToQueueInput): QueuedSong {
  const song = normalizeQueuedSong(
    {
      id: generateId(),
      title: input.title,
      artist: input.artist,
      albumArt: input.albumArt ?? "",
      spotifyUrl: input.spotifyUrl ?? "",
      addedAt: Date.now(),
      addedBy: input.addedBy?.trim().slice(0, 16) ?? "",
      ...(input.durationMs ? { durationMs: input.durationMs } : {}),
      voteCount: 0,
      voters: [],
    },
    0,
  )!;

  logAlbumArtStage("firestore.write.queue", song.title, song.albumArt);

  return song;
}

/**
 * Adds a song to the queue, or boosts voteCount if the same Spotify track exists.
 * Uses a transaction to avoid duplicate cards under concurrent adds.
 */
export async function addSongToQueue(
  roomId: string,
  input: AddToQueueInput,
): Promise<AddSongResult> {
  const db = getFirestoreDb();
  const roomRef = getRoomRef(roomId);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef);

    if (!snapshot.exists()) {
      throw new Error("Room not found.");
    }

    const room = parseRoomData(snapshot.data() as Record<string, unknown>);
    if (room.host?.queueLocked) {
      throw new QueueLockedError();
    }

    const queue = deduplicateQueue(room.queue);
    const duplicateIndex = findDuplicateQueueIndex(queue, input);

    let updatedQueue: QueuedSong[];

    if (duplicateIndex !== -1) {
      const existing = queue[duplicateIndex];
      updatedQueue = queue.map((song, index) =>
        index === duplicateIndex
          ? { ...song, voteCount: song.voteCount + 1 }
          : song,
      );

      const { currentSong, queue: playbackQueue } = resolveRoomPlayback(
        room.currentSong,
        updatedQueue,
      );

      transaction.update(roomRef, {
        currentSong: currentSong
          ? sanitizeCurrentSongForFirestore(currentSong)
          : null,
        queue: sanitizeQueueForFirestore(playbackQueue),
      });

      return { action: "boosted", songId: existing.id };
    }

    const newSong = createQueuedSong(input);
    updatedQueue = [...queue, newSong];

    const { currentSong, queue: playbackQueue } = resolveRoomPlayback(
      room.currentSong,
      updatedQueue,
    );

    transaction.update(roomRef, {
      currentSong: currentSong
        ? sanitizeCurrentSongForFirestore(currentSong)
        : null,
      queue: sanitizeQueueForFirestore(playbackQueue),
    });

    return { action: "added", songId: newSong.id };
  });
}

/** Increments voteCount and records the voter on a queue item (transaction-safe). */
export async function upvoteQueuedSong(
  roomId: string,
  songId: string,
  voterId: string,
): Promise<void> {
  const db = getFirestoreDb();
  const roomRef = getRoomRef(roomId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef);

    if (!snapshot.exists()) {
      throw new Error("Room not found.");
    }

    const room = parseRoomData(snapshot.data() as Record<string, unknown>);
    if (room.host?.votingPaused) {
      throw new Error("Voting is paused by the DJ.");
    }

    const queue = deduplicateQueue(room.queue);
    const songIndex = queue.findIndex((song) => song.id === songId);

    if (songIndex === -1) {
      throw new Error("Song not found in queue.");
    }

    const song = queue[songIndex];

    if (song.voters.includes(voterId)) {
      throw new AlreadyVotedError();
    }

    const updatedQueue = queue.map((song, index) => {
      if (index !== songIndex) {
        return song;
      }

      return {
        ...song,
        voteCount: song.voteCount + 1,
        voters: [...song.voters, voterId],
      };
    });

    transaction.update(roomRef, {
      queue: sanitizeQueueForFirestore(updatedQueue),
    });
  });
}

/** Starts a battle when top-two songs are eligible and no battle is active. */
export async function tryStartRoomBattle(
  roomId: string,
  trigger: BattleTrigger = "auto",
): Promise<boolean> {
  const db = getFirestoreDb();
  const roomRef = getRoomRef(roomId);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) return false;

    const room = parseRoomData(snapshot.data() as Record<string, unknown>);
    if (room.battle?.active) return false;

    const queue = deduplicateQueue(room.queue);
    const contenders = detectBattleContenders(queue);
    if (!contenders) return false;

    const battle = createRoomBattle(contenders, trigger);
    transaction.update(roomRef, {
      battle: sanitizeRoomBattleForFirestore(battle),
    });
    return true;
  });
}

/** Host/manual entry point (structure for future UI). */
export async function startManualRoomBattle(roomId: string): Promise<boolean> {
  return tryStartRoomBattle(roomId, "manual");
}

/** Records the winner when live phase ends. */
export async function resolveRoomBattle(roomId: string): Promise<string | null> {
  const db = getFirestoreDb();
  const roomRef = getRoomRef(roomId);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) return null;

    const room = parseRoomData(snapshot.data() as Record<string, unknown>);
    const battle = room.battle;
    if (!battle?.active) return null;
    if (battle.winningSongId) return battle.winningSongId;

    const queue = deduplicateQueue(room.queue);
    const left = queue.find((s) => s.id === battle.leftSongId);
    const right = queue.find((s) => s.id === battle.rightSongId);
    if (!left || !right) return null;

    const winningSongId = resolveBattleWinner(left, right);
    const updatedBattle: RoomBattle = {
      ...battle,
      winningSongId,
      version: battle.version + 1,
    };

    transaction.update(roomRef, {
      battle: sanitizeRoomBattleForFirestore(updatedBattle),
    });
    return winningSongId;
  });
}

export async function clearRoomBattle(roomId: string): Promise<void> {
  const db = getFirestoreDb();
  const roomRef = getRoomRef(roomId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) return;

    transaction.update(roomRef, { battle: null });
  });
}

/**
 * Battle vote: adds vote to target contender and removes from the other if switching.
 */
export async function castBattleVote(
  roomId: string,
  songId: string,
  voterId: string,
): Promise<void> {
  const db = getFirestoreDb();
  const roomRef = getRoomRef(roomId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) {
      throw new Error("Room not found.");
    }

    const room = parseRoomData(snapshot.data() as Record<string, unknown>);
    if (room.host?.votingPaused) {
      throw new Error("Voting is paused by the DJ.");
    }

    const battle = room.battle;
    if (!battle?.active) {
      throw new BattleNotActiveError();
    }

    const now = Date.now();
    if (now >= battle.endsAt) {
      throw new BattleEndedError();
    }

    if (songId !== battle.leftSongId && songId !== battle.rightSongId) {
      throw new Error("Song is not in this battle.");
    }

    const queue = deduplicateQueue(room.queue);
    const targetIndex = queue.findIndex((song) => song.id === songId);
    if (targetIndex === -1) {
      throw new Error("Song not found in queue.");
    }

    const target = queue[targetIndex];
    if (target.voters.includes(voterId)) {
      throw new AlreadyVotedError();
    }

    const otherId =
      songId === battle.leftSongId ? battle.rightSongId : battle.leftSongId;

    const updatedQueue = queue.map((song) => {
      if (song.id === songId) {
        return {
          ...song,
          voteCount: song.voteCount + 1,
          voters: [...song.voters, voterId],
        };
      }

      if (song.id === otherId && song.voters.includes(voterId)) {
        return {
          ...song,
          voteCount: Math.max(0, song.voteCount - 1),
          voters: song.voters.filter((id) => id !== voterId),
        };
      }

      return song;
    });

    transaction.update(roomRef, {
      queue: sanitizeQueueForFirestore(updatedQueue),
    });
  });
}
