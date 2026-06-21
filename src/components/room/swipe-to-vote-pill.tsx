"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { useSound } from "@/hooks/use-sound";
import type { AmbientPalette } from "@/lib/ambient-palette";
import { votePillBoxShadow } from "@/lib/vote-heat";

const VOTE_THRESHOLD = 0.65;
const ICON_SIZE = 16;
const SWIPE_PADDING = 8;

const springSnap = {
  type: "spring" as const,
  stiffness: 420,
  damping: 32,
  mass: 0.75,
};

const springReturn = {
  type: "spring" as const,
  stiffness: 340,
  damping: 30,
  mass: 0.8,
};

type SwipeToVotePillProps = {
  songId: string;
  voteLabel: string;
  voted: boolean;
  disabled: boolean;
  isVoting: boolean;
  heat: number;
  ambient: AmbientPalette;
  onVote: () => void | Promise<void>;
};

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h12M13 7l5 5-5 5" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 12.5 10 16.5 18 8.5" />
    </svg>
  );
}

function iconGlowFilter(heat: number, ambient: AmbientPalette, extra = 0): string {
  const spread = 4 + heat * 6 + extra * 4;
  const alpha = 0.14 + heat * 0.18 + extra * 0.12;
  return `drop-shadow(0 0 ${spread}px rgba(${ambient.glowRgb}, ${alpha}))`;
}

