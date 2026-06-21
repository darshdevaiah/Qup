import type { Transition } from "framer-motion";

export const VOTE_PULSE_MS = 580;
export const CROWN_PULSE_MS = 1200;
export const REORDER_SETTLE_MS = 480;

export type QueuePulseType = "vote" | "crown";

export type QueuePulse = {
  type: QueuePulseType;
  until: number;
};

/**
 * Rank-aware layout spring — top rows feel anchored, lower rows glide more.
 * Overdamped: calm, confident, no bounce.
 */
export function queueLayoutTransition(
  rankIndex: number,
  total: number,
  crowdMode = false,
): Transition {
  const depth = total <= 1 ? 0 : rankIndex / Math.max(1, total - 1);
  const crowdBoost = crowdMode ? 1.22 : 1;

  return {
    type: "spring",
    stiffness: (218 - depth * 38) * crowdBoost,
    damping: (39 + depth * 1.5) / (crowdMode ? 1.08 : 1),
    mass: (1.08 - depth * 0.14) / (crowdMode ? 1.12 : 1),
  };
}

export const queueGlowTransition: Transition = {
  duration: 0.55,
  ease: [0.4, 0, 0.2, 1],
};

export const queueRankCrossfade: Transition = {
  duration: 0.38,
  ease: [0.4, 0, 0.2, 1],
};
