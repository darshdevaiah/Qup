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

/** Reads optional override from NEXT_PUBLIC_SHARE_ORIGIN. */
export function getConfiguredShareOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SHARE_ORIGIN?.trim();
  if (!raw) return null;
  return normalizeOrigin(raw);
}

/**
 * Resolves the origin used for share links.
 * Priority: NEXT_PUBLIC_SHARE_ORIGIN → window.location.origin
 */
export function resolveShareOrigin(): string {
  const configured = getConfiguredShareOrigin();
  if (configured) return configured;

  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
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