export function SwipeToVotePill({
  songId,
  voteLabel,
  voted,
  disabled,
  isVoting,
  heat,
  ambient,
  onVote,
}: SwipeToVotePillProps) {
  const { play, unlock } = useSound();
  const swipeRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef(false);
  const dragTickRef = useRef(0);
  const [swipeWidth, setSwipeWidth] = useState(48);
  const [isDragging, setIsDragging] = useState(false);
  const [showPlusOne, setShowPlusOne] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);

  const maxDrag = Math.max(8, (swipeWidth - ICON_SIZE) / 2 - SWIPE_PADDING);
  const dragX = useMotionValue(0);
  const dragProgress = useTransform(dragX, (value) =>
    Math.min(1, Math.max(0, value / maxDrag)),
  );
  const iconOpacity = useTransform(dragProgress, [0, 1], [0.48 + heat * 0.18, 1]);

  const isInteractive = !disabled && !voted;
  const isRestingVoted = voted && !isDragging && !successFlash;
  const showCheckIcon = isRestingVoted || successFlash;

  useEffect(() => {
    const node = swipeRef.current;
    if (!node) return;

    const update = () => setSwipeWidth(node.clientWidth);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    committedRef.current = false;
    setShowPlusOne(false);
    setSuccessFlash(false);
    setIsDragging(false);
    dragX.set(0);
  }, [songId, dragX]);

  useEffect(() => {
    if (voted) dragX.set(0);
  }, [voted, dragX]);

  useMotionValueEvent(dragX, "change", (latest) => {
    if (!isDragging || maxDrag <= 0) return;

    const progress = Math.min(1, Math.max(0, latest / maxDrag));
    const milestone = Math.floor(progress * 4);
    if (milestone > dragTickRef.current) {
      dragTickRef.current = milestone;
      play("vote-drag-tick", { intensity: 0.25 + progress * 0.45 });
    }
  });

  async function handleDragEnd() {
    if (disabled || voted || committedRef.current) {
      await animate(dragX, 0, springReturn);
      setIsDragging(false);
      return;
    }

    const offset = dragX.get();

    if (offset < maxDrag * VOTE_THRESHOLD) {
      setIsDragging(false);
      await animate(dragX, 0, springReturn);
      return;
    }

    committedRef.current = true;
    setIsDragging(false);
    setSuccessFlash(true);
    setShowPlusOne(true);
    play("vote-commit", { intensity: 0.7 + heat * 0.25 });

    const votePromise = onVote();

    try {
      await animate(dragX, maxDrag, springSnap);
      await votePromise;
      play("vote-bloom", { intensity: 0.55 + heat * 0.3 });
      await new Promise((resolve) => window.setTimeout(resolve, 380));
    } catch {
      committedRef.current = false;
      setSuccessFlash(false);
      setShowPlusOne(false);
      await animate(dragX, 0, springReturn);
      return;
    }

    setShowPlusOne(false);
    setSuccessFlash(false);
    await animate(dragX, 0, springReturn);
  }

  return (
    <motion.div
      className="relative z-[1] flex w-[3.5rem] shrink-0 touch-manipulation select-none flex-col items-center justify-center gap-1 self-center py-0.5"
      aria-label={
        voted
          ? `Voted for this track, ${voteLabel}`
          : `Swipe right to vote, ${voteLabel}`
      }
      aria-pressed={voted}
      aria-busy={isVoting}
      style={{ opacity: disabled && !voted ? 0.4 : 1 }}
      animate={{
        filter: isDragging
          ? iconGlowFilter(heat, ambient, 0.4)
          : successFlash
            ? iconGlowFilter(heat, ambient, 0.55)
            : isRestingVoted
              ? "none"
              : [
                  "none",
                  iconGlowFilter(heat, ambient, 0.1),
                  "none",
                ],
      }}
      whileHover={
        isRestingVoted
          ? { filter: iconGlowFilter(heat, ambient, 0.08) }
          : !disabled && !isDragging
            ? { filter: iconGlowFilter(heat, ambient, 0.14) }
            : undefined
      }
      transition={
        isDragging || successFlash
          ? { duration: 0.2 }
          : isRestingVoted
            ? { duration: 0.25 }
            : { duration: 3.6, repeat: Infinity, ease: "easeInOut" }
      }
    >
      {successFlash ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute top-1 left-1/2 h-7 w-10 -translate-x-1/2 rounded-full blur-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 0.55, repeat: 1, ease: "easeInOut" }}
          style={{
            background: `radial-gradient(ellipse, rgba(${ambient.glowRgb}, 0.35), transparent 70%)`,
            boxShadow: votePillBoxShadow(heat, ambient, 0.12),
          }}
        />
      ) : null}

      <div
        ref={swipeRef}
        className="relative flex h-5 w-full items-center justify-center overflow-visible"
      >
        <motion.div
          drag={isInteractive ? "x" : false}
          dragConstraints={{ left: 0, right: maxDrag }}
          dragElastic={0.1}
          dragMomentum={false}
            onDragStart={() => {
              if (!isInteractive) return;
              unlock();
              dragTickRef.current = 0;
              setIsDragging(true);
              play("vote-drag-start");
            }}
          onDragEnd={handleDragEnd}
          style={{ x: dragX }}
          whileDrag={isInteractive ? { scale: 1.1 } : undefined}
          className={`relative flex items-center justify-center ${
            isInteractive
              ? "cursor-grab touch-none active:cursor-grabbing"
              : "cursor-default"
          }`}
        >
          <motion.div
            style={{
              opacity: showCheckIcon ? (isRestingVoted ? 0.5 : 0.88) : iconOpacity,
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {showCheckIcon ? (
                <motion.span
                  key="check"
                  initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.75 }}
                  transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                >
                  <CheckIcon
                    className={`h-4 w-4 ${isRestingVoted ? "text-white/50" : "text-white/75"}`}
                  />
                </motion.span>
              ) : (
                <motion.span
                  key="arrow"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    color: isDragging
                      ? ambient.accentStrong
                      : heat > 0.35
                        ? ambient.accent
                        : "rgb(161, 161, 170)",
                  }}
                  exit={{ opacity: 0, scale: 0.7, rotate: 8 }}
                  transition={{ duration: 0.22 }}
                >
                  <ArrowRightIcon className="h-4 w-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>

      <div className="relative flex items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={isVoting ? "loading" : voteLabel}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
              className="whitespace-nowrap text-center text-[10px] font-medium leading-tight text-zinc-500 sm:text-[11px]"
          >
            {isVoting ? "…" : voteLabel}
          </motion.span>
        </AnimatePresence>

        <AnimatePresence>
          {showPlusOne ? (
            <motion.span
              key="plus-one"
              initial={{ opacity: 0, y: 0, scale: 0.8 }}
              animate={{ opacity: 1, y: -10, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.9 }}
              transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
              className="pointer-events-none absolute -top-3 right-0 text-[10px] font-semibold"
              style={{ color: ambient.accentStrong }}
            >
              +1
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
