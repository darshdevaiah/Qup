import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";

import { isMobileOrSafari } from "@/lib/room-load-debug";

export type FirebaseStartupEvent =
  | "init"
  | "firebase-config-loaded"
  | "firebase-config-missing"
  | "firebase-app-created"
  | "firestore-created"
  | "subscribe-start"
  | "snapshot-received"
  | "snapshot-error";

/**
 * Static reads only — Next.js inlines `process.env.NEXT_PUBLIC_*` at compile time
 * for literal property access. Dynamic access like `process.env[key]` is NOT
 * replaced and is always undefined in the browser bundle.
 */
const FIREBASE_ENV = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
} as const;

const ENV_KEY_LABELS: Record<keyof typeof FIREBASE_ENV, string> = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
};

console.log("[Qup Firebase env]", {
  apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

export type FirebaseEnvAudit = {
  ok: boolean;
  missing: string[];
  present: string[];
  summary: string;
};

function readConfigValue(key: keyof typeof FIREBASE_ENV): string | undefined {
  const value = FIREBASE_ENV[key];
  return value || undefined;
}

export function auditFirebaseEnv(): FirebaseEnvAudit {
  const missing: string[] = [];
  const present: string[] = [];

  for (const key of Object.keys(FIREBASE_ENV) as (keyof typeof FIREBASE_ENV)[]) {
    const value = readConfigValue(key);
    if (!value) {
      missing.push(ENV_KEY_LABELS[key]);
    } else {
      present.push(ENV_KEY_LABELS[key]);
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    present,
    summary: missing.length
      ? `missing: ${missing.join(", ")}`
      : `ok (${present.length}/6)`,
  };
}

export function getFirebaseConfigForInit() {
  return { ...FIREBASE_ENV };
}

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

export type StartupTrace = {
  app: FirebaseApp;
  db: Firestore;
};

/**
 * Initializes Firebase + Firestore with explicit trace events.
 * Throws on missing config — never fails silently.
 */
export function traceFirebaseStartup(
  onEvent: (event: FirebaseStartupEvent, detail?: string) => void,
): StartupTrace {
  const audit = auditFirebaseEnv();
  onEvent("firebase-config-loaded", audit.summary);

  if (!audit.ok) {
    onEvent("firebase-config-missing", audit.missing.join(", "));
    throw new Error(
      `Missing Firebase environment variables: ${audit.missing.join(", ")}`,
    );
  }

  const firebaseConfig = getFirebaseConfigForInit() as {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };

  if (!app) {
    app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  onEvent("firebase-app-created", app.name);

  if (!db) {
    const forceLongPolling = isMobileOrSafari();
    try {
      db = initializeFirestore(app, {
        experimentalForceLongPolling: forceLongPolling,
        ...(forceLongPolling
          ? { experimentalAutoDetectLongPolling: false }
          : {}),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "initializeFirestore failed";
      onEvent("snapshot-error", `firestore-fallback: ${message}`);
      db = getFirestore(app);
    }
  }

  onEvent(
    "firestore-created",
    `longPolling=${isMobileOrSafari() ? "yes" : "no"}`,
  );

  return { app, db };
}

export function getTracedFirestoreDb(
  onEvent: (event: FirebaseStartupEvent, detail?: string) => void,
): Firestore {
  return traceFirebaseStartup(onEvent).db;
}

/** Firebase app singleton (safe for Next.js hot reload). */
export function getFirebaseApp(): FirebaseApp {
  return traceFirebaseStartup(() => {}).app;
}

/** Firestore singleton. */
export function getFirestoreDb(): Firestore {
  if (!db) {
    db = traceFirebaseStartup(() => {}).db;
  }
  return db;
}

export function getFirebaseConfigSummary(): string {
  return auditFirebaseEnv().summary;
}
