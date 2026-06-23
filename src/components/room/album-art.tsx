"use client";

import { useEffect } from "react";

type AlbumArtProps = {
  src?: string;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl" | "fill";
  titleForLog?: string;
};

function classifyAlbumArtUrl(raw: string | null | undefined) {
  if (raw === null) {
    return { state: "null" as const, src: "", malformed: true };
  }
  if (raw === undefined) {
    return { state: "undefined" as const, src: "", malformed: true };
  }
  if (typeof raw !== "string") {
    return { state: "not-a-string" as const, src: String(raw), malformed: true };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { state: "empty" as const, src: "", malformed: true };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        state: "malformed-protocol" as const,
        src: trimmed,
        malformed: true,
      };
    }
    return {
      state: "valid-url" as const,
      src: trimmed,
      malformed: false,
      hostname: parsed.hostname,
    };
  } catch {
    return { state: "malformed" as const, src: trimmed, malformed: true };
  }
}

/** TEMP DIAGNOSTIC — single render point for all album artwork in the app. */
export function AlbumArt({
  src,
  alt,
  titleForLog,
}: AlbumArtProps) {
  const albumArt = src;
  const classified = classifyAlbumArtUrl(albumArt);

  useEffect(() => {
    console.log("[Qup AlbumArt DIAG]", {
      component: "AlbumArt",
      title: titleForLog ?? alt,
      rawProp: albumArt,
      urlState: classified.state,
      malformed: classified.malformed,
      finalSrcRendered: classified.src,
      hostname:
        classified.state === "valid-url" ? classified.hostname : undefined,
    });
  }, [albumArt, alt, titleForLog, classified]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={albumArt}
      alt="album"
      style={{ width: 100, height: 100 }}
      onLoad={() => {
        console.log("[Qup AlbumArt DIAG] onLoad OK", {
          title: titleForLog ?? alt,
          src: classified.src,
        });
      }}
      onError={() => {
        console.error("[Qup AlbumArt DIAG] onError FAILED", {
          title: titleForLog ?? alt,
          urlState: classified.state,
          src: classified.src,
          reason:
            classified.state === "empty" ||
            classified.state === "null" ||
            classified.state === "undefined"
              ? "empty-or-missing-src-produces-browser-broken-icon"
              : classified.state === "valid-url"
                ? "url-set-but-image-request-failed-404-or-blocked"
                : "malformed-src",
        });
      }}
    />
  );
}
