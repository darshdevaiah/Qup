import type { AmbientPalette } from "@/lib/ambient-palette";
import { ambientBorder, DEFAULT_PALETTE, warmWhite } from "@/lib/ambient-palette";

/** 0–1 popularity intensity for gradual visual heat. */
export function getVoteHeat(voteCount: number, maxVotes: number): number {
  if (voteCount <= 0 || maxVotes <= 0) return 0;
  return Math.min(1, Math.sqrt(voteCount / maxVotes));
}

export function formatVoteLabel(count: number): string {
  return count === 1 ? "1 vote" : `${count} votes`;
}

/** Tight secondary glow — vote pill only (fainter than queue card). */
export function votePillBoxShadow(
  heat: number,
  palette: AmbientPalette,
  extra = 0,
): string {
  const spread = Math.round(2 + heat * 4 + extra * 1.5);
  const whiteAlpha = 0.02 + heat * 0.04 + extra * 0.03;
  const tintAlpha = 0.015 + heat * 0.035 + extra * 0.025;
  return `0 0 ${spread}px ${warmWhite(whiteAlpha)}, 0 0 ${spread + 1}px rgba(${palette.glowRgb}, ${tintAlpha})`;
}

export function votePillBorderColor(
  heat: number,
  voted: boolean,
  palette: AmbientPalette,
): string {
  const base = voted ? 0.12 : 0.08;
  const alpha = base + heat * 0.06;
  return voted ? warmWhite(alpha) : ambientBorder(palette, alpha);
}

export function cardBorderColor(
  heat: number,
  isTop: boolean,
  palette: AmbientPalette,
): string {
  if (isTop && heat > 0) {
    return warmWhite(0.12 + heat * 0.1);
  }
  if (heat > 0.35) {
    return `rgba(${palette.glowRgb}, ${0.06 + heat * 0.08})`;
  }
  return palette.borderSubtle;
}

/** Depth only — ambient color comes from directional overlay. */
export function cardDepthShadow(heat: number): string {
  return `0 4px 22px rgba(0, 0, 0, ${0.22 + heat * 0.06})`;
}

/** Layered radial leak from album-art side (left / center-left). */
export function cardDirectionalGlow(
  heat: number,
  palette: AmbientPalette,
  isTop: boolean,
): string {
  if (heat <= 0 && !isTop) {
    return "transparent";
  }

  const whiteCore = warmWhite(0.05 + heat * 0.09);
  const whiteMid = warmWhite(0.02 + heat * 0.03);
  const tintCore = `rgba(${palette.glowRgb}, ${0.035 + heat * 0.075})`;

  const layers = [
    `radial-gradient(ellipse 78% 115% at 11% 50%, ${whiteCore} 0%, ${whiteMid} 32%, transparent 58%)`,
    `radial-gradient(ellipse 58% 92% at 8% 50%, ${tintCore} 0%, transparent 54%)`,
  ];

  if (isTop && heat > 0) {
    layers.splice(
      2,
      0,
      `radial-gradient(ellipse 48% 72% at 18% 32%, ${warmWhite(0.03 + heat * 0.035)} 0%, transparent 48%)`,
    );
  }

  return layers.join(", ");
}

/** @deprecated Use cardDepthShadow — kept for call-site migration. */
export function cardBoxShadow(
  heat: number,
  _isTop: boolean,
  _palette: AmbientPalette,
): string {
  return cardDepthShadow(heat);
}

export function withDefaultPalette(palette?: AmbientPalette): AmbientPalette {
  return palette ?? DEFAULT_PALETTE;
}
