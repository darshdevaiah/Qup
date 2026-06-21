"use client";

import { motion } from "framer-motion";

import { AlbumArt } from "@/components/room/album-art";
import { QueueSongAttribution } from "@/components/room/song-attribution";
import { SwipeToVotePill } from "@/components/room/swipe-to-vote-pill";
import type { AmbientPalette } from "@/lib/ambient-palette";
import { warmWhite } from "@/lib/ambient-palette";
import { battleLayoutId } from "@/lib/battle-state";
import { battleShimmerGradient } from "@/lib/queue-battle";
import { springPremium } from "@/lib/motion";
import type { DerivedBattlePhase } from "@/lib/battle-state";
import type { QueuedSong } from "@/types/firestore";

type BattleCardProps = {
  song: QueuedSong;
  side: "left" | "right";
  phase: DerivedBattlePhase;
  ambient: AmbientPalette;
  cardPalette: AmbientPalette;
  heat: number;
  isLeader: boolean;
  isWinner: boolean;
  isLoser: boolean;
  voted: boolean;
  voteDisabled: boolean;
  isVoting: boolean;
  voteLabel: string;
  onVote: () => void;
};

export function BattleCard({
  song,
  side,
  phase,
  ambient,
  cardPalette,
  heat,
  isLeader,
  isWinner,
  isLoser,
  voted,
  voteDisabled,
  isVoting,
  voteLabel,
  onVote,
}: BattleCardProps) {
  const isLive = phase === "live";
  const pushForward = isLeader && isLive;
  const scale =
    phase === "result"
      ? isWinner
        ? 1.04
        : isLoser
          ? 0.94
          : 1
      : pushForward
        ? 1.03
        : isLoser
          ? 0.98
          : 1;

  const opacity = phase === "result" && isLoser ? 0.42 : isLeader ? 1 : 0.88;

  return (
    <motion.article
      layout
      layoutId={battleLayoutId(song.id)}
      initial={{ opacity: 0, y: side === "left" ? 12 : 16, scale: 0.96 }}
      animate={{ opacity, scale, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={springPremium}
      className={`relative flex min-w-0 flex-1 flex-col ${
        side === "left" ? "items-stretch" : "items-stretch"
      }`}
      style={{
        zIndex: pushForward || isWinner ? 2 : 1,
      }}
    >
      <motion.div
        className="relative overflow-hidden rounded-2xl border bg-zinc-900/55 px-3 py-3 backdrop-blur-md sm:rounded-[1.35rem] sm:px-4 sm:py-4"
        animate={{
          boxShadow: isLeader
            ? `0 16px 40px rgba(0,0,0,0.45), 0 0 36px rgba(${cardPalette.glowRgb}, 0.2)`
            : `0 10px 28px rgba(0,0,0,0.35), 0 0 18px rgba(${cardPalette.glowRgb}, 0.08)`,
          borderColor: isLeader
            ? warmWhite(0.18)
            : `rgba(${cardPalette.glowRgb}, 0.12)`,
        }}
        transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background: `radial-gradient(ellipse 80% 90% at ${
              side === "left" ? "15%" : "85%"
            } 40%, rgba(${cardPalette.glowRgb}, 0.14), transparent 60%)`,
          }}
          animate={{ opacity: isLeader ? [0.4, 0.65, 0.4] : [0.25, 0.35, 0.25] }}
          transition={{
            duration: 4.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {isWinner && phase === "result" ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-45"
            initial={{ x: "-60%", opacity: 0 }}
            animate={{ x: "130%", opacity: [0, 0.5, 0] }}
            transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
            style={{ background: battleShimmerGradient(ambient) }}
          />
        ) : null}

        <div className="relative z-[1] flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <AlbumArt
              src={song.albumArt || undefined}
              alt={`${song.title} cover`}
              size="md"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-semibold tracking-tight text-white sm:text-base">
                {song.title}
              </p>
              <p className="truncate text-xs text-zinc-400 sm:text-sm">
                {song.artist}
              </p>
              {song.addedBy?.trim() ? (
                <QueueSongAttribution
                  addedBy={song.addedBy}
                  ambient={cardPalette}
                />
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p
              className="text-lg font-bold tabular-nums tracking-tight sm:text-xl"
              style={{ color: isLeader ? ambient.accentStrong : ambient.accent }}
            >
              {song.voteCount}
            </p>
            <SwipeToVotePill
              songId={song.id}
              voteLabel={voteLabel}
              voted={voted}
              disabled={voteDisabled || !isLive}
              isVoting={isVoting}
              heat={heat}
              ambient={cardPalette}
              onVote={onVote}
            />
          </div>
        </div>
      </motion.div>
    </motion.article>
  );
}
