"use client";

import { AnimatePresence, motion } from "framer-motion";

import type { AmbientPalette } from "@/lib/ambient-palette";
import { warmWhite } from "@/lib/ambient-palette";
import { formatDuration } from "@/lib/format-duration";

type PlaybackProgressProps = {
  elapsedMs: number;
  durationMs: number | null;
  progress: number;
  hasDuration: boolean;
  ambient: AmbientPalette;
};

const timeCrossfade = {
  duration: 0.32,
  ease: [0.4, 0, 0.2, 1] as const,
};

export function PlaybackProgress({
  elapsedMs,
  durationMs,
  progress,
  hasDuration,
  ambient,
}: PlaybackProgressProps) {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const displayElapsed =
    hasDuration && durationMs
      ? Math.min(elapsedMs, durationMs)
      : elapsedMs;
  const elapsedLabel = formatDuration(displayElapsed);
  const durationLabel =
    hasDuration && durationMs ? formatDuration(durationMs) : "—";

  return (
    <div className="w-full">
      <div className="relative h-[3px] overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-inset ring-white/[0.04]">
        {hasDuration ? (
          <>
            <div
              className="absolute inset-y-0 left-0 w-full origin-left rounded-full will-change-transform"
              style={{
                transform: `scaleX(${clampedProgress})`,
                background: `linear-gradient(90deg, rgba(${ambient.glowRgb}, 0.42) 0%, ${warmWhite(0.82)} 88%)`,
                boxShadow: `0 0 14px rgba(${ambient.glowRgb}, 0.28), 0 0 4px ${warmWhite(0.2)}`,
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute top-1/2 z-[1] h-2.5 w-2.5 -translate-y-1/2 rounded-full will-change-[left]"
              style={{
                left: `calc(${clampedProgress * 100}% - 5px)`,
                background: warmWhite(0.92),
                boxShadow: `0 0 12px rgba(${ambient.glowRgb}, 0.55), 0 0 20px rgba(${ambient.glowRgb}, 0.25)`,
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-20 origin-left rounded-full opacity-70 will-change-transform"
              style={{
                transform: `translateX(calc(${clampedProgress * 100}% - 2.5rem))`,
                background: `radial-gradient(circle at 70% 50%, rgba(${ambient.glowRgb}, 0.45), transparent 70%)`,
              }}
            />
          </>
        ) : (
          <motion.div
            aria-hidden
            className="absolute inset-x-0 inset-y-0 rounded-full opacity-35"
            style={{
              background: `linear-gradient(90deg, transparent, rgba(${ambient.glowRgb}, 0.22), transparent)`,
            }}
            animate={{ x: ["-40%", "140%"] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>

      <div className="mt-3.5 flex items-center justify-between tabular-nums text-[11px] tracking-wide text-zinc-400/90">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={elapsedLabel}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={timeCrossfade}
          >
            {elapsedLabel}
          </motion.span>
        </AnimatePresence>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={durationLabel}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={timeCrossfade}
            className={hasDuration ? undefined : "text-zinc-600"}
          >
            {durationLabel}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
