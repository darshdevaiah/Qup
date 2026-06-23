"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

import { AlbumArt } from "@/components/room/album-art";
import {
  NowPlayingAttribution,
  NowPlayingRoomContext,
} from "@/components/room/song-attribution";
import { PlaybackProgress } from "@/components/room/playback-progress";
import { useLivePlayback } from "@/hooks/use-live-playback";
import { useMediaMotion, useSubtleParallax } from "@/hooks/use-media-motion";
import type { AmbientPalette } from "@/lib/ambient-palette";
import { DEFAULT_PALETTE, warmWhite } from "@/lib/ambient-palette";
import {
  NOW_PLAYING_ART_LAYOUT_ID,
  nowPlayingFingerprint,
} from "@/lib/live-playback";
import {
  fadeAmbient,
  fadeCinematic,
  fadeSmooth,
  springPremium,
  staggerCinematic,
} from "@/lib/motion";
import type { NowPlayingSong } from "@/types/firestore";

const GRAIN_TEXTURE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const childReveal = {
  hidden: { opacity: 0, y: 18, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: fadeCinematic,
  },
};

const contentReveal = {
  hidden: {},
  show: {
    transition: staggerCinematic,
  },
};

type NowPlayingOverlayProps = {
  isOpen: boolean;
  song: NowPlayingSong;
  roomName: string;
  onClose: () => void;
  ambient?: AmbientPalette;
};

