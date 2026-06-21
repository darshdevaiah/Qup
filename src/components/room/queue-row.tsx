"use client";

import { AnimatePresence, motion } from "framer-motion";

import { AlbumArt } from "@/components/room/album-art";
import { QueueSongAttribution } from "@/components/room/song-attribution";
import { SwipeToVotePill } from "@/components/room/swipe-to-vote-pill";
import type { AmbientPalette } from "@/lib/ambient-palette";
import {
  battleCardBorderColor,
  battleCardDepthShadow,
  battleDirectionalGlow,
  battleShimmerGradient,
} from "@/lib/queue-battle";
import {
  queueGlowTransition,
  queueLayoutTransition,
  queueRankCrossfade,
} from "@/lib/queue-momentum";
import { fadeSmooth } from "@/lib/motion";
import {
  cardBorderColor,
  cardDepthShadow,
  cardDirectionalGlow,
} from "@/lib/vote-heat";
import type { QueuedSong } from "@/types/firestore";

type QueueRowProps = {
  song: QueuedSong;
  index: number;
  total: number;
  ambient: AmbientPalette;
  heat: number;
  isTop: boolean;
  inBattle: boolean;
  isBattleLeader: boolean;
  voteLabel: string;
  voted: boolean;
  voteDisabled: boolean;
  isVotingThis: boolean;
  error?: string;
  pulseType: "vote" | "crown" | null;
  isNeighborPulse: boolean;
  isReordering: boolean;
  wasMoved: boolean;
  isPinned?: boolean;
  votingPaused?: boolean;
  crowdMode?: boolean;
  onVote: () => void;
};

