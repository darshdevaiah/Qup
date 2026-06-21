"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_PALETTE,
  type AmbientPalette,
} from "@/lib/ambient-palette";
import { extractAlbumPalette } from "@/lib/extract-album-palette";

/**
 * Extracts album-art colors and crossfades palette when the track changes.
 */
export function useAmbientPalette(albumArt?: string): AmbientPalette {
  const [palette, setPalette] = useState<AmbientPalette>(DEFAULT_PALETTE);
  const url = albumArt?.trim() ?? "";

  useEffect(() => {
    if (!url) {
      setPalette(DEFAULT_PALETTE);
      return;
    }

    let cancelled = false;

    extractAlbumPalette(url).then((next) => {
      if (!cancelled) {
        setPalette(next);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return palette;
}
