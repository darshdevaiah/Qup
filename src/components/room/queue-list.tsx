"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { BattleOverlay } from "@/components/room/battle-overlay";
import { QueueRow } from "@/components/room/queue-row";
import { useBattle } from "@/hooks/use-battle";
import { useQueueMomentum } from "@/hooks/use-queue-momentum";
import { useSound } from "@/hooks/use-sound";
import { sortQueueForDisplay } from "@/lib/queue";
import { DEFAULT_ROOM_HOST_SETTINGS } from "@/lib/host-permissions";
import type { RoomHostSettings } from "@/types/firestore";
import type { AmbientPalette } from "@/lib/ambient-palette";
import { DEFAULT_PALETTE } from "@/lib/ambient-palette";
import {
  battleHeatBoost,
  detectQueueBattle,
  isBattleContender,
} from "@/lib/queue-battle";
import { fadeSmooth } from "@/lib/motion";
import { formatVoteLabel, getVoteHeat } from "@/lib/vote-heat";
import {
  AlreadyVotedError,
  castBattleVote,
  upvoteQueuedSong,
} from "@/lib/rooms";
import type { QueuedSong, RoomBattle } from "@/types/firestore";

type QueueListProps = {
  roomId: string;
  queue: QueuedSong[];
  voterId: string;
  roomBattle?: RoomBattle | null;
  pinnedSongId?: string | null;
  hostSettings?: RoomHostSettings;
  ambient?: AmbientPalette;
};

type OptimisticVote = {
  voteDelta: number;
};