export function QueueRow({
  song,
  index,
  total,
  ambient,
  heat,
  isTop,
  inBattle,
  isBattleLeader,
  voteLabel,
  voted,
  voteDisabled,
  isVotingThis,
  error,
  pulseType,
  isNeighborPulse,
  isReordering,
  wasMoved,
  isPinned = false,
  votingPaused = false,
  crowdMode = false,
  onVote,
}: QueueRowProps) {
  const layoutSpring = queueLayoutTransition(index, total, crowdMode);
  const isVotePulse = pulseType === "vote";
  const isCrownPulse = pulseType === "crown";

  const borderColor = isPinned
    ? `rgba(${ambient.glowRgb}, 0.42)`
    : inBattle
      ? battleCardBorderColor(true, isBattleLeader, ambient) ||
        cardBorderColor(heat, isTop, ambient)
      : cardBorderColor(heat, isTop, ambient);
  const depthShadow = inBattle
    ? battleCardDepthShadow(heat)
    : cardDepthShadow(heat);
  const directionalGlow = inBattle
    ? battleDirectionalGlow(heat, ambient)
    : cardDirectionalGlow(heat, ambient, isTop);
  const baseGlowOpacity = inBattle
    ? 0.92
    : Math.min(1, 0.5 + heat * 0.42 + (isTop ? 0.08 : 0));

  const rowScale = isVotePulse
    ? [1, 1.01, 1]
    : isCrownPulse
      ? [1, 1.012, 1]
      : isNeighborPulse
        ? [1, 0.998, 1]
        : 1;

  return (
    <motion.li
      layout
      layoutId={song.id}
      layoutScroll
      initial={false}
      animate={{
        opacity: 1,
        scale: rowScale,
        zIndex: wasMoved && isReordering ? 2 : isTop ? 1 : 0,
      }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{
        layout: layoutSpring,
        opacity: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
        scale: {
          duration: isCrownPulse ? 1.1 : 0.52,
          ease: [0.4, 0, 0.2, 1],
        },
        zIndex: { duration: 0 },
      }}
      className="relative list-none"
      style={{ willChange: isReordering ? "transform" : undefined }}
    >
      <motion.div
        layout
        whileHover={{
          y: inBattle ? -2 : -1,
          transition: { duration: 0.38, ease: [0.4, 0, 0.2, 1] },
        }}
        animate={{
          boxShadow: depthShadow,
          y: isCrownPulse ? [0, -1.5, 0] : 0,
        }}
        transition={{
          boxShadow: { duration: 0.65, ease: "easeOut" },
          layout: layoutSpring,
          y: { duration: 1.05, ease: [0.4, 0, 0.2, 1] },
        }}
        className={`group relative flex min-h-[4.125rem] items-center gap-3 overflow-hidden rounded-2xl border bg-zinc-900/50 px-3 py-[0.92rem] backdrop-blur-sm transition-[border-color,background-color,opacity] duration-700 ease-out hover:bg-zinc-900/72 sm:px-4 sm:py-[0.95rem] ${
          inBattle ? "ring-1 ring-white/[0.05]" : ""
        } ${votingPaused ? "opacity-[0.72]" : ""}`}
        style={{
          borderColor,
          backgroundColor: `rgba(24, 24, 27, ${0.45 + heat * 0.15 + (inBattle ? 0.06 : 0)})`,
        }}
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ background: directionalGlow }}
          animate={
            isVotePulse
              ? {
                  opacity: [
                    baseGlowOpacity,
                    Math.min(1, baseGlowOpacity * 1.32),
                    baseGlowOpacity,
                  ],
                }
              : isCrownPulse
                ? {
                    opacity: [
                      baseGlowOpacity,
                      Math.min(1, baseGlowOpacity * 1.48),
                      baseGlowOpacity * 1.08,
                      baseGlowOpacity,
                    ],
                  }
                : inBattle
                  ? {
                      opacity: [
                        baseGlowOpacity * 0.88,
                        baseGlowOpacity,
                        baseGlowOpacity * 0.88,
                      ],
                    }
                  : { opacity: baseGlowOpacity }
          }
          transition={
            isVotePulse || isCrownPulse
              ? queueGlowTransition
              : inBattle
                ? { duration: 3.4, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.65, ease: "easeOut" }
          }
        />

        {isCrownPulse ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50"
            initial={{ opacity: 0, x: "-55%" }}
            animate={{ opacity: [0, 0.42, 0], x: "125%" }}
            transition={{ duration: 1.05, ease: [0.4, 0, 0.2, 1] }}
            style={{ background: battleShimmerGradient(ambient) }}
          />
        ) : null}

        {inBattle ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-35"
            animate={{ background: battleShimmerGradient(ambient) }}
            transition={{
              duration: 4.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ) : null}

        {isTop && !inBattle && !isCrownPulse ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
            animate={{ background: battleShimmerGradient(ambient) }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ) : null}

          {isPinned ? (
            <span
              className="relative z-[1] w-5 shrink-0 text-center text-xs"
              aria-label="Pinned by DJ"
              title="Pinned by DJ"
            >
              👑
            </span>
          ) : (
          <motion.span
            layout
            className="relative z-[1] w-5 shrink-0 text-center text-sm font-semibold tabular-nums"
            style={{
              color:
                isTop && heat > 0 ? ambient.accent : "rgb(113, 113, 122)",
            }}
          >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={`rank-${index}`}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={queueRankCrossfade}
              className="inline-block"
            >
              {index + 1}
            </motion.span>
          </AnimatePresence>
        </motion.span>
          )}

        <div className="relative z-[1] shrink-0">
          <AlbumArt
            src={song.albumArt || undefined}
            alt={`${song.title} cover`}
            size="sm"
          />
        </div>

        <motion.div
          layout
          className="relative z-[1] min-w-0 flex-1 space-y-0.5"
        >
          <p
            className="truncate text-sm font-medium leading-snug text-white"
            style={{ opacity: 0.88 + heat * 0.12 }}
          >
            {song.title}
          </p>
          <p className="truncate text-xs leading-snug text-zinc-500">
            {song.artist}
          </p>
          {song.addedBy?.trim() ? (
            <QueueSongAttribution addedBy={song.addedBy} ambient={ambient} />
          ) : null}
          <AnimatePresence>
            {error ? (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={fadeSmooth}
                className="mt-1.5 text-xs text-red-400"
                role="alert"
              >
                {error}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </motion.div>

        <SwipeToVotePill
          songId={song.id}
          voteLabel={voteLabel}
          voted={voted}
          disabled={voteDisabled || votingPaused}
          isVoting={isVotingThis}
          heat={heat}
          ambient={ambient}
          onVote={onVote}
        />
      </motion.div>
    </motion.li>
  );
}
