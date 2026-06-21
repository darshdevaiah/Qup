import type { AmbientPalette } from "@/lib/ambient-palette";
import { warmWhite } from "@/lib/ambient-palette";
import type { QueuedSong } from "@/types/firestore";

export type QueueBattleState = {
  active: boolean;
  contenderIds: [string, string] | null;
  label: string;
  leaderId: string | null;
};

import {
  BATTLE_MAX_VOTE_GAP,
  BATTLE_MIN_VOTES,
} from "@/lib/battle-state";

const MIN_VOTES = BATTLE_MIN_VOTES;
const MAX_VOTE_GAP = BATTLE_MAX_VOTE_GAP;

/** Client-side battle detection from vote-sorted queue (top two only). */
export function detectQueueBattle(queue: QueuedSong[]): QueueBattleState {
  const inactive: QueueBattleState = {
    active: false,
    contenderIds: null,
    label: "",
    leaderId: null,
  };

  if (queue.length < 2) {
    return inactive;
  }

  const first = queue[0];
  const second = queue[1];
  const gap = Math.abs(first.voteCount - second.voteCount);

  if (
    first.voteCount < MIN_VOTES ||
    second.voteCount < MIN_VOTES ||
    gap > MAX_VOTE_GAP
  ) {
    return inactive;
  }

  const leaderId =
    first.voteCount > second.voteCount
      ? first.id
      : second.voteCount > first.voteCount
        ? second.id
        : null;

  return {
    active: true,
    contenderIds: [first.id, second.id],
    label: getBattleLabel(first.voteCount, second.voteCount),
    leaderId,
  };
}

function getBattleLabel(votesA: number, votesB: number): string {
  if (votesA === votesB) {
    return "Crowd split";
  }
  return "Close Battle";
}

export function isBattleContender(
  songId: string,
  battle: QueueBattleState,
): boolean {
  return (
    battle.active &&
    battle.contenderIds !== null &&
    battle.contenderIds.includes(songId)
  );
}

export function battleCardBorderColor(
  inBattle: boolean,
  isLeader: boolean,
  palette: AmbientPalette,
): string {
  if (!inBattle) {
    return "";
  }
  if (isLeader) {
    return warmWhite(0.16);
  }
  return `rgba(${palette.glowRgb}, 0.12)`;
}

export function battleCardDepthShadow(heat: number): string {
  return `0 5px 24px rgba(0, 0, 0, ${0.28 + heat * 0.05})`;
}

/** Strongest tier — battle cards, still album-side directional. */
export function battleDirectionalGlow(
  heat: number,
  palette: AmbientPalette,
): string {
  const whiteCore = warmWhite(0.07 + heat * 0.08);
  const whiteMid = warmWhite(0.025 + heat * 0.035);
  const tintCore = `rgba(${palette.glowRgb}, ${0.045 + heat * 0.09})`;

  return [
    `radial-gradient(ellipse 82% 118% at 12% 50%, ${whiteCore} 0%, ${whiteMid} 30%, transparent 56%)`,
    `radial-gradient(ellipse 62% 98% at 9% 50%, ${tintCore} 0%, transparent 52%)`,
  ].join(", ");
}

export function battleCardBoxShadow(
  inBattle: boolean,
  heat: number,
  _palette: AmbientPalette,
): string {
  if (!inBattle) {
    return "";
  }
  return battleCardDepthShadow(heat);
}

export function battleHeatBoost(inBattle: boolean): number {
  return inBattle ? 0.1 : 0;
}

export function battleShimmerGradient(palette: AmbientPalette): string[] {
  return [
    `linear-gradient(105deg, transparent 38%, ${palette.shimmerMid} 50%, transparent 62%)`,
    `linear-gradient(105deg, transparent 30%, ${palette.shimmerStart} 50%, transparent 70%)`,
    `linear-gradient(105deg, transparent 38%, ${palette.shimmerMid} 50%, transparent 62%)`,
  ];
}
