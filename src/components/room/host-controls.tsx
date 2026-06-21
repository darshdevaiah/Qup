"use client";

import { AnimatePresence, motion } from "framer-motion";

import { HostBottomSheet } from "@/components/room/host-bottom-sheet";
import { HostControlDock } from "@/components/room/host-control-dock";
import { useHostControls } from "@/hooks/use-host-controls";
import type { AmbientPalette } from "@/lib/ambient-palette";
import { warmWhite } from "@/lib/ambient-palette";
import { fadeSmooth } from "@/lib/motion";
import type { Room } from "@/types/firestore";

type HostControlsProps = {
  roomId: string;
  room: Room;
  voterId: string;
  ambient: AmbientPalette;
  onSkipSuccess?: () => void;
};

export function HostControls({
  roomId,
  room,
  voterId,
  ambient,
  onSkipSuccess,
}: HostControlsProps) {
  const host = useHostControls({ roomId, room, voterId });

  const controlProps = {
    ambient,
    settings: host.hostSettings,
    pending: host.pending,
    queue: room.queue,
    pinnedSongId: room.pinnedSongId,
    onSkip: async () => {
      await host.skipSong();
      onSkipSuccess?.();
    },
    onToggleVotingPaused: host.toggleVotingPaused,
    onToggleQueueLocked: host.toggleQueueLocked,
    onToggleCrowdMode: host.toggleCrowdMode,
    onToggleExplicit: host.toggleExplicitFilter,
    onStartBattle: host.startBattle,
    onRemoveSong: host.removeSong,
    onPinSong: host.pinSong,
  };

  if (host.canClaim) {
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={fadeSmooth}
        disabled={host.pending}
        onClick={() => void host.claimHost()}
        className="pointer-events-auto fixed bottom-[5.75rem] right-4 z-[55] rounded-full border border-white/[0.1] bg-zinc-950/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70 backdrop-blur-xl sm:bottom-[6.75rem] sm:right-6"
        style={{
          boxShadow: `0 8px 24px rgba(0,0,0,0.35), 0 0 20px rgba(${ambient.glowRgb}, 0.08)`,
        }}
      >
        Take DJ booth
      </motion.button>
    );
  }

  if (!host.isHost) return null;

  return (
    <>
      <AnimatePresence>
        {host.error ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed bottom-[9.5rem] right-4 z-[61] max-w-[14rem] rounded-lg bg-red-950/80 px-3 py-1.5 text-xs text-red-200 sm:right-6"
          >
            {host.error}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <HostControlDock {...controlProps} />
      <HostBottomSheet {...controlProps} />
    </>
  );
}

/** Subtle room-wide pulse when crowd mode is active. */
export function CrowdModeAtmosphere({
  active,
  ambient,
}: {
  active: boolean;
  ambient: AmbientPalette;
}) {
  if (!active) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[15]"
      animate={{ opacity: [0.15, 0.28, 0.15] }}
      transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      style={{
        background: `radial-gradient(ellipse 80% 60% at 50% 100%, rgba(${ambient.glowRgb}, 0.12), transparent 65%)`,
        boxShadow: `inset 0 0 80px ${warmWhite(0.02)}`,
      }}
    />
  );
}
