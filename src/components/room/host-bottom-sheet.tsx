"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";

import type { AmbientPalette } from "@/lib/ambient-palette";
import { warmWhite } from "@/lib/ambient-palette";
import { springPremium } from "@/lib/motion";
import type { RoomHostSettings } from "@/types/firestore";
import type { QueuedSong } from "@/types/firestore";

const HOLD_MS = 900;

type HostBottomSheetProps = {
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

export function HostBottomSheet(props: HostBottomSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdFrameRef = useRef<number | null>(null);
  const holdStartRef = useRef<number | null>(null);

  const cancelHold = useCallback(() => {
    if (holdFrameRef.current) cancelAnimationFrame(holdFrameRef.current);
    holdFrameRef.current = null;
    holdStartRef.current = null;
    setHoldProgress(0);
  }, []);

  const startHold = useCallback(() => {
    if (props.pending) return;
    cancelHold();
    holdStartRef.current = performance.now();
    const tick = (now: number) => {
      const start = holdStartRef.current;
      if (!start) return;
      const progress = Math.min(1, (now - start) / HOLD_MS);
      setHoldProgress(progress);
      if (progress >= 1) {
        cancelHold();
        void props.onSkip();
        return;
      }
      holdFrameRef.current = requestAnimationFrame(tick);
    };
    holdFrameRef.current = requestAnimationFrame(tick);
  }, [cancelHold, props]);

  const { ambient, settings, pending, queue, pinnedSongId } = props;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] sm:hidden">
      <AnimatePresence>
        {expanded ? (
          <motion.button
            type="button"
            aria-label="Close DJ controls"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setExpanded(false)}
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        layout
        drag={expanded ? "y" : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.12}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 400) setExpanded(false);
        }}
        className="pointer-events-auto relative rounded-t-[1.5rem] border border-white/[0.1] border-b-0 bg-zinc-950/80 backdrop-blur-2xl"
        style={{
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          boxShadow: `0 -12px 40px rgba(0,0,0,0.4), 0 0 28px rgba(${ambient.glowRgb}, 0.08)`,
        }}
        animate={{ y: expanded ? 0 : 0 }}
        transition={springPremium}
      >
        <button
          type="button"
          className="flex w-full flex-col items-center pt-2"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label="DJ controls"
        >
          <span className="mb-2 h-1 w-10 rounded-full bg-white/25" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">
            DJ Booth
          </span>
        </button>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden px-4 pb-2"
            >
              <div className="grid grid-cols-2 gap-2 pt-3">
                <SheetToggle
                  label={settings.votingPaused ? "Resume votes" : "Pause votes"}
                  active={settings.votingPaused}
                  ambient={ambient}
                  disabled={pending}
                  onClick={() => void props.onToggleVotingPaused()}
                />
                <SheetToggle
                  label={settings.queueLocked ? "Unlock queue" : "Lock queue"}
                  active={settings.queueLocked}
                  ambient={ambient}
                  disabled={pending}
                  onClick={() => void props.onToggleQueueLocked()}
                />
                <SheetToggle
                  label="Start battle"
                  ambient={ambient}
                  disabled={pending}
                  onClick={() => void props.onStartBattle()}
                />
                <SheetToggle
                  label={settings.crowdMode ? "Crowd on" : "Crowd mode"}
                  active={settings.crowdMode}
                  ambient={ambient}
                  disabled={pending}
                  onClick={() => void props.onToggleCrowdMode()}
                />
                <SheetToggle
                  label={
                    settings.explicitFilterEnabled
                      ? "Explicit off"
                      : "Explicit filter"
                  }
                  active={settings.explicitFilterEnabled}
                  ambient={ambient}
                  disabled={pending}
                  onClick={() => void props.onToggleExplicit()}
                />
              </div>

              <button
                type="button"
                disabled={pending}
                onPointerDown={startHold}
                onPointerUp={cancelHold}
                onPointerLeave={cancelHold}
                className="relative mt-3 w-full overflow-hidden rounded-xl border border-white/[0.1] bg-zinc-900/70 py-3 text-sm font-medium text-white"
              >
                <motion.span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-white/10"
                  style={{ width: `${holdProgress * 100}%` }}
                />
                <span className="relative z-[1]">Hold to skip track</span>
              </button>

              <ul className="mt-3 max-h-36 space-y-1 overflow-y-auto">
                {queue.slice(0, 8).map((song) => (
                  <li
                    key={song.id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                      {song.title}
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        void props.onPinSong(
                          pinnedSongId === song.id ? null : song.id,
                        )
                      }
                      className="text-[10px] text-amber-200/80"
                    >
                      {pinnedSongId === song.id ? "Unpin" : "Pin"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void props.onRemoveSong(song.id)}
                      className="text-[10px] text-red-300/80"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function SheetToggle({
  label,
  active,
  ambient,
  disabled,
  onClick,
}: {
  label: string;
  active?: boolean;
  ambient: AmbientPalette;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl border border-white/[0.08] px-3 py-2.5 text-left text-xs font-medium text-zinc-200 disabled:opacity-40"
      style={{
        backgroundColor: active ? `rgba(${ambient.glowRgb}, 0.12)` : "rgba(0,0,0,0.2)",
        boxShadow: active ? `0 0 16px rgba(${ambient.glowRgb}, 0.12)` : "none",
        borderColor: active ? warmWhite(0.14) : undefined,
      }}
    >
      {label}
    </button>
  );
}
