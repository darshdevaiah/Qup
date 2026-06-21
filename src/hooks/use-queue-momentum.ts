"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CROWN_PULSE_MS,
  type QueuePulse,
  type QueuePulseType,
  REORDER_SETTLE_MS,
  VOTE_PULSE_MS,
} from "@/lib/queue-momentum";
import type { QueuedSong } from "@/types/firestore";

type Snapshot = Map<string, { index: number; voteCount: number }>;

function prunePulses(pulses: Record<string, QueuePulse>, now: number) {
  const next: Record<string, QueuePulse> = {};
  for (const [id, pulse] of Object.entries(pulses)) {
    if (pulse.until > now) next[id] = pulse;
  }
  return next;
}

export function useQueueMomentum(displayQueue: QueuedSong[]) {
  const snapshotRef = useRef<Snapshot>(new Map());
  const [pulses, setPulses] = useState<Record<string, QueuePulse>>({});
  const [reordering, setReordering] = useState(false);
  const [movedIds, setMovedIds] = useState<Set<string>>(new Set());
  const reorderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addPulse = useCallback((songId: string, type: QueuePulseType) => {
    const duration = type === "crown" ? CROWN_PULSE_MS : VOTE_PULSE_MS;
    const now = Date.now();
    setPulses((prev) => {
      const existing = prev[songId];
      if (existing?.type === "crown" && type === "vote") {
        return prev;
      }
      return {
        ...prev,
        [songId]: { type, until: now + duration },
      };
    });
  }, []);

  const triggerVotePulse = useCallback(
    (songId: string) => addPulse(songId, "vote"),
    [addPulse],
  );

  useEffect(() => {
    const prev = snapshotRef.current;
    const next: Snapshot = new Map();
    const now = Date.now();
    let orderChanged = false;
    const newlyMoved = new Set<string>();
    const pulseUpdates: Record<string, QueuePulse> = {};

    displayQueue.forEach((song, index) => {
      next.set(song.id, { index, voteCount: song.voteCount });
      const prior = prev.get(song.id);

      if (!prior) return;

      if (prior.index !== index) {
        orderChanged = true;
        newlyMoved.add(song.id);
      }

      if (song.voteCount > prior.voteCount) {
        pulseUpdates[song.id] = {
          type: "vote",
          until: now + VOTE_PULSE_MS,
        };
      }

      if (
        index === 0 &&
        prior.index > 0 &&
        song.voteCount > 0
      ) {
        pulseUpdates[song.id] = {
          type: "crown",
          until: now + CROWN_PULSE_MS,
        };
      }
    });

    snapshotRef.current = next;

    if (Object.keys(pulseUpdates).length > 0) {
      setPulses((p) => {
        const merged = { ...p };
        for (const [id, pulse] of Object.entries(pulseUpdates)) {
          if (merged[id]?.type === "crown" && pulse.type === "vote") continue;
          merged[id] = pulse;
        }
        return merged;
      });
    }

    if (orderChanged) {
      setReordering(true);
      setMovedIds((prev) => new Set([...prev, ...newlyMoved]));

      if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
      reorderTimerRef.current = setTimeout(() => {
        setReordering(false);
      }, REORDER_SETTLE_MS);

      if (movedTimerRef.current) clearTimeout(movedTimerRef.current);
      movedTimerRef.current = setTimeout(() => {
        setMovedIds(new Set());
      }, REORDER_SETTLE_MS + 80);
    }
  }, [displayQueue]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setPulses((p) => {
        const pruned = prunePulses(p, now);
        return Object.keys(pruned).length === Object.keys(p).length ? p : pruned;
      });
    };

    const id = window.setInterval(tick, 120);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
      if (movedTimerRef.current) clearTimeout(movedTimerRef.current);
    };
  }, []);

  const votePulseIndex = displayQueue.findIndex(
    (song) => pulses[song.id]?.type === "vote",
  );

  const isNeighborOfVotePulse = useCallback(
    (index: number) =>
      votePulseIndex >= 0 && Math.abs(votePulseIndex - index) === 1,
    [votePulseIndex],
  );

  return {
    pulses,
    reordering,
    movedIds,
    triggerVotePulse,
    isNeighborOfVotePulse,
  };
}
