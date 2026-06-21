"use client";

import { AnimatePresence, motion } from "framer-motion";

import { PlusIcon } from "@/components/room/icons";
import { useRoomActionContext } from "@/hooks/use-room-action-context";
import type { AmbientPalette } from "@/lib/ambient-palette";
import { DEFAULT_PALETTE, warmWhite } from "@/lib/ambient-palette";
import { fadeSmooth } from "@/lib/motion";
import type { NowPlayingSong, QueuedSong } from "@/types/firestore";

type RoomActionPillProps = {
  queue: QueuedSong[];
  currentSong: NowPlayingSong | null;
  displayName: string;
  disabled?: boolean;
  queueLocked?: boolean;
  onPress: () => void;
  ambient?: AmbientPalette;
};

export function RoomActionPill({
  queue,
  currentSong,
  displayName,
  disabled = false,
  queueLocked = false,
  onPress,
  ambient = DEFAULT_PALETTE,
}: RoomActionPillProps) {
  const { actionContext } = useRoomActionContext({
    queue,
    currentSong,
    displayName,
  });

  const isBattle = actionContext.id === "battle";
  const isHighEnergy = actionContext.id === "high_energy";
  const glowStrength = isBattle || isHighEnergy ? 0.11 : 0.08;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-5"
      style={{
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <motion.button
        type="button"
        layout
        onClick={onPress}
        disabled={disabled || queueLocked}
        aria-label={
          queueLocked ? "Queue locked by DJ" : actionContext.ariaLabel
        }
        initial={false}
        animate={{
          y: 0,
          boxShadow: [
            `0 10px 40px rgba(0,0,0,0.42), 0 2px 8px rgba(0,0,0,0.28), inset 0 1px 0 ${warmWhite(0.12)}, 0 0 0 1px ${warmWhite(0.1)}, 0 0 28px rgba(${ambient.glowRgb}, 0.05)`,
            `0 14px 48px rgba(0,0,0,0.48), 0 4px 12px rgba(0,0,0,0.32), inset 0 1px 0 ${warmWhite(0.14)}, 0 0 0 1px ${warmWhite(0.12)}, 0 0 36px rgba(${ambient.glowRgb}, ${glowStrength})`,
            `0 10px 40px rgba(0,0,0,0.42), 0 2px 8px rgba(0,0,0,0.28), inset 0 1px 0 ${warmWhite(0.12)}, 0 0 0 1px ${warmWhite(0.1)}, 0 0 28px rgba(${ambient.glowRgb}, 0.05)`,
          ],
        }}
        whileHover={
          disabled
            ? undefined
            : {
                y: -4,
                boxShadow: `0 18px 52px rgba(0,0,0,0.5), 0 6px 16px rgba(0,0,0,0.34), inset 0 1px 0 ${warmWhite(0.16)}, 0 0 0 1px ${warmWhite(0.14)}, 0 0 40px rgba(${ambient.glowRgb}, 0.14)`,
              }
        }
        whileTap={disabled ? undefined : { y: -1, scale: 0.98 }}
        transition={{
          y: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
          layout: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
          boxShadow: {
            duration: 4.8,
            repeat: Infinity,
            ease: "easeInOut",
          },
        }}
        className="pointer-events-auto relative inline-flex h-16 touch-manipulation items-center justify-center overflow-hidden rounded-[2rem] border border-white/[0.12] bg-zinc-950/50 px-5 backdrop-blur-2xl transition-[border-color,background-color] duration-700 ease-out disabled:cursor-not-allowed disabled:opacity-45 sm:h-[4.25rem] sm:px-6"
        style={{
          borderColor: isBattle
            ? warmWhite(0.18)
            : `rgba(${ambient.glowRgb}, 0.16)`,
        }}
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-b from-white/[0.09] via-white/[0.02] to-transparent"
        />

        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-90"
          style={{
            background: `radial-gradient(ellipse 95% 80% at 50% 120%, rgba(${ambient.glowRgb}, 0.14) 0%, transparent 58%)`,
          }}
          animate={{ opacity: [0.45, 0.75, 0.45] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-[1px] rounded-[1.95rem] shadow-[inset_0_-12px_24px_rgba(0,0,0,0.22)]"
        />

        <span className="relative z-[1] inline-flex items-center gap-2">
          <motion.span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.04] text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            animate={{ opacity: [0.72, 0.9, 0.72] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          >
            {queueLocked ? (
              <span className="text-sm" aria-hidden>
                🔒
              </span>
            ) : (
              <PlusIcon className="h-3 w-3" />
            )}
          </motion.span>

          <span className="relative flex h-6 items-center">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={queueLocked ? "locked" : actionContext.id}
                initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                transition={fadeSmooth}
                className="flex items-center gap-1.5 whitespace-nowrap text-[16px] font-bold leading-none tracking-tight text-white"
              >
                <span className="text-[17px] leading-none opacity-90" aria-hidden>
                  {queueLocked ? "🔒" : actionContext.emoji}
                </span>
                {queueLocked ? "Queue locked" : actionContext.label}
              </motion.span>
            </AnimatePresence>
          </span>
        </span>
      </motion.button>
    </div>
  );
}
