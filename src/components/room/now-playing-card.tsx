"use client";

import { AnimatePresence, motion } from "framer-motion";

import { AlbumArt } from "@/components/room/album-art";
import type { AmbientPalette } from "@/lib/ambient-palette";
import { DEFAULT_PALETTE, warmWhite } from "@/lib/ambient-palette";
import { NOW_PLAYING_ART_LAYOUT_ID } from "@/lib/live-playback";
import { fadeSmooth, springPremium } from "@/lib/motion";
import type { NowPlayingSong } from "@/types/firestore";

type NowPlayingCardProps = {
  song: NowPlayingSong | null;
  ambient?: AmbientPalette;
  onOpen?: () => void;
  /** When fullscreen overlay is open, release shared layout id. */
  isExpanded?: boolean;
};

function songKey(song: NowPlayingSong): string {
  return (
    song.spotifyUrl ||
    `${song.title}::${song.artist}::${song.albumArt || ""}`
  );
}

function MusicIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
      />
    </svg>
  );
}

export function NowPlayingCard({
  song,
  ambient = DEFAULT_PALETTE,
  onOpen,
  isExpanded = false,
}: NowPlayingCardProps) {
  const isInteractive = Boolean(song && onOpen);

  return (
    <motion.div
      layout
      className="relative min-h-[6.5rem] overflow-hidden rounded-2xl border bg-zinc-900/75 shadow-xl shadow-black/25 backdrop-blur-md sm:min-h-[7rem]"
      style={{
        borderColor: ambient.border,
        boxShadow: `0 6px 24px rgba(0,0,0,0.32), 0 0 22px ${warmWhite(0.05)}, 0 0 28px rgba(${ambient.glowRgb}, 0.06)`,
        transition: "border-color 0.7s ease, box-shadow 0.7s ease",
      }}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-45"
        animate={{
          background: [
            `radial-gradient(ellipse at 20% 0%, ${ambient.shimmerMid}, transparent 55%)`,
            `radial-gradient(ellipse at 80% 100%, ${ambient.shimmerStart}, transparent 50%)`,
            `radial-gradient(ellipse at 20% 0%, ${ambient.shimmerMid}, transparent 55%)`,
          ],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {song ? (
          <motion.button
            key={songKey(song)}
            type="button"
            onClick={onOpen}
            disabled={!isInteractive}
            aria-label={`Now playing ${song.title} by ${song.artist}. Tap to expand.`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeSmooth}
            whileTap={isInteractive ? { scale: 0.985 } : undefined}
            className={`relative flex w-full gap-4 p-4 text-left sm:p-5 ${
              isInteractive
                ? "cursor-pointer transition-colors hover:bg-white/[0.03]"
                : "cursor-default"
            }`}
          >
            {isExpanded ? (
              <div
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10 opacity-0"
                aria-hidden
              />
            ) : (
            <motion.div
              layoutId={NOW_PLAYING_ART_LAYOUT_ID}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10"
              transition={springPremium}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={song.albumArt || "placeholder"}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={springPremium}
                >
                  {song.albumArt ? (
                    <AlbumArt
                      src={song.albumArt}
                      alt={`${song.title} cover`}
                      size="lg"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-zinc-800/80 ring-1 ring-white/10">
                      <MusicIcon className="h-8 w-8 text-zinc-400" />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
            )}

            <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={`${songKey(song)}-title`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={fadeSmooth}
                  className="truncate text-lg font-semibold"
                >
                  {song.title}
                </motion.p>
              </AnimatePresence>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={`${songKey(song)}-artist`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ ...fadeSmooth, delay: 0.04 }}
                  className="truncate text-sm text-zinc-400"
                >
                  {song.artist}
                </motion.p>
              </AnimatePresence>
            </div>
          </motion.button>
        ) : (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeSmooth}
            className="relative flex min-h-[5.5rem] items-center justify-center p-4 text-center text-sm text-zinc-500 sm:min-h-[7rem] sm:p-5"
          >
            Nothing playing yet
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
