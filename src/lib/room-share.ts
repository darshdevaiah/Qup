function normalizeOrigin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `http://${trimmed}`;
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

function isLocalDevHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

/** Reads optional LAN override from NEXT_PUBLIC_SHARE_ORIGIN (local dev only). */
export function getConfiguredShareOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SHARE_ORIGIN?.trim();
  if (!raw) return null;
  return normalizeOrigin(raw);
}

/**
 * Resolves the origin used for share links.
 *
 * - Production / Vercel: always `window.location.origin`
 * - Dev on LAN IP (phone): `window.location.origin`
 * - Dev on localhost: `NEXT_PUBLIC_SHARE_ORIGIN` → `window.location.origin`
 */
export function resolveShareOrigin(): string {
  if (typeof window === "undefined") {
    return getConfiguredShareOrigin() ?? "";
  }

  const { origin, hostname } = window.location;

  if (process.env.NODE_ENV === "production") {
    return origin;
  }

  if (!isLocalDevHost(hostname)) {
    return origin;
  }

  return getConfiguredShareOrigin() ?? origin;
}

/** Builds a room URL for copy, share, and QR. */
export function getRoomShareUrl(roomId: string): string {
  const origin = resolveShareOrigin();
  if (!origin || !roomId.trim()) return "";

  const code = encodeURIComponent(roomId.trim().toUpperCase());
  return `${origin.replace(/\/$/, "")}/room/${code}`;
}

export function getRoomShareCode(roomId: string, roomCode?: string): string {
  const raw = roomCode?.trim() || roomId.trim();
  return raw.toUpperCase();
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

type ShareRoomNativeOptions = {
  title: string;
  url: string;
  text?: string;
};

/** Returns true when the native share sheet was shown. */
export async function shareRoomNative(
  options: ShareRoomNativeOptions,
): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share) {
    return false;
  }

  await navigator.share({
    title: options.title,
    url: options.url,
    text: options.text,
  });

  return true;
}
