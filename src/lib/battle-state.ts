import type { AmbientPalette } from "@/lib/ambient-palette";
import { DEFAULT_PALETTE, warmWhite } from "@/lib/ambient-palette";
import { sortQueueByVotes } from "@/lib/queue";
import type { BattlePhase, BattleTrigger, RoomBattle } from "@/types/firestore";
import type { QueuedSong } from "@/types/firestore";

export const BATTLE_MIN_VOTES = 3;
export const BATTLE_MAX_VOTE_GAP = 1;
export const BATTLE_INTRO_MS = 1200;
export const BATTLE_LIVE_MS = 15_000;
export const BATTLE_RESULT_MS = 2_400;

export type BattleContenders = {
  left: QueuedSong;
  right: QueuedSong;
};

export type DerivedBattlePhase = BattlePhase | "idle";

export type BattleViewModel = {
  phase: DerivedBattlePhase;
  isOverlayVisible: boolean;
  contenders: BattleContenders | null;
  leaderId: string | null;
  voteDelta: number;
  secondsRemaining: number;
  winningSongId: string | null;
  userVoteSongId: string | null;
};

export function detectBattleContenders(
  queue: QueuedSong[],
): BattleContenders | null {
  const sorted = sortQueueByVotes(queue);
  if (sorted.length < 2) return null;

  const left = sorted[0];
  const right = sorted[1];
  const gap = Math.abs(left.voteCount - right.voteCount);

  if (
    left.voteCount < BATTLE_MIN_VOTES ||
    right.voteCount < BATTLE_MIN_VOTES ||
    gap > BATTLE_MAX_VOTE_GAP
  ) {
    return null;
  }

  return { left, right };
}

export function createRoomBattle(
  contenders: BattleContenders,
  trigger: BattleTrigger = "auto",
  now = Date.now(),
): RoomBattle {
  const introEndsAt = now + BATTLE_INTRO_MS;
  return {
    active: true,
    leftSongId: contenders.left.id,
    rightSongId: contenders.right.id,
    startedAt: now,
    introEndsAt,
    endsAt: introEndsAt + BATTLE_LIVE_MS,
    winningSongId: null,
    trigger,
    version: 1,
  };
}

export function deriveBattlePhase(
  battle: RoomBattle | null | undefined,
  now = Date.now(),
): DerivedBattlePhase {
  if (!battle?.active) return "idle";
  if (now < battle.introEndsAt) return "intro";
  if (now < battle.endsAt) return "live";
  if (now < battle.endsAt + BATTLE_RESULT_MS) return "result";
  return "idle";
}

export function getBattleSecondsRemaining(
  battle: RoomBattle,
  phase: DerivedBattlePhase,
  now = Date.now(),
): number {
  if (phase !== "live") return 0;
  return Math.max(0, Math.ceil((battle.endsAt - now) / 1000));
}

export function resolveBattleWinner(
  left: QueuedSong,
  right: QueuedSong,
): string {
  if (left.voteCount > right.voteCount) return left.id;
  if (right.voteCount > left.voteCount) return right.id;
  return left.addedAt <= right.addedAt ? left.id : right.id;
}

export function getBattleLeaderId(
  left: QueuedSong,
  right: QueuedSong,
): string | null {
  if (left.voteCount === right.voteCount) return null;
  return left.voteCount > right.voteCount ? left.id : right.id;
}

export function getVoteDelta(leftVotes: number, rightVotes: number): number {
  return Math.abs(leftVotes - rightVotes);
}

export function getUserBattleVoteSongId(
  contenders: BattleContenders,
  voterId: string,
): string | null {
  if (contenders.left.voters.includes(voterId)) return contenders.left.id;
  if (contenders.right.voters.includes(voterId)) return contenders.right.id;
  return null;
}

export function blendBattlePalettes(
  left: AmbientPalette,
  right: AmbientPalette,
): AmbientPalette {
  const parseRgb = (rgb: string) => {
    const parts = rgb.split(",").map((p) => Number.parseInt(p.trim(), 10));
    return {
      r: parts[0] ?? 220,
      g: parts[1] ?? 218,
      b: parts[2] ?? 212,
    };
  };

  const a = parseRgb(left.glowRgb);
  const b = parseRgb(right.glowRgb);
  const mix = {
    r: Math.round((a.r + b.r) / 2),
    g: Math.round((a.g + b.g) / 2),
    b: Math.round((a.b + b.b) / 2),
  };
  const glowRgb = `${mix.r}, ${mix.g}, ${mix.b}`;

  return {
    accent: warmWhite(0.64),
    accentStrong: warmWhite(0.76),
    tint: `rgba(${glowRgb}, 0.16)`,
    tintGlow: warmWhite(0.12),
    border: warmWhite(0.16),
    borderSubtle: `rgba(${glowRgb}, 0.1)`,
    glowRgb,
    shimmerStart: warmWhite(0.03),
    shimmerMid: `rgba(${glowRgb}, 0.08)`,
    shimmerEnd: warmWhite(0.03),
  };
}

export function buildBattleViewModel(
  queue: QueuedSong[],
  battle: RoomBattle | null | undefined,
  voterId: string,
  now = Date.now(),
): BattleViewModel {
  const phase = deriveBattlePhase(battle, now);
  const isOverlayVisible =
    phase === "intro" || phase === "live" || phase === "result";

  if (!battle?.active || !isOverlayVisible) {
    return {
      phase: "idle",
      isOverlayVisible: false,
      contenders: null,
      leaderId: null,
      voteDelta: 0,
      secondsRemaining: 0,
      winningSongId: null,
      userVoteSongId: null,
    };
  }

  const left = queue.find((s) => s.id === battle.leftSongId);
  const right = queue.find((s) => s.id === battle.rightSongId);

  if (!left || !right) {
    return {
      phase: "idle",
      isOverlayVisible: false,
      contenders: null,
      leaderId: null,
      voteDelta: 0,
      secondsRemaining: 0,
      winningSongId: battle.winningSongId,
      userVoteSongId: null,
    };
  }

  const contenders = { left, right };
  const leaderId = getBattleLeaderId(left, right);
  const winningSongId =
    battle.winningSongId ??
    (phase === "result" ? resolveBattleWinner(left, right) : null);

  return {
    phase,
    isOverlayVisible,
    contenders,
    leaderId,
    voteDelta: getVoteDelta(left.voteCount, right.voteCount),
    secondsRemaining: getBattleSecondsRemaining(battle, phase, now),
    winningSongId,
    userVoteSongId: getUserBattleVoteSongId(contenders, voterId),
  };
}

export function battleLayoutId(songId: string): string {
  return `battle-card-${songId}`;
}

export function withDefaultBattlePalette(palette?: AmbientPalette): AmbientPalette {
  return palette ?? DEFAULT_PALETTE;
}
