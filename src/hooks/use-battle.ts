"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  BATTLE_RESULT_MS,
  buildBattleViewModel,
  detectBattleContenders,
  type BattleViewModel,
} from "@/lib/battle-state";
import {
  clearRoomBattle,
  resolveRoomBattle,
  tryStartRoomBattle,
} from "@/lib/rooms";
import type { RoomBattle } from "@/types/firestore";
import type { QueuedSong } from "@/types/firestore";

type UseBattleOptions = {
  roomId: string;
  queue: QueuedSong[];
  roomBattle: RoomBattle | null | undefined;
  voterId: string;
  enabled?: boolean;
  votingPaused?: boolean;
};

export function useBattle({
  roomId,
  queue,
  roomBattle,
  voterId,
  enabled = true,
  votingPaused = false,
}: UseBattleOptions) {
  const [now, setNow] = useState(() => Date.now());
  const startAttemptedRef = useRef(false);
  const resolveAttemptedRef = useRef(false);
  const clearAttemptedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const viewModel: BattleViewModel = useMemo(
    () => buildBattleViewModel(queue, roomBattle, voterId, now),
    [queue, roomBattle, voterId, now],
  );

  const eligible = useMemo(() => detectBattleContenders(queue), [queue]);

  useEffect(() => {
    if (!roomBattle?.active) {
      startAttemptedRef.current = false;
    }
  }, [roomBattle?.active]);

  useEffect(() => {
    if (!enabled || votingPaused || roomBattle?.active || !eligible) {
      return;
    }

    if (startAttemptedRef.current) return;
    startAttemptedRef.current = true;

    void tryStartRoomBattle(roomId, "auto").catch((error) => {
      console.error("[Qup] Battle start failed:", error);
      startAttemptedRef.current = false;
    });
  }, [enabled, votingPaused, eligible, roomBattle?.active, roomId]);

  useEffect(() => {
    if (!roomBattle?.active) {
      resolveAttemptedRef.current = false;
      clearAttemptedRef.current = false;
      return;
    }

    if (
      viewModel.phase === "result" &&
      !roomBattle.winningSongId &&
      !resolveAttemptedRef.current
    ) {
      resolveAttemptedRef.current = true;
      void resolveRoomBattle(roomId).catch((error) => {
        console.error("[Qup] Battle resolve failed:", error);
        resolveAttemptedRef.current = false;
      });
    }

    const resultExpired =
      viewModel.phase === "idle" &&
      now >= roomBattle.endsAt + BATTLE_RESULT_MS;

    if (resultExpired && !clearAttemptedRef.current) {
      clearAttemptedRef.current = true;
      void clearRoomBattle(roomId).catch((error) => {
        console.error("[Qup] Battle clear failed:", error);
        clearAttemptedRef.current = false;
      });
    }
  }, [
    now,
    roomBattle,
    roomId,
    viewModel.phase,
  ]);

  const resetStartLatch = useCallback(() => {
    startAttemptedRef.current = false;
  }, []);

  return {
    ...viewModel,
    eligible,
    resetStartLatch,
  };
}
