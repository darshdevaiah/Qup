"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildRoomActionSignals,
  deriveRoomActionContextFromSignals,
  getCurrentSongFingerprint,
  getQueueSignature,
  QUEUE_ACTIVITY_WINDOW_MS,
  SONG_CHANGED_WINDOW_MS,
  type RoomActionContext,
} from "@/lib/room-action-context";
import { detectQueueBattle } from "@/lib/queue-battle";
import { sortQueueByVotes } from "@/lib/queue";
import type { NowPlayingSong, QueuedSong } from "@/types/firestore";

type UseRoomActionContextInput = {
  queue: QueuedSong[];
  currentSong: NowPlayingSong | null;
  displayName: string;
};

type UseRoomActionContextResult = {
  actionContext: RoomActionContext;
  signals: ReturnType<typeof buildRoomActionSignals>;
};

/**
 * Live-derived floating pill context — recomputes on queue/vote/battle/song changes
 * and refreshes when time-window states expire.
 */
export function useRoomActionContext({
  queue,
  currentSong,
  displayName,
}: UseRoomActionContextInput): UseRoomActionContextResult {
  const [now, setNow] = useState(() => Date.now());
  const [songChangedAt, setSongChangedAt] = useState<number | null>(null);
  const [queueActivityAt, setQueueActivityAt] = useState<number | null>(null);

  const prevSongKeyRef = useRef("");
  const knownQueueIdsRef = useRef<Set<string>>(new Set());
  const queueInitializedRef = useRef(false);
  const prevBattleActiveRef = useRef(false);

  const queueSignature = useMemo(() => getQueueSignature(queue), [queue]);
  const songFingerprint = useMemo(
    () => getCurrentSongFingerprint(currentSong),
    [currentSong],
  );

  useEffect(() => {
    if (songFingerprint && songFingerprint !== prevSongKeyRef.current) {
      setSongChangedAt(Date.now());
      prevSongKeyRef.current = songFingerprint;
    }

    if (!songFingerprint) {
      prevSongKeyRef.current = "";
    }
  }, [songFingerprint]);

  useEffect(() => {
    const ids = new Set(queue.map((song) => song.id));
    let hasNewSong = false;

    if (queueInitializedRef.current) {
      for (const id of ids) {
        if (!knownQueueIdsRef.current.has(id)) {
          hasNewSong = true;
          break;
        }
      }
    } else if (ids.size > 0) {
      queueInitializedRef.current = true;
    }

    if (hasNewSong) {
      setQueueActivityAt(Date.now());
    }

    knownQueueIdsRef.current = ids;
  }, [queueSignature, queue]);

  useEffect(() => {
    const battleActive = detectQueueBattle(sortQueueByVotes(queue)).active;

    if (prevBattleActiveRef.current && !battleActive) {
      setSongChangedAt(null);
      setNow(Date.now());
    }

    prevBattleActiveRef.current = battleActive;
  }, [queueSignature, queue]);

  useEffect(() => {
    const hasTimedState = songChangedAt !== null || queueActivityAt !== null;
    if (!hasTimedState) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1500);

    return () => window.clearInterval(interval);
  }, [songChangedAt, queueActivityAt, queueSignature, songFingerprint]);

  useEffect(() => {
    setNow(Date.now());
  }, [queueSignature, songFingerprint, displayName]);

  const signals = useMemo(
    () =>
      buildRoomActionSignals({
        queue,
        currentSong,
        displayName,
        now,
        songChangedAt,
        queueActivityAt,
      }),
    [
      queue,
      queueSignature,
      currentSong,
      songFingerprint,
      displayName,
      now,
      songChangedAt,
      queueActivityAt,
    ],
  );

  const actionContext = useMemo(
    () => deriveRoomActionContextFromSignals(signals),
    [signals],
  );

  useEffect(() => {
    if (!songChangedAt && !queueActivityAt) {
      return;
    }

    const songRemaining = songChangedAt
      ? SONG_CHANGED_WINDOW_MS - (now - songChangedAt)
      : 0;
    const queueRemaining = queueActivityAt
      ? QUEUE_ACTIVITY_WINDOW_MS - (now - queueActivityAt)
      : 0;
    const maxRemaining = Math.max(songRemaining, queueRemaining);

    if (maxRemaining <= 0) {
      if (songChangedAt && songRemaining <= 0) {
        setSongChangedAt(null);
      }
      if (queueActivityAt && queueRemaining <= 0) {
        setQueueActivityAt(null);
      }
      return;
    }

    const timeout = window.setTimeout(() => {
      setNow(Date.now());
    }, maxRemaining + 50);

    return () => window.clearTimeout(timeout);
  }, [now, songChangedAt, queueActivityAt]);

  return { actionContext, signals };
}
