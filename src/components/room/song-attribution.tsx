"use client";

import { motion } from "framer-motion";

import type { AmbientPalette } from "@/lib/ambient-palette";
import { warmWhite } from "@/lib/ambient-palette";

const attributionEntrance = {
  duration: 0.75,
  ease: [0.4, 0, 0.2, 1] as const,
};

type QueueSongAttributionProps = {
  addedBy: string;
  ambient: AmbientPalette;
};

/** Atmospheric queue metadata — must not compete with title or votes. */
export function QueueSongAttribution({
  addedBy,
  ambient,
}: QueueSongAttributionProps) {
  const name = addedBy.trim();
  if (!name) return null;

  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.6 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="truncate text-[11px] font-normal leading-[1.2] transition-opacity duration-300 group-hover:opacity-[0.68] sm:text-xs"
      style={{ color: ambient.accent, opacity: 0.6 }}
    >
      Added by {name}
    </motion.p>
  );
}

type NowPlayingRoomContextProps = {
  roomName: string;
  ambient: AmbientPalette;
};

/** Ambient room identity — top of fullscreen, not competing with song block. */
export function NowPlayingRoomContext({
  roomName,
  ambient,
}: NowPlayingRoomContextProps) {
  const room = roomName.trim() || "this room";

  return (
    <motion.p
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 0.5, y: 0 }}
      transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
      className="px-6 text-center text-[10px] font-medium uppercase tracking-[0.26em] sm:text-[11px] sm:tracking-[0.28em]"
      style={{ color: warmWhite(0.52) }}
    >
      <span style={{ color: ambient.accent, opacity: 0.85 }}>
        Playing live in {room}
      </span>
    </motion.p>
  );
}

type NowPlayingAttributionProps = {
  addedBy?: string;
  ambient: AmbientPalette;
};

/** Social attribution beneath artist in fullscreen now playing. */
export function NowPlayingAttribution({
  addedBy,
  ambient,
}: NowPlayingAttributionProps) {
  const name = addedBy?.trim();
  if (!name) return null;

  return (
    <motion.p
      initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ ...attributionEntrance, delay: 0.08 }}
      className="mt-5 text-[1.0625rem] font-medium tracking-[0.02em] sm:mt-5 sm:text-[1.125rem]"
      style={{
        color: ambient.accentStrong,
        textShadow: `0 0 22px rgba(${ambient.glowRgb}, 0.22), 0 0 6px ${ambient.accent}`,
      }}
    >
      Added by {name}
    </motion.p>
  );
}
