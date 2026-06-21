"use client";

import { motion } from "framer-motion";

import type { AmbientPalette } from "@/lib/ambient-palette";
import { warmWhite } from "@/lib/ambient-palette";
import { fadeSmooth } from "@/lib/motion";

type QueueBattleIndicatorProps = {
  label: string;
  ambient: AmbientPalette;
};

const BREATHE_DURATION = 4.2;

export function QueueBattleIndicator({
  label,
  ambient,
}: QueueBattleIndicatorProps) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, scaleY: 0.6 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0, scaleY: 0.6 }}
      transition={fadeSmooth}
      className="list-none py-1"
      role="status"
      aria-live="polite"
    >
      <motion.div
        className="relative flex items-center justify-center px-2"
        animate={{ opacity: [0.72, 1, 0.72] }}
        transition={{
          duration: BREATHE_DURATION,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <motion.div
          aria-hidden
          className="absolute inset-x-10 top-1/2 h-px -translate-y-1/2"
          style={{
            background: `linear-gradient(to right, transparent, rgba(${ambient.glowRgb}, 0.06), ${warmWhite(0.05)}, rgba(${ambient.glowRgb}, 0.06), transparent)`,
          }}
          animate={{ opacity: [0.2, 0.38, 0.2] }}
          transition={{
            duration: BREATHE_DURATION,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <motion.span
          className="relative z-[1] overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-white/80 backdrop-blur-md sm:text-[11px]"
          style={{
            boxShadow: `0 0 6px ${warmWhite(0.03)}, 0 0 8px rgba(${ambient.glowRgb}, 0.04)`,
          }}
        >
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `linear-gradient(105deg, transparent 44%, ${ambient.shimmerMid} 50%, transparent 56%)`,
            }}
            animate={{ opacity: [0, 0.22, 0] }}
            transition={{
              duration: 4.8,
              repeat: Infinity,
              ease: "easeInOut",
              repeatDelay: 2,
            }}
          />
          <span className="relative z-[1]">{label}</span>
        </motion.span>
      </motion.div>
    </motion.li>
  );
}