export function QueueList({
  roomId,
  queue,
  voterId,
  roomBattle = null,
  pinnedSongId = null,
  hostSettings,
  ambient = DEFAULT_PALETTE,
}: QueueListProps) {
  const host = hostSettings ?? DEFAULT_ROOM_HOST_SETTINGS;
  const votingPaused = host.votingPaused;
  const crowdMode = host.crowdMode;
  const [optimisticVotes, setOptimisticVotes] = useState<
    Record<string, OptimisticVote>
  >({});
  const [votingSongId, setVotingSongId] = useState<string | null>(null);
  const [voteErrors, setVoteErrors] = useState<Record<string, string>>({});
  const isVoting = votingSongId !== null;

  useEffect(() => {
    setOptimisticVotes((prev) => {
      const next: Record<string, OptimisticVote> = {};
      for (const songId of Object.keys(prev)) {
        const song = queue.find((item) => item.id === songId);
        if (!song?.voters.includes(voterId)) {
          next[songId] = prev[songId];
        }
      }
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [queue, voterId]);

  const displayQueue = useMemo(() => {
    const withOptimisticVotes: QueuedSong[] = queue.map((song) => {
      const optimistic = optimisticVotes[song.id];
      const hasOptimisticVote = Boolean(optimistic);

      return {
        ...song,
        voteCount: Math.max(
          0,
          song.voteCount + (optimistic?.voteDelta ?? 0),
        ),
        voters: hasOptimisticVote
          ? [...song.voters, voterId]
          : song.voters,
      };
    });

    return sortQueueForDisplay(withOptimisticVotes, pinnedSongId);
  }, [queue, optimisticVotes, voterId, pinnedSongId]);

  const battleSession = useBattle({
    roomId,
    queue: displayQueue,
    roomBattle,
    voterId,
    votingPaused,
  });

  const {
    pulses,
    reordering,
    movedIds,
    triggerVotePulse,
    isNeighborOfVotePulse,
  } = useQueueMomentum(displayQueue);

  const maxVotes = useMemo(
    () => Math.max(0, ...displayQueue.map((s) => s.voteCount)),
    [displayQueue],
  );

  const legacyBattle = useMemo(
    () => detectQueueBattle(displayQueue),
    [displayQueue],
  );

  const { play } = useSound();
  const prevQueueOrderRef = useRef<string[]>([]);
  const prevBattlePhaseRef = useRef(battleSession.phase);
  const prevPulsesRef = useRef<Record<string, { type: string }>>({});

  const total = displayQueue.length;

  const contenderIds = useMemo(() => {
    if (!battleSession.contenders) return new Set<string>();
    return new Set([
      battleSession.contenders.left.id,
      battleSession.contenders.right.id,
    ]);
  }, [battleSession.contenders]);

  useEffect(() => {
    const ids = displayQueue.map((song) => song.id);
    const prev = prevQueueOrderRef.current;

    if (
      prev.length > 0 &&
      prev.join("|") !== ids.join("|") &&
      !battleSession.isOverlayVisible
    ) {
      let maxMove = 0;
      ids.forEach((id, index) => {
        const oldIndex = prev.indexOf(id);
        if (oldIndex >= 0) maxMove = Math.max(maxMove, Math.abs(oldIndex - index));
      });

      const depth = Math.max(1, ids.length - 1);
      const moveRatio = maxMove / depth;
      const topChanged = ids[0] !== prev[0];
      const intensity = Math.min(
        1,
        (topChanged ? 0.32 : 0.48) + moveRatio * 0.42,
      );
      play("queue-whoosh", { intensity });
    }

    prevQueueOrderRef.current = ids;
  }, [displayQueue, play, battleSession.isOverlayVisible]);

  useEffect(() => {
    const prev = prevBattlePhaseRef.current;
    if (battleSession.phase === "intro" && prev === "idle") {
      play("battle-enter", { intensity: 0.85 });
    }
    if (battleSession.phase === "result" && prev !== "result") {
      play("battle-resolve", { intensity: 0.9 });
    }
    prevBattlePhaseRef.current = battleSession.phase;
  }, [battleSession.phase, play]);

  useEffect(() => {
    if (legacyBattle.active && !battleSession.isOverlayVisible) {
      play("battle-enter", { intensity: 0.4 });
    }
  }, [legacyBattle.active, battleSession.isOverlayVisible, play]);

  useEffect(() => {
    for (const [songId, pulse] of Object.entries(pulses)) {
      const prior = prevPulsesRef.current[songId];
      if (pulse.type === "crown" && prior?.type !== "crown") {
        play("battle-resolve", { intensity: 0.8 });
      }
    }
    prevPulsesRef.current = Object.fromEntries(
      Object.entries(pulses).map(([id, p]) => [id, { type: p.type }]),
    );
  }, [pulses, play]);

  function hasVoted(song: QueuedSong): boolean {
    return song.voters.includes(voterId);
  }

  async function handleUpvote(songId: string) {
    if (votingPaused) return;

    const song = queue.find((item) => item.id === songId);
    if (!song || isVoting) return;

    const isBattleLive =
      battleSession.phase === "live" && contenderIds.has(songId);
    const isSwitchingSide =
      isBattleLive &&
      Boolean(battleSession.userVoteSongId) &&
      battleSession.userVoteSongId !== songId;

    if (song.voters.includes(voterId) && !isSwitchingSide) return;
    if (optimisticVotes[songId] && !isSwitchingSide) return;

    setVoteErrors((prev) => {
      const next = { ...prev };
      delete next[songId];
      return next;
    });

    setOptimisticVotes((prev) => {
      const next = { ...prev };
      if (
        isBattleLive &&
        battleSession.userVoteSongId &&
        battleSession.userVoteSongId !== songId
      ) {
        delete next[battleSession.userVoteSongId];
      }
      next[songId] = { voteDelta: 1 };
      return next;
    });
    setVotingSongId(songId);
    triggerVotePulse(songId);

    try {
      if (battleSession.phase === "live" && contenderIds.has(songId)) {
        await castBattleVote(roomId, songId, voterId);
      } else {
        await upvoteQueuedSong(roomId, songId, voterId);
      }
    } catch (error) {
      setOptimisticVotes((prev) => {
        const next = { ...prev };
        delete next[songId];
        return next;
      });

      const message =
        error instanceof AlreadyVotedError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to vote. Try again.";

      setVoteErrors((prev) => ({ ...prev, [songId]: message }));
    } finally {
      setVotingSongId(null);
    }
  }

  if (displayQueue.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={fadeSmooth}
        className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800/80 bg-zinc-900/30 px-6 py-12 text-center"
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80">
          <MusicNoteIcon className="h-6 w-6 text-zinc-500" />
        </div>
        <p className="text-sm font-medium text-zinc-400">Queue is empty</p>
        <p className="mt-1 max-w-[220px] text-xs text-zinc-600">
          Tap Add Song below to search Spotify and start the queue.
        </p>
      </motion.div>
    );
  }

  const showBattleOverlay =
    battleSession.isOverlayVisible && battleSession.contenders;

  const restQueue = showBattleOverlay
    ? displayQueue.filter((song) => !contenderIds.has(song.id))
    : displayQueue;

  return (
    <LayoutGroup id="queue-list">
      <AnimatePresence initial={false}>
        {votingPaused ? (
          <motion.p
            key="voting-paused"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={fadeSmooth}
            className="mb-2.5 text-center text-[11px] font-medium tracking-wide text-zinc-500/90"
          >
            Voting paused by host
          </motion.p>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="popLayout" initial={false}>
        {showBattleOverlay && battleSession.contenders ? (
          <motion.li
            key="battle-overlay"
            layout
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={fadeSmooth}
            className="list-none"
          >
            <BattleOverlay
              phase={battleSession.phase}
              contenders={battleSession.contenders}
              leaderId={battleSession.leaderId}
              voteDelta={battleSession.voteDelta}
              secondsRemaining={battleSession.secondsRemaining}
              winningSongId={battleSession.winningSongId}
              userVoteSongId={battleSession.userVoteSongId}
              maxVotes={maxVotes}
              votingSongId={votingSongId}
              roomAmbient={ambient}
              onVote={handleUpvote}
              formatVoteLabel={formatVoteLabel}
              getVoteHeat={getVoteHeat}
            />
          </motion.li>
        ) : null}
      </AnimatePresence>

      <motion.ul
        layout
        className="space-y-2.5"
        style={{ contain: "layout style" }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {restQueue.map((song, index) => {
            const voted = hasVoted(song);
            const isVotingThis = votingSongId === song.id;
            const error = voteErrors[song.id];
            const voteDisabled = voted || isVoting;
            const isTop = index === 0 && song.voteCount > 0;
            const inBattle =
              !showBattleOverlay && isBattleContender(song.id, legacyBattle);
            const isBattleLeader = legacyBattle.leaderId === song.id;
            const heat = Math.min(
              1,
              getVoteHeat(song.voteCount, maxVotes) +
                battleHeatBoost(inBattle),
            );
            const voteLabel = isVotingThis
              ? "…"
              : formatVoteLabel(song.voteCount);
            const pulse = pulses[song.id];
            const pulseType = pulse?.type ?? null;

            return (
              <QueueRow
                key={song.id}
                song={song}
                index={index}
                total={restQueue.length}
                ambient={ambient}
                heat={heat}
                isTop={isTop}
                inBattle={inBattle}
                isBattleLeader={isBattleLeader}
                voteLabel={voteLabel}
                voted={voted}
                voteDisabled={voteDisabled}
                isVotingThis={isVotingThis}
                error={error}
                pulseType={pulseType}
                isNeighborPulse={isNeighborOfVotePulse(index)}
                isReordering={reordering && !showBattleOverlay}
                wasMoved={movedIds.has(song.id)}
                isPinned={song.id === pinnedSongId}
                votingPaused={votingPaused}
                crowdMode={crowdMode}
                onVote={() => handleUpvote(song.id)}
              />
            );
          })}
        </AnimatePresence>
      </motion.ul>
    </LayoutGroup>
  );
}

function MusicNoteIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
      />
    </svg>
  );
}
