import type { FirebaseStartupEvent } from "@/lib/firebase-startup";

export type RoomLoadDebug = {
  loadingState: string;
  firestoreConnected: string;
  snapshotReceived: string;
  roomParseSuccess: string;
  identityGate: string;
  error: string;
  safariChecks: string;
  lastEvent: string;
  /** ssr = server HTML; browser = client JS executing render */
  clientRuntime: string;
  /** yes after first client useEffect runs */
  clientHydrated: string;
  /** Result of NEXT_PUBLIC_FIREBASE_* audit */
  firebaseEnv: string;
  /** Which env vars are missing, if any */
  firebaseEnvMissing: string;
  /** Human-readable blocker when Firestore never starts */
  startupBlocker: string;
};

export const INITIAL_ROOM_LOAD_DEBUG: RoomLoadDebug = {
  loadingState: "loading",
  firestoreConnected: "no",
  snapshotReceived: "no",
  roomParseSuccess: "no",
  identityGate: "waiting for room",
  error: "none",
  safariChecks: "pending",
  lastEvent: "init",
  clientRuntime: typeof window === "undefined" ? "ssr" : "browser",
  clientHydrated: "no",
  firebaseEnv: "unchecked",
  firebaseEnvMissing: "none",
  startupBlocker: "waiting for client mount",
};

export type { FirebaseStartupEvent };

function testStorage(kind: "sessionStorage" | "localStorage"): string {
  try {
    const storage = window[kind];
    const key = `__qup_${kind}_test__`;
    storage.setItem(key, "1");
    storage.removeItem(key);
    return "ok";
  } catch (error) {
    return error instanceof Error ? error.message : "failed";
  }
}

/** Runs client-side compatibility checks relevant to room load on Safari/iOS. */
export function runSafariCompatChecks(): string {
  if (typeof window === "undefined") {
    return "server (typeof window === undefined)";
  }

  const parts = [
    `sessionStorage=${testStorage("sessionStorage")}`,
    `localStorage=${testStorage("localStorage")}`,
    `crypto.randomUUID=${
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? "ok"
        : "missing"
    }`,
    `URL=${typeof URL !== "undefined" ? "ok" : "missing"}`,
    `navigator=${typeof navigator !== "undefined" ? "ok" : "missing"}`,
    `origin=${window.location.origin}`,
  ];

  return parts.join(" · ");
}

export function isMobileOrSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPhone|iPad|iPod|Android/i.test(ua) ||
    (/Safari/i.test(ua) && !/Chrome|CriOS|FxiOS/i.test(ua))
  );
}

/** Explains why Firestore may not have started based on debug snapshot. */
export function describeStartupBlocker(debug: RoomLoadDebug): string {
  if (debug.clientRuntime === "ssr") {
    return "SSR HTML only — client JS has not rendered yet";
  }
  if (debug.clientHydrated === "no") {
    return "Client render ran but useEffect never fired — possible render crash before commit";
  }
  if (debug.safariChecks === "pending") {
    return "Client effects did not run (safariChecks still pending)";
  }
  if (debug.firebaseEnvMissing !== "none") {
    return `Firebase env missing: ${debug.firebaseEnvMissing}`;
  }
  if (debug.lastEvent === "init") {
    return "Effects ran but subscribe pipeline never started — check hook order / render abort";
  }
  if (
    debug.lastEvent === "subscribe-start" ||
    debug.lastEvent === "firebase-config-loaded"
  ) {
    return "Subscribe started but Firebase init did not complete";
  }
  if (debug.firestoreConnected === "no" || debug.firestoreConnected === "connecting") {
    return "Firebase init incomplete or listener not attached";
  }
  return "none";
}
