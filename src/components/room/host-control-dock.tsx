"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";

import type { AmbientPalette } from "@/lib/ambient-palette";
import { warmWhite } from "@/lib/ambient-palette";
import { springPremium } from "@/lib/motion";
import type { RoomHostSettings } from "@/types/firestore";
import type { QueuedSong } from "@/types/firestore";

const HOLD_MS = 900;

type HostControlDockProps = {
  ambient: AmbientPalette;
  settings: RoomHostSettings;
  pending: boolean;
  queue: QueuedSong[];
  pinnedSongId?: string | null;
  onSkip: () => Promise<void>;
  onToggleVotingPaused: () => Promise<void>;
  onToggleQueueLocked: () => Promise<void>;
  onToggleCrowdMode: () => Promise<void>;
  onToggleExplicit: () => Promise<void>;
  onStartBattle: () => Promise<void>;
  onRemoveSong: (songId: string) => Promise<void>;
  onPinSong: (songId: string | null) => Promise<void>;
};

type ControlId =
  | "skip"
  | "vote"
  | "lock"
  | "battle"
  | "crowd"
  | "explicit"
  | "queue";

export function HostControlDock({
  ambient,
  settings,
  pending,
  queue,
  pinnedSongId,
  onSkip,
  onToggleVotingPaused,
  onToggleQueueLocked,
  onToggleCrowdMode,
  onToggleExplicit,
  onStartBattle,
  onRemoveSong,
  onPinSong,
}: HostControlDockProps) {
  const [holdProgress, setHoldProgress] = useState(0);
  const [showQueueTools, setShowQueueTools] = useState(false);
  const holdFrameRef = useRef<number | null>(null);
  const holdStartRef = useRef<number | null>(null);

  const cancelHold = useCallback(() => {
    if (holdFrameRef.current) {
      cancelAnimationFrame(holdFrameRef.current);
      holdFrameRef.current = null;
    }
    holdStartRef.current = null;
    setHoldProgress(0);
  }, []);

  const startHold = useCallback(() => {
    if (pending) return;
    cancelHold();
    holdStartRef.current = performance.now();

    const tick = (now: number) => {
      const start = holdStartRef.current;
      if (!start) return;
      const progress = Math.min(1, (now - start) / HOLD_MS);
      setHoldProgress(progress);
      if (progress >= 1) {
        cancelHold();
        void onSkip();
        return;
      }
      holdFrameRef.current = requestAnimationFrame(tick);
    };

    holdFrameRef.current = requestAnimationFrame(tick);
  }, [cancelHold, onSkip, pending]);

  const controls: Array<{
    id: ControlId;
    label: string;
    active?: boolean;
    onPress?: () => void;
    onHoldStart?: () => void;
    onHoldEnd?: () => void;
  }> = [
    {
      id: "skip",
      label: "Hold to skip",
      onHoldStart: startHold,
      onHoldEnd: cancelHold,
    },
    {
      id: "vote",
      label: settings.votingPaused ? "Resume votes" : "Pause votes",
      active: settings.votingPaused,
      onPress: () => void onToggleVotingPaused(),
    },
    {
      id: "lock",
      label: settings.queueLocked ? "Unlock queue" : "Lock queue",
      active: settings.queueLocked,
      onPress: () => void onToggleQueueLocked(),
    },
    {
      id: "battle",
      label: "Start battle",
      onPress: () => void onStartBattle(),
    },
    {
      id: "crowd",
      label: settings.crowdMode ? "Crowd on" : "Crowd mode",
      active: settings.crowdMode,
      onPress: () => void onToggleCrowdMode(),
    },
    {
      id: "explicit",
      label: settings.explicitFilterEnabled ? "Explicit off" : "Explicit filter",
      active: settings.explicitFilterEnabled,
      onPress: () => void onToggleExplicit(),
    },
    {
      id: "queue",
      label: "Queue tools",
      active: showQueueTools,
      onPress: () => setShowQueueTools((v) => !v),
    },
  ];

  return (
    <div className="pointer-events-none fixed bottom-[5.5rem] right-4 z-[60] hidden flex-col items-end gap-3 sm:flex sm:bottom-[6.5rem] sm:right-6">
      <AnimatePresence>
        {showQueueTools ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={springPremium}
            className="pointer-events-auto w-[min(18rem,72vw)] rounded-2xl border border-white/[0.1] bg-zinc-950/70 p-3 backdrop-blur-xl"
            style={{
              boxShadow: `0 16px 40px rgba(0,0,0,0.45), 0 0 24px rgba(${ambient.glowRgb}, 0.1)`,
            }}
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
              Queue
            </p>
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {queue.slice(0, 6).map((song) => (
                <li
                  key={song.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]"
                >
                  <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                    {song.title}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void onPinSong(
                        pinnedSongId === song.id ? null : song.id,
                      )
                    }
                    className="shrink-0 text-[10px] font-medium text-amber-200/80"
                  >
                    {pinnedSongId === song.id ? "Unpin" : "Pin"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void onRemoveSong(song.id)}
                    className="shrink-0 text-[10px] font-medium text-red-300/80"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        layout
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/[0.1] bg-zinc-950/55 p-2 backdrop-blur-2xl"
        style={{
          boxShadow: `0 12px 36px rgba(0,0,0,0.42), 0 0 28px rgba(${ambient.glowRgb}, 0.08)`,
        }}
        animate={{
          boxShadow: [
            `0 12px 36px rgba(0,0,0,0.42), 0 0 24px rgba(${ambient.glowRgb}, 0.06)`,
            `0 14px 40px rgba(0,0,0,0.45), 0 0 32px rgba(${ambient.glowRgb}, 0.12)`,
            `0 12px 36px rgba(0,0,0,0.42), 0 0 24px rgba(${ambient.glowRgb}, 0.06)`,
          ],
        }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        {controls.map((control) => (
          <HostDockButton
            key={control.id}
            label={control.label}
            active={control.active}
            ambient={ambient}
            holdProgress={control.id === "skip" ? holdProgress : 0}
            disabled={pending}
            onPointerDown={control.onHoldStart}
            onPointerUp={control.onHoldEnd}
            onPointerLeave={control.onHoldEnd}
            onClick={control.onPress}
          />
        ))}
      </motion.div>
    </div>
  );
}

function HostDockButton({
  label,
  active,
  ambient,
  holdProgress,
  disabled,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onClick,
}: {
  label: string;
  active?: boolean;
  ambient: AmbientPalette;
  holdProgress: number;
  disabled: boolean;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onPointerLeave?: () => void;
  onClick?: () => void;
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={label}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
      whileHover={{ y: -2, scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.1] bg-zinc-900/80 disabled:opacity-40"
      style={{
        boxShadow: active
          ? `0 0 18px rgba(${ambient.glowRgb}, 0.22)`
          : `0 0 8px ${warmWhite(0.04)}`,
      }}
    >
      {holdProgress > 0 ? (
        <svg
          aria-hidden
          className="absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 44 44"
        >
          <circle
            cx="22"
            cy="22"
            r="20"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="2"
          />
          <circle
            cx="22"
            cy="22"
            r="20"
            fill="none"
            stroke={`rgba(${ambient.glowRgb}, 0.75)`}
            strokeWidth="2"
            strokeDasharray={125.6}
            strokeDashoffset={125.6 * (1 - holdProgress)}
          />
        </svg>
      ) : null}
      <span
        className={`text-[10px] font-semibold uppercase tracking-wider ${
          active ? "text-white" : "text-zinc-400"
        }`}
      >
        {label.split(" ")[0]?.slice(0, 1)}
      </span>
      <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-0.5 text-[10px] text-white/80 group-hover:block">
        {label}
      </span>
    </motion.button>
  );
}
