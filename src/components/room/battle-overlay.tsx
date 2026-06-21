"use client";

import { LayoutGroup, motion } from "framer-motion";
import { useMemo } from "react";

import { BattleCard } from "@/components/room/battle-card";
import { useAmbientPalette } from "@/hooks/use-ambient-palette";
import {
  blendBattlePalettes,
  type BattleContenders,
  type DerivedBattlePhase,
} from "@/lib/battle-state";
import type { AmbientPalette } from "@/lib/ambient-palette";
import { warmWhite } from "@/lib/ambient-palette";
import { fadeCinematic, fadeSmooth } from "@/lib/motion";

type BattleOverlayProps = {
  phase: DerivedBattlePhase;
  contenders: BattleContenders;
  leaderId: string | null;
  voteDelta: number;
  secondsRemaining: number;
  winningSongId: string | null;
  userVoteSongId: string | null;
  maxVotes: number;
  votingSongId: string | null;
  roomAmbient: AmbientPalette;
  onVote: (songId: string) => void;
  formatVoteLabel: (count: number) => string;
  getVoteHeat: (count: number, max: number) => number;
};

function BattleCenterPillar({
  phase,
  secondsRemaining,
  voteDelta,
  ambient,
}: {
  phase: DerivedBattlePhase;
  secondsRemaining: number;
  voteDelta: number;
  ambient: AmbientPalette;
}) {
  const showTimer = phase === "live";
  const showResult = phase === "result";

  return (
    <motion.div
      layout
      className="relative z-[2] flex shrink-0 flex-col items-center justify-center px-2 sm:px-3"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={fadeSmooth}
    >
      <div
        className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2"
        style={{
          background: `linear-gradient(to bottom, transparent, rgba(${ambient.glowRgb}, 0.2), transparent)`,
        }}
      />

      <motion.div
        className="relative flex min-w-[4.5rem] flex-col items-center gap-2 rounded-2xl border border-white/[0.1] bg-black/35 px-3 py-3 backdrop-blur-xl sm:min-w-[5.25rem] sm:px-4 sm:py-3.5"
        animate={{
          boxShadow: [
            `0 0 20px rgba(${ambient.glowRgb}, 0.08)`,
            `0 0 28px rgba(${ambient.glowRgb}, 0.16)`,
            `0 0 20px rgba(${ambient.glowRgb}, 0.08)`,
          ],
        }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="text-[9px] font-bold tracking-[0.32em] text-white/75 sm:text-[10px]">
          BATTLE
        </span>

        {showTimer ? (
          <motion.span
            key={secondsRemaining}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl"
          >
            {secondsRemaining}
          </motion.span>
        ) : null}

        {showResult ? (
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: ambient.accentStrong }}
          >
            Locked
          </span>
        ) : null}

        <span
          className="text-[10px] font-medium tabular-nums tracking-wide"
          style={{ color: ambient.accent, opacity: 0.7 }}
        >
          {voteDelta === 0 ? "Tied" : `+${voteDelta}`}
        </span>
      </motion.div>
    </motion.div>
  );
}

export function BattleOverlay({
  phase,
  contenders,
  leaderId,
  voteDelta,
  secondsRemaining,
  winningSongId,
  userVoteSongId,
  maxVotes,
  votingSongId,
  roomAmbient,
  onVote,
  formatVoteLabel,
  getVoteHeat,
}: BattleOverlayProps) {
  const leftPalette = useAmbientPalette(contenders.left.albumArt);
  const rightPalette = useAmbientPalette(contenders.right.albumArt);
  const battleAmbient = useMemo(
    () => blendBattlePalettes(leftPalette, rightPalette),
    [leftPalette, rightPalette],
  );
  const ambient = battleAmbient;

  const { left, right } = contenders;

  return (
    <motion.section
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={fadeCinematic}
      className="relative overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-zinc-950/40 p-3 backdrop-blur-md sm:p-4"
      role="region"
      aria-label="Queue battle"
      aria-live="polite"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            `radial-gradient(ellipse 55% 70% at 12% 50%, rgba(${leftPalette.glowRgb}, 0.14), transparent 58%)`,
            `radial-gradient(ellipse 55% 70% at 88% 50%, rgba(${rightPalette.glowRgb}, 0.14), transparent 58%)`,
            `radial-gradient(ellipse 50% 40% at 50% 0%, ${warmWhite(0.05)}, transparent 70%)`,
          ].join(", "),
        }}
        animate={{ opacity: [0.7, 0.95, 0.7] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-[1] mb-3 text-center">
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/55 sm:text-[11px]"
        >
          {phase === "intro"
            ? "Showdown loading"
            : phase === "result"
              ? "Battle resolved"
              : "Vote now — pick a side"}
        </motion.p>
      </div>

      <LayoutGroup id="battle-cards">
        <div className="relative z-[1] flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-2">
          <BattleCard
            song={left}
            side="left"
            phase={phase}
            ambient={roomAmbient}
            cardPalette={leftPalette}
            heat={getVoteHeat(left.voteCount, maxVotes)}
            isLeader={leaderId === left.id}
            isWinner={winningSongId === left.id}
            isLoser={phase === "result" && winningSongId === right.id}
            voted={userVoteSongId === left.id}
            voteDisabled={votingSongId !== null}
            isVoting={votingSongId === left.id}
            voteLabel={formatVoteLabel(left.voteCount)}
            onVote={() => onVote(left.id)}
          />

          <BattleCenterPillar
            phase={phase}
            secondsRemaining={secondsRemaining}
            voteDelta={voteDelta}
            ambient={ambient}
          />

          <BattleCard
            song={right}
            side="right"
            phase={phase}
            ambient={roomAmbient}
            cardPalette={rightPalette}
            heat={getVoteHeat(right.voteCount, maxVotes)}
            isLeader={leaderId === right.id}
            isWinner={winningSongId === right.id}
            isLoser={phase === "result" && winningSongId === left.id}
            voted={userVoteSongId === right.id}
            voteDisabled={votingSongId !== null}
            isVoting={votingSongId === right.id}
            voteLabel={formatVoteLabel(right.voteCount)}
            onVote={() => onVote(right.id)}
          />
        </div>
      </LayoutGroup>
    </motion.section>
  );
}
