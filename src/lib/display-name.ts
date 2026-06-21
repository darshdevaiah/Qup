const STORAGE_KEY = "qup-display-name";
export const DISPLAY_NAME_MAX_LENGTH = 16;

/** Small blocklist for MVP — whole-word match only. */
const PROFANITY = [
  "ass",
  "asshole",
  "bitch",
  "damn",
  "fuck",
  "fucking",
  "shit",
  "slut",
  "whore",
];

export function containsProfanity(name: string): boolean {
  const lower = name.toLowerCase();
  return PROFANITY.some((word) => {
    const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, "i");
    return re.test(lower);
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function generateGuestName(): string {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `Guest ${suffix}`;
}

/** Validates, filters, and returns a safe display name (guest fallback if needed). */
export function sanitizeDisplayName(raw: string): string {
  const trimmed = raw.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);

  if (!trimmed || containsProfanity(trimmed)) {
    return generateGuestName();
  }

  return trimmed;
}

export function getStoredDisplayName(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const trimmed = stored.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
    if (!trimmed || containsProfanity(trimmed)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return trimmed;
  } catch (error) {
    console.warn("[Qup Room] localStorage unavailable for display name", error);
    return null;
  }
}

export function setStoredDisplayName(name: string): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, name);
}

export function clearStoredDisplayName(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
}
