import { generateId } from "@/lib/generate-id";

const VOTER_ID_KEY = "qup-voter-id";

let memoryVoterId: string | null = null;

/** Stable per-browser voter id stored in sessionStorage (resets when tab closes). */
export function getVoterId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const existing = sessionStorage.getItem(VOTER_ID_KEY);
    if (existing) {
      return existing;
    }

    const id = generateId();
    sessionStorage.setItem(VOTER_ID_KEY, id);
    return id;
  } catch (error) {
    console.warn("[Qup Room] sessionStorage unavailable, using memory voter id", error);
    if (!memoryVoterId) {
      memoryVoterId = generateId();
    }
    return memoryVoterId;
  }
}
