/** Cinematic lighting tokens derived from album art + white base. */
export type AmbientPalette = {
  /** Soft white-forward accent for borders and text highlights. */
  accent: string;
  accentStrong: string;
  /** Desaturated album tint for glows. */
  tint: string;
  tintGlow: string;
  /** Blended border rgba. */
  border: string;
  borderSubtle: string;
  /** Box-shadow glow strings use tintGlow RGB components. */
  glowRgb: string;
  shimmerStart: string;
  shimmerMid: string;
  shimmerEnd: string;
};

/** Slightly warm white — OLED bloom, not neutral halo. */
export const WARM_WHITE_RGB = "255, 252, 247";

export function warmWhite(alpha: number): string {
  return `rgba(255, 252, 247, ${alpha})`;
}

export const DEFAULT_PALETTE: AmbientPalette = {
  accent: warmWhite(0.62),
  accentStrong: warmWhite(0.72),
  tint: "rgba(220, 218, 212, 0.14)",
  tintGlow: warmWhite(0.1),
  border: warmWhite(0.14),
  borderSubtle: "rgba(113, 113, 122, 0.4)",
  glowRgb: WARM_WHITE_RGB,
  shimmerStart: warmWhite(0.02),
  shimmerMid: warmWhite(0.05),
  shimmerEnd: warmWhite(0.02),
};

type Rgb = { r: number; g: number; b: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }

  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  let r: number;
  let g: number;
  let b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/** Pulls cinematic, low-saturation color from raw album RGB. */
export function cinematicRgb(r: number, g: number, b: number): Rgb {
  const hsl = rgbToHsl(r, g, b);
  hsl.s = Math.min(hsl.s, 0.28);
  hsl.l = clamp(hsl.l, 0.42, 0.56);
  return hslToRgb(hsl.h, hsl.s, hsl.l);
}

function blendRgb(a: Rgb, b: Rgb, ratio: number): Rgb {
  return {
    r: Math.round(a.r * ratio + b.r * (1 - ratio)),
    g: Math.round(a.g * ratio + b.g * (1 - ratio)),
    b: Math.round(a.b * ratio + b.b * (1 - ratio)),
  };
}

function rgba(rgb: Rgb, alpha: number): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/** Blends album tint toward warm white for borders. */
export function ambientBorder(palette: AmbientPalette, alpha: number): string {
  return `rgba(${palette.glowRgb}, ${alpha})`;
}

/** Modal tier — softer than queue; restrained album tint (~25% influence). */
export function modalLabelColor(palette: AmbientPalette): string {
  return palette.accent;
}

export function modalSearchFocusShadow(
  palette: AmbientPalette,
  focused: boolean,
): string {
  if (!focused) {
    return `0 0 0 1px ${warmWhite(0.08)}`;
  }
  return `0 0 0 1px ${ambientBorder(palette, 0.2)}, 0 0 14px rgba(${palette.glowRgb}, 0.07), 0 0 6px ${warmWhite(0.04)}`;
}

export function modalEdgeGlow(palette: AmbientPalette): string {
  return [
    `radial-gradient(ellipse 55% 45% at 8% 0%, rgba(${palette.glowRgb}, 0.07) 0%, transparent 68%)`,
    `radial-gradient(ellipse 45% 38% at 92% 100%, ${warmWhite(0.035)} 0%, transparent 62%)`,
  ].join(", ");
}

export function modalCardHoverBorder(palette: AmbientPalette): string {
  return ambientBorder(palette, 0.16);
}

export function modalCardHoverShadow(palette: AmbientPalette): string {
  return `0 10px 28px rgba(0, 0, 0, 0.32), 0 0 10px rgba(${palette.glowRgb}, 0.05)`;
}

export function modalAddButtonRest(): { border: string; background: string } {
  return {
    border: warmWhite(0.1),
    background: "rgba(255, 255, 255, 0.05)",
  };
}

export function modalAddButtonHover(palette: AmbientPalette): {
  border: string;
  background: string;
} {
  return {
    border: ambientBorder(palette, 0.2),
    background: `rgba(${palette.glowRgb}, 0.1)`,
  };
}

export function modalPlaceholderGradient(palette: AmbientPalette): string {
  return `linear-gradient(135deg, rgba(${palette.glowRgb}, 0.1) 0%, ${warmWhite(0.05)} 55%, rgba(39, 39, 42, 0.85) 100%)`;
}

/** CSS variables for modal descendants (hover/focus via Tailwind arbitrary props). */
export function modalCssVars(
  palette: AmbientPalette,
): Record<string, string> {
  const addHover = modalAddButtonHover(palette);
  return {
    "--modal-glow-rgb": palette.glowRgb,
    "--modal-label": palette.accent,
    "--modal-icon-muted": warmWhite(0.5),
    "--modal-icon-focus": palette.accentStrong,
    "--modal-border-hover": modalCardHoverBorder(palette),
    "--modal-shadow-hover": modalCardHoverShadow(palette),
    "--modal-add-border-hover": addHover.border,
    "--modal-add-bg-hover": addHover.background,
    "--modal-placeholder-bg": modalPlaceholderGradient(palette),
  };
}

/** Builds palette: warm white foundation + subtle album tint. */
export function buildAmbientPalette(r: number, g: number, b: number): AmbientPalette {
  const cinematic = cinematicRgb(r, g, b);
  const warm: Rgb = { r: 255, g: 252, b: 247 };
  const soft = blendRgb(warm, cinematic, 0.82);
  const tint = blendRgb(warm, cinematic, 0.62);

  return {
    accent: rgba(soft, 0.58),
    accentStrong: rgba(soft, 0.68),
    tint: rgba(tint, 0.12),
    tintGlow: rgba(tint, 0.08),
    border: rgba(soft, 0.14),
    borderSubtle: rgba(blendRgb(warm, cinematic, 0.9), 0.12),
    glowRgb: `${tint.r}, ${tint.g}, ${tint.b}`,
    shimmerStart: rgba(tint, 0.015),
    shimmerMid: rgba(tint, 0.04),
    shimmerEnd: rgba(tint, 0.015),
  };
}
