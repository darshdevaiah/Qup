"use client";

import { motion } from "framer-motion";

import { PlusIcon } from "@/components/room/icons";
import type { AmbientPalette } from "@/lib/ambient-palette";
import { DEFAULT_PALETTE, warmWhite } from "@/lib/ambient-palette";
import { springPremium } from "@/lib/motion";
import type { DiscoveryTrack } from "@/lib/discovery-sections";

type DiscoveryTrackCardProps = {
  track: DiscoveryTrack;
  onAdd: (track: DiscoveryTrack) => void;
  disabled?: boolean;
  isAdding?: boolean;
  ambient?: AmbientPalette;
};

export function DiscoveryTrackCard({
  track,
  onAdd,
  disabled = false,
  isAdding = false,
  ambient = DEFAULT_PALETTE,
}: DiscoveryTrackCardProps) {
  return (
    <motion.button
      type="button"
      layout
      disabled={disabled}
      onClick={() => onAdd(track)}
      whileHover={{ y: -4, transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] } }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={springPremium}
      className="group w-[132px] shrink-0 snap-start text-left touch-manipulation disabled:opacity-50 sm:w-[148px]"
      aria-label={`Add ${track.title} by ${track.artist}`}
      aria-busy={isAdding}
    >
      <div
        className="relative aspect-square overflow-hidden rounded-2xl border bg-zinc-800/60 shadow-lg shadow-black/40 ring-1 ring-white/5 transition-[border-color,box-shadow] duration-700 ease-out group-hover:border-[color:var(--modal-border-hover)] group-hover:shadow-[var(--modal-shadow-hover)]"
        style={{ borderColor: warmWhite(0.1) }}
      >
        {track.albumArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.albumArt}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "var(--modal-placeholder-bg)" }}
          >
            <span className="text-2xl text-white/40">♪</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

        <span
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md transition-[border-color,background-color] duration-700 ease-out group-hover:border-[color:var(--modal-add-border-hover)] group-hover:bg-[color:var(--modal-add-bg-hover)]"
          style={{
            borderColor: warmWhite(0.14),
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
        >
          {isAdding ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <PlusIcon className="h-4 w-4" />
          )}
        </span>

        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <p className="line-clamp-2 text-xs font-semibold leading-tight text-white">
            {track.title}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-zinc-300/90">
            {track.artist}
          </p>
        </div>
      </div>
    </motion.button>
  );
}
