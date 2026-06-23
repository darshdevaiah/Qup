/** Picks the largest Spotify album image URL from a Web API `images` array. */
export function pickSpotifyAlbumArtUrl(
  images?:
    | ReadonlyArray<{
        url?: string;
        width?: number | null;
        height?: number | null;
      }>
    | null,
): string | null {
  if (!images?.length) return null;

  const candidates = images.filter(
    (img): img is { url: string; width?: number | null; height?: number | null } =>
      typeof img?.url === "string" && img.url.trim().length > 0,
  );

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return candidates[0]!.url;
}

/** Logs artwork URL for SICKO MODE across the Spotify → Firestore → UI pipeline. */
export function logAlbumArtStage(
  stage: string,
  title: string,
  url: string | null | undefined,
): void {
  if (!/sicko\s*mode/i.test(title)) return;

  console.log(`[Qup AlbumArt] ${stage}`, {
    title,
    url: url?.trim() || "(empty)",
  });
}

/** True when a URL looks like a Spotify CDN art link. */
export function isSpotifyAlbumArtUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const { hostname } = new URL(url);
    return hostname === "i.scdn.co" || hostname.endsWith(".scdn.co");
  } catch {
    return false;
  }
}
