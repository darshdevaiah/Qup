"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

import { DiscoveryTrackCard } from "@/components/room/discovery-track-card";
import type { AmbientPalette } from "@/lib/ambient-palette";
import { DEFAULT_PALETTE } from "@/lib/ambient-palette";
import { fadeSmooth } from "@/lib/motion";
import {
  buildDiscoverySections,
  type DiscoveryTrack,
} from "@/lib/discovery-sections";
import type { NowPlayingSong, QueuedSong } from "@/types/firestore";

type AddSongDiscoveryProps = {
  queue: QueuedSong[];
  currentSong: NowPlayingSong | null;
  onAdd: (track: DiscoveryTrack) => void;
  addingTrackId: string | null;
  disabled?: boolean;
  ambient?: AmbientPalette;
};

const sectionVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      ...fadeSmooth,
      delay: 0.06 + index * 0.07,
    },
  }),
};

export function AddSongDiscovery({
  queue,
  currentSong,
  onAdd,
  addingTrackId,
  disabled = false,
  ambient = DEFAULT_PALETTE,
}: AddSongDiscoveryProps) {
  const sections = useMemo(
    () => buildDiscoverySections(queue, currentSong),
    [queue, currentSong],
  );

  return (
    <div className="space-y-7 pb-2">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={fadeSmooth}
        className="px-1"
      >
        <p className="text-sm font-medium text-zinc-300">
          Discover what to play next
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Curated from this room — or search Spotify above
        </p>
      </motion.div>

      {sections.map((section, index) => (
        <motion.section
          key={section.id}
          custom={index}
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          className="space-y-3"
        >
          <div className="px-1">
            <h3
              className="text-sm font-semibold tracking-tight text-white transition-colors duration-700"
              style={
                index === 0 ? { color: ambient.accentStrong } : undefined
              }
            >
              {section.title}
            </h3>
            {section.subtitle ? (
              <p className="mt-0.5 text-xs text-zinc-500">{section.subtitle}</p>
            ) : null}
          </div>

          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {section.tracks.map((track) => (
              <DiscoveryTrackCard
                key={`${section.id}-${track.id}`}
                track={track}
                onAdd={onAdd}
                disabled={disabled}
                isAdding={addingTrackId === track.id}
                ambient={ambient}
              />
            ))}
          </div>
        </motion.section>
      ))}
    </div>
  );
}
