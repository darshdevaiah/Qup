import {
  buildAmbientPalette,
  DEFAULT_PALETTE,
  type AmbientPalette,
} from "@/lib/ambient-palette";

const cache = new Map<string, AmbientPalette>();

/**
 * Samples album art and returns a desaturated cinematic palette.
 * Falls back to neutral white palette on error.
 */
export async function extractAlbumPalette(
  albumArtUrl: string,
): Promise<AmbientPalette> {
  const url = albumArtUrl.trim();
  if (!url) {
    return DEFAULT_PALETTE;
  }

  const cached = cache.get(url);
  if (cached) {
    return cached;
  }

  try {
    const palette = await sampleImage(url);
    cache.set(url, palette);
    return palette;
  } catch {
    return DEFAULT_PALETTE;
  }
}

function sampleImage(url: string): Promise<AmbientPalette> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 48;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          reject(new Error("Canvas unavailable"));
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          if (lum < 28 || lum > 238) continue;
          rSum += r;
          gSum += g;
          bSum += b;
          count += 1;
        }

        if (count === 0) {
          resolve(DEFAULT_PALETTE);
          return;
        }

        resolve(
          buildAmbientPalette(
            rSum / count,
            gSum / count,
            bSum / count,
          ),
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error("Failed to load album art"));
    img.src = url;
  });
}