function OverlayBackground({
  albumArt,
  ambient,
  motionEnabled,
}: {
  albumArt: string;
  ambient: AmbientPalette;
  motionEnabled: boolean;
}) {
  const url = albumArt.trim();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {url ? (
        <>
          <motion.div
            className="absolute inset-[-24%] will-change-transform"
            initial={{ opacity: 0, scale: 1.1, filter: "blur(64px)" }}
            animate={{
              opacity: [0.58, 0.68, 0.58],
              scale: motionEnabled ? [1.04, 1.09, 1.04] : 1.06,
              x: motionEnabled ? [0, "1.5%", 0] : 0,
              y: motionEnabled ? [0, "-1%", 0] : 0,
              filter: "blur(56px) brightness(0.48) saturate(1.2)",
            }}
            transition={{
              opacity: { duration: 10, repeat: Infinity, ease: "easeInOut" },
              scale: { duration: 18, repeat: Infinity, ease: "easeInOut" },
              x: { duration: 22, repeat: Infinity, ease: "easeInOut" },
              y: { duration: 26, repeat: Infinity, ease: "easeInOut" },
            }}
            style={{
              backgroundImage: `url(${JSON.stringify(url)})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <motion.div
            className="absolute inset-0"
            animate={{
              opacity: [0.1, 0.18, 0.1],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              background: `radial-gradient(ellipse 75% 55% at 50% 32%, rgba(${ambient.glowRgb}, 0.2) 0%, transparent 68%)`,
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black" />
      )}

      <div className="absolute inset-0 bg-black/62" />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 85% 70% at 50% 38%, transparent 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.82) 100%)`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-zinc-950/90" />

      <motion.div
        aria-hidden
        className="absolute inset-0 opacity-[0.032] mix-blend-overlay"
        style={{ backgroundImage: GRAIN_TEXTURE }}
        animate={motionEnabled ? { opacity: [0.028, 0.04, 0.028] } : undefined}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function OverlayAlbumArt({
  song,
  ambient,
  motionEnabled,
  finePointer,
}: {
  song: NowPlayingSong;
  ambient: AmbientPalette;
  motionEnabled: boolean;
  finePointer: boolean;
}) {
  return (
    <motion.div
      layoutId={NOW_PLAYING_ART_LAYOUT_ID}
      className="relative aspect-square w-[min(78vw,22rem)] max-w-full"
      whileHover={
        finePointer ? { y: -4, scale: 1.008, transition: { duration: 0.45 } } : undefined
      }
      animate={
        motionEnabled
          ? { scale: [1, 1.012, 1] }
          : { scale: 1 }
      }
      transition={
        motionEnabled
          ? { scale: { duration: 9, repeat: Infinity, ease: "easeInOut" } }
          : springPremium
      }
    >
      <div
        className="absolute -inset-6 rounded-[2rem] opacity-70 blur-2xl will-change-transform"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, rgba(${ambient.glowRgb}, 0.35), transparent 68%)`,
        }}
      />

      <div
        className="relative overflow-hidden rounded-[1.75rem] ring-1 ring-white/12"
        style={{
          boxShadow: `0 32px 72px rgba(0,0,0,0.62), 0 12px 28px rgba(0,0,0,0.4), 0 0 56px rgba(${ambient.glowRgb}, 0.18), 0 0 0 1px ${warmWhite(0.06)}`,
        }}
      >
        <div className="aspect-square w-full">
          <AlbumArt
            src={song.albumArt || undefined}
            alt={`${song.title} album art`}
            titleForLog={song.title}
            size="fill"
          />
        </div>

        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          animate={{ opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${warmWhite(0.14)}, transparent 58%)`,
          }}
        />

        {motionEnabled ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 skew-x-[-8deg]"
            initial={{ x: "-130%" }}
            animate={{ x: "230%" }}
            transition={{
              duration: 14,
              repeat: Infinity,
              ease: "easeInOut",
              repeatDelay: 3.5,
            }}
            style={{
              background:
                "linear-gradient(105deg, transparent 38%, rgba(255,252,247,0.1) 50%, transparent 62%)",
            }}
          />
        ) : null}
      </div>
    </motion.div>
  );
}

export function NowPlayingOverlay({
  isOpen,
  song,
  roomName,
  onClose,
  ambient = DEFAULT_PALETTE,
}: NowPlayingOverlayProps) {
  const playback = useLivePlayback(song);
  const fingerprint = nowPlayingFingerprint(song);
  const { motionEnabled, finePointer } = useMediaMotion();
  const parallax = useSubtleParallax(isOpen && finePointer && motionEnabled);

  useEffect(() => {
    if (!isOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label={`Now playing: ${song.title}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(4px)" }}
          transition={fadeCinematic}
        >
          <motion.button
            type="button"
            aria-label="Close now playing"
            className="absolute inset-0 bg-black/45"
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(14px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={fadeCinematic}
            onClick={onClose}
          />

          <OverlayBackground
            albumArt={song.albumArt}
            ambient={ambient}
            motionEnabled={motionEnabled}
          />

          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeAmbient}
            style={{
              background: `radial-gradient(ellipse 55% 42% at 50% 42%, rgba(${ambient.glowRgb}, 0.14), transparent 72%)`,
            }}
          />

          <motion.div
            className="relative z-[1] flex min-h-0 flex-1 flex-col will-change-transform"
            style={{
              transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)`,
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.16}
            onDragEnd={(_, info) => {
              if (info.offset.y > 72 || info.velocity.y > 420) onClose();
            }}
            initial={{ y: "5%", opacity: 0, filter: "blur(12px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: "4%", opacity: 0, filter: "blur(8px)" }}
            transition={fadeCinematic}
          >
            <motion.div
              variants={childReveal}
              initial="hidden"
              animate="show"
              className="flex justify-center pt-3 pb-2"
            >
              <div className="h-1 w-10 rounded-full bg-white/20" aria-hidden />
            </motion.div>

            <motion.div
              className="flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-1"
              variants={contentReveal}
              initial="hidden"
              animate="show"
            >
              <motion.div variants={childReveal} className="mb-5 w-full sm:mb-6">
                <NowPlayingRoomContext roomName={roomName} ambient={ambient} />
              </motion.div>

              <motion.div variants={childReveal}>
                <OverlayAlbumArt
                  song={song}
                  ambient={ambient}
                  motionEnabled={motionEnabled}
                  finePointer={finePointer}
                />
              </motion.div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={fingerprint}
                  variants={childReveal}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
                  transition={fadeSmooth}
                  className="mt-11 w-full max-w-md text-center"
                >
                  <h2 className="text-[1.65rem] font-bold leading-[1.12] tracking-[-0.03em] text-white sm:text-4xl sm:tracking-[-0.035em]">
                    {song.title}
                  </h2>
                  <p className="mt-2 text-base font-normal tracking-[0.01em] text-zinc-300/90 sm:mt-2 sm:text-lg">
                    {song.artist}
                  </p>
                  <NowPlayingAttribution
                    addedBy={song.addedBy}
                    ambient={ambient}
                  />
                </motion.div>
              </AnimatePresence>
            </motion.div>

            <motion.div
              variants={childReveal}
              initial="hidden"
              animate="show"
              className="relative z-[1] px-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-2"
            >
              <div className="mx-auto w-full max-w-md">
                <PlaybackProgress
                  elapsedMs={playback.elapsedMs}
                  durationMs={playback.durationMs}
                  progress={playback.progress}
                  hasDuration={playback.hasDuration}
                  ambient={ambient}
                />
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
