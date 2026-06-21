"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type CSSProperties } from "react";

import { fadeAmbient } from "@/lib/motion";

type AmbientAlbumBackgroundProps = {
  albumArt?: string;
};

const ART_OPACITY = 0.54;

function artBackgroundStyle(url: string): CSSProperties {
  return {
    backgroundImage: `url(${JSON.stringify(url)})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    transform: "scale(1.04)",
    filter: "blur(38px) brightness(0.8) saturate(1.1)",
  };
}

type ArtLayerProps = {
  url: string;
  opacity: number;
};

function ArtLayer({ url, opacity }: ArtLayerProps) {
  return (
    <motion.div
      className="absolute inset-0 z-[1]"
      initial={false}
      animate={{ opacity }}
      transition={fadeAmbient}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={artBackgroundStyle(url)}
      />
    </motion.div>
  );
}

/**
 * Full-screen album art from currentSong.albumArt (real cover image).
 */
export function AmbientAlbumBackground({
  albumArt,
}: AmbientAlbumBackgroundProps) {
  const url = albumArt?.trim() ?? "";
  const [visibleUrl, setVisibleUrl] = useState(url);
  const [incomingUrl, setIncomingUrl] = useState("");

  useEffect(() => {
    if (!url) {
      setVisibleUrl("");
      setIncomingUrl("");
      return;
    }

    if (url === visibleUrl) {
      setIncomingUrl("");
      return;
    }

    setIncomingUrl(url);
    const timer = window.setTimeout(() => {
      setVisibleUrl(url);
      setIncomingUrl("");
    }, 700);

    return () => window.clearTimeout(timer);
  }, [url, visibleUrl]);

  const hasArt = Boolean(visibleUrl || incomingUrl);
  const isCrossfading = Boolean(incomingUrl && visibleUrl);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <AnimatePresence>
        {!hasArt ? (
          <motion.div
            key="fallback"
            className="absolute inset-0 z-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeAmbient}
          />
        ) : null}
      </AnimatePresence>

      {visibleUrl ? (
        <ArtLayer
          url={visibleUrl}
          opacity={isCrossfading ? 0 : ART_OPACITY}
        />
      ) : null}

      {incomingUrl ? (
        <ArtLayer url={incomingUrl} opacity={ART_OPACITY} />
      ) : null}

      <motion.div
        className="absolute inset-0 z-10"
        initial={false}
        animate={{ opacity: hasArt ? 1 : 0 }}
        transition={fadeAmbient}
      >
        <div className="absolute inset-0 bg-black/22" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/30 to-zinc-950/75" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/45 via-transparent to-black/10" />
      </motion.div>
    </div>
  );
}
