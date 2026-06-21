import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { getFirestoreDb } from "@/lib/firebase";
import { COLLECTIONS } from "@/types/firestore";

export type FirebaseConnectionTestResult = {
  ok: boolean;
  message: string;
  projectId?: string;
};

/**
 * Writes and reads a small health document to verify Firestore connectivity.
 * Requires Firestore rules that allow read/write on `_health/ping` (dev/test mode works).
 */
export async function testFirebaseConnection(): Promise<FirebaseConnectionTestResult> {
  const db = getFirestoreDb();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const healthRef = doc(db, COLLECTIONS.health, "ping");

  await setDoc(
    healthRef,
    {
      source: "qup-app",
      checkedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const snapshot = await getDoc(healthRef);

  if (!snapshot.exists()) {
    return {
      ok: false,
      message: "Firestore write succeeded but read returned no document.",
      projectId,
    };
  }

  return {
    ok: true,
    message: "Firestore connection successful (read/write on _health/ping).",
    projectId,
  };
}
