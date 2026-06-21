import { runTransaction } from "firebase/firestore";

import { getFirestoreDb } from "@/lib/firebase";
import {
  assertRoomHost,
  DEFAULT_ROOM_HOST_SETTINGS,
  HostPermissionError,
  sanitizeRoomHostSettingsForFirestore,
} from "@/lib/host-permissions";
import { sortQueueForDisplay } from "@/lib/queue";
import {
  deduplicateQueue,
  getRoomRef,
  parseRoomData,
  queuedSongToCurrentSong,
  resolveRoomPlayback,
  sanitizeCurrentSongForFirestore,
  sanitizeQueuedSongForFirestore,
  startManualRoomBattle,
} from "@/lib/rooms";
import type { RoomHostSettings } from "@/types/firestore";

export type HostSettingsPatch = Partial<
  Pick<
    RoomHostSettings,
    "votingPaused" | "queueLocked" | "explicitFilterEnabled" | "crowdMode"
  >
>;

function mergeHostSettings(
  current: RoomHostSettings | undefined,
  patch: HostSettingsPatch,
): RoomHostSettings {
  const base = current ?? DEFAULT_ROOM_HOST_SETTINGS;
  return {
    ...base,
    ...patch,
  };
}

export async function claimRoomHost(
  roomId: string,
  voterId: string,
): Promise<void> {
  const db = getFirestoreDb();
  const roomRef = getRoomRef(roomId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) throw new Error("Room not found.");

    const room = parseRoomData(snapshot.data() as Record<string, unknown>);
    if (room.host?.hostId && room.host.hostId !== voterId) {
      throw new HostPermissionError("This room already has a DJ.");
    }

    const host: RoomHostSettings = {
      ...DEFAULT_ROOM_HOST_SETTINGS,
      hostId: voterId,
    };

    transaction.update(roomRef, {
      host: sanitizeRoomHostSettingsForFirestore(host),
    });
  });
}

export async function updateRoomHostSettings(
  roomId: string,
  hostVoterId: string,
  patch: HostSettingsPatch,
): Promise<void> {
  const db = getFirestoreDb();
  const roomRef = getRoomRef(roomId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) throw new Error("Room not found.");

    const room = parseRoomData(snapshot.data() as Record<string, unknown>);
    assertRoomHost(room, hostVoterId);

    const host = mergeHostSettings(room.host, patch);
    transaction.update(roomRef, {
      host: sanitizeRoomHostSettingsForFirestore(host),
    });
  });
}

export async function hostSkipCurrentSong(
  roomId: string,
  hostVoterId: string,
): Promise<void> {
  const db = getFirestoreDb();
  const roomRef = getRoomRef(roomId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) throw new Error("Room not found.");

    const room = parseRoomData(snapshot.data() as Record<string, unknown>);
    assertRoomHost(room, hostVoterId);

    const queue = deduplicateQueue(room.queue);
    const ordered = sortQueueForDisplay(queue, room.pinnedSongId);

    if (ordered.length === 0) {
      transaction.update(roomRef, { currentSong: null });
      return;
    }

    const next = ordered[0];
    const newQueue = queue.filter((song) => song.id !== next.id);
    const currentSong = queuedSongToCurrentSong(next);

    transaction.update(roomRef, {
      currentSong: sanitizeCurrentSongForFirestore(currentSong),
      queue: newQueue.map(sanitizeQueuedSongForFirestore),
    });
  });
}

export async function hostRemoveQueuedSong(
  roomId: string,
  hostVoterId: string,
  songId: string,
): Promise<void> {
  const db = getFirestoreDb();
  const roomRef = getRoomRef(roomId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) throw new Error("Room not found.");

    const room = parseRoomData(snapshot.data() as Record<string, unknown>);
    assertRoomHost(room, hostVoterId);

    const queue = deduplicateQueue(room.queue).filter(
      (song) => song.id !== songId,
    );
    const pinnedSongId =
      room.pinnedSongId === songId ? null : room.pinnedSongId ?? null;

    const { currentSong, queue: playbackQueue } = resolveRoomPlayback(
      room.currentSong,
      queue,
    );

    transaction.update(roomRef, {
      queue: playbackQueue.map(sanitizeQueuedSongForFirestore),
      currentSong: currentSong
        ? sanitizeCurrentSongForFirestore(currentSong)
        : null,
      pinnedSongId,
    });
  });
}

export async function hostPinQueuedSong(
  roomId: string,
  hostVoterId: string,
  songId: string | null,
): Promise<void> {
  const db = getFirestoreDb();
  const roomRef = getRoomRef(roomId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) throw new Error("Room not found.");

    const room = parseRoomData(snapshot.data() as Record<string, unknown>);
    assertRoomHost(room, hostVoterId);

    if (songId) {
      const exists = room.queue.some((song) => song.id === songId);
      if (!exists) throw new Error("Song not found in queue.");
    }

    transaction.update(roomRef, { pinnedSongId: songId });
  });
}

export async function hostTriggerBattle(
  roomId: string,
  hostVoterId: string,
): Promise<boolean> {
  const db = getFirestoreDb();
  const roomRef = getRoomRef(roomId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) throw new Error("Room not found.");

    const room = parseRoomData(snapshot.data() as Record<string, unknown>);
    assertRoomHost(room, hostVoterId);
  });

  return startManualRoomBattle(roomId);
}
