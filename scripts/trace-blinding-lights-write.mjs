/**
 * Trace Blinding Lights: Spotify API → albumArt → Firestore write → read back
 * Run: node scripts/trace-blinding-lights-write.mjs [roomId]
 *
 * Performs a REAL addSongToQueue-style write to Firestore for evidence.
 */
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import {
  doc,
  getDoc,
  getFirestore,
  runTransaction,
} from "firebase/firestore";

function env(name) {
  const match = readFileSync(".env.local", "utf8").match(
    new RegExp(`^${name}=(.+)$`, "m"),
  );
  return match?.[1]?.trim() ?? "";
}

function pickSpotifyAlbumArtUrl(images) {
  if (!images?.length) return null;
  const candidates = images.filter(
    (img) => typeof img?.url === "string" && img.url.trim().length > 0,
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return candidates[0].url;
}

function toAddInput(track, addedBy) {
  return {
    title: track.title,
    artist: track.artist,
    albumArt: track.albumArt ?? "",
    spotifyUrl: track.spotifyUrl ?? "",
    spotifyTrackId: track.id,
    addedBy,
    durationMs: track.durationMs,
  };
}

function createQueuedSong(input) {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    artist: input.artist,
    albumArt: input.albumArt ?? "",
    spotifyUrl: input.spotifyUrl ?? "",
    addedAt: Date.now(),
    addedBy: input.addedBy?.trim().slice(0, 16) ?? "",
    durationMs: input.durationMs,
    voteCount: 0,
    voters: [],
  };
}

function sanitizeQueuedSongForFirestore(song) {
  const complete = {
    id: song.id,
    title: song.title,
    artist: song.artist,
    albumArt: song.albumArt || "",
    spotifyUrl: song.spotifyUrl || "",
    addedAt: song.addedAt ?? Date.now(),
    addedBy: song.addedBy ?? "",
    ...(song.durationMs ? { durationMs: song.durationMs } : {}),
    voteCount: song.voteCount ?? 0,
    voters: song.voters ?? [],
  };
  return Object.fromEntries(
    Object.entries(complete).filter(([, v]) => v !== undefined),
  );
}

function queuedSongToCurrentSong(song) {
  return {
    title: song.title,
    artist: song.artist,
    albumArt: song.albumArt || "",
    spotifyUrl: song.spotifyUrl || "",
    startedAt: Date.now(),
    addedBy: song.addedBy,
    durationMs: song.durationMs,
  };
}

function sanitizeCurrentSongForFirestore(song) {
  const payload = {
    title: song.title,
    artist: song.artist,
    albumArt: song.albumArt || "",
    spotifyUrl: song.spotifyUrl || "",
    startedAt: song.startedAt,
    addedBy: song.addedBy,
    durationMs: song.durationMs,
  };
  return Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined && v !== ""),
  );
}

function parseQueuedSong(raw) {
  return {
    id: raw.id,
    title: raw.title,
    artist: raw.artist,
    albumArt: typeof raw.albumArt === "string" ? raw.albumArt : "",
    spotifyUrl: typeof raw.spotifyUrl === "string" ? raw.spotifyUrl : "",
    addedAt: raw.addedAt,
    addedBy: raw.addedBy ?? "",
    durationMs: raw.durationMs,
    voteCount: raw.voteCount ?? 0,
    voters: raw.voters ?? [],
  };
}

function parseRoomData(data) {
  let nowPlaying = null;
  if (data.currentSong?.title) {
    const raw = data.currentSong;
    nowPlaying = {
      title: String(raw.title),
      artist: String(raw.artist),
      albumArt: typeof raw.albumArt === "string" ? raw.albumArt : "",
      spotifyUrl: typeof raw.spotifyUrl === "string" ? raw.spotifyUrl : "",
      addedBy: raw.addedBy,
      startedAt: raw.startedAt,
      durationMs: raw.durationMs,
    };
  }
  const queue = Array.isArray(data.queue)
    ? data.queue.map(parseQueuedSong)
    : [];
  return { currentSong: nowPlaying, queue };
}

function resolveRoomPlayback(currentSong, queue) {
  if (!currentSong) {
    if (queue.length === 0) return { currentSong: null, queue };
    const next = queue[0];
    return {
      currentSong: queuedSongToCurrentSong(next),
      queue: queue.filter((s) => s.id !== next.id),
    };
  }
  return { currentSong, queue };
}

async function httpGet(url) {
  if (!url?.trim()) return { status: "EMPTY" };
  const res = await fetch(url.trim(), {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const buf = await res.arrayBuffer();
  return {
    status: res.status,
    contentType: res.headers.get("content-type"),
    bytes: buf.byteLength,
  };
}

function firestoreParseDoc(snap) {
  const data = snap.data();
  if (!data) return null;
  return parseRoomData(data);
}

// --- Spotify API ---
const clientId = env("SPOTIFY_CLIENT_ID");
const clientSecret = env("SPOTIFY_CLIENT_SECRET");
const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
  method: "POST",
  headers: {
    Authorization: `Basic ${basic}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: "grant_type=client_credentials",
});
const { access_token: token } = await tokenRes.json();

const searchRes = await fetch(
  "https://api.spotify.com/v1/search?q=Blinding%20Lights&type=track&limit=3&market=US",
  { headers: { Authorization: `Bearer ${token}` } },
);
const searchJson = await searchRes.json();
const item =
  searchJson.tracks?.items?.find(
    (t) =>
      /blinding lights/i.test(t?.name ?? "") &&
      t?.artists?.some((a) => /weeknd/i.test(a?.name ?? "")),
  ) ?? searchJson.tracks?.items?.[0];

console.log("\n========== STEP 1: Spotify API track.album.images ==========");
console.log(JSON.stringify(item?.album?.images ?? null, null, 2));

console.log("\n========== STEP 2: Selected albumArt (pickSpotifyAlbumArtUrl) ==========");
const selectedAlbumArt = pickSpotifyAlbumArtUrl(item?.album?.images ?? null);
console.log("Source: track.album.images via pickSpotifyAlbumArtUrl() in mapSpotifyTrack()");
console.log("NOT track.images:", item?.images ?? null);
console.log("Selected URL:", selectedAlbumArt);
console.log("HTTP GET selected URL:", await httpGet(selectedAlbumArt));

const mappedTrack = {
  id: item.id,
  title: item.name,
  artist: item.artists?.map((a) => a.name).join(", ") ?? "",
  albumArt: selectedAlbumArt,
  durationMs: item.duration_ms,
  spotifyUrl: item.external_urls?.spotify,
};

const addInput = toAddInput(mappedTrack, "trace-test");
const newSong = createQueuedSong(addInput);

console.log("\n========== STEP 3: Client toAddInput (add-song-modal.tsx) ==========");
console.log(JSON.stringify(addInput, null, 2));

console.log("\n========== STEP 4: createQueuedSong (rooms.ts) ==========");
console.log("queue item albumArt:", newSong.albumArt);

const queuePayload = sanitizeQueuedSongForFirestore(newSong);
console.log("\n========== STEP 5: sanitizeQueuedSongForFirestore — payload BEFORE write ==========");
console.log(JSON.stringify({ queueItem: queuePayload }, null, 2));

// --- Firestore write ---
const roomId = process.argv[2] ?? "7DY1B8";
const firebaseConfig = {
  apiKey: env("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: env("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: env("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: env("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: env("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: env("NEXT_PUBLIC_FIREBASE_APP_ID"),
};

initializeApp(firebaseConfig);
const db = getFirestore();
const roomRef = doc(db, "rooms", roomId);

console.log(`\n========== STEP 6: Firestore transaction write → rooms/${roomId} ==========`);

let writePayload = null;
let songId = null;

await runTransaction(db, async (transaction) => {
  const snapshot = await transaction.get(roomRef);
  if (!snapshot.exists()) throw new Error(`Room ${roomId} not found`);

  const room = firestoreParseDoc(snapshot);
  const updatedQueue = [...room.queue, newSong];
  const { currentSong, queue: playbackQueue } = resolveRoomPlayback(
    room.currentSong,
    updatedQueue,
  );

  writePayload = {
    currentSong: currentSong
      ? sanitizeCurrentSongForFirestore(currentSong)
      : null,
    queue: playbackQueue.map(sanitizeQueuedSongForFirestore),
  };

  transaction.update(roomRef, writePayload);
  songId = newSong.id;
});

console.log("Full Firestore update payload:");
console.log(JSON.stringify(writePayload, null, 2));

console.log("\n========== STEP 7: Firestore document AFTER write (read back) ==========");
const afterSnap = await getDoc(roomRef);
const after = firestoreParseDoc(afterSnap);

const writtenQueueItem = after.queue.find((s) => s.id === songId);
const writtenCurrent = after.currentSong;

console.log("Queue item read back:");
console.log(JSON.stringify(writtenQueueItem, null, 2));
console.log("\ncurrentSong read back:");
console.log(JSON.stringify(writtenCurrent, null, 2));

console.log("\n========== STEP 8: URL comparison ==========");
const urls = {
  spotifyApiSelected: selectedAlbumArt,
  toAddInput: addInput.albumArt,
  createQueuedSong: newSong.albumArt,
  sanitizeBeforeWrite: queuePayload.albumArt,
  firestoreQueueAfterRead: writtenQueueItem?.albumArt ?? "(not in queue — promoted?)",
  firestoreCurrentSongAfterRead: writtenCurrent?.albumArt ?? "(null)",
};

console.log(JSON.stringify(urls, null, 2));

const allSame =
  urls.spotifyApiSelected === urls.toAddInput &&
  urls.toAddInput === urls.createQueuedSong &&
  urls.createQueuedSong === urls.sanitizeBeforeWrite;

console.log("\nAll pipeline URLs identical?", allSame);

if (writtenQueueItem) {
  console.log(
    "Queue read-back matches selected?",
    writtenQueueItem.albumArt === selectedAlbumArt,
  );
}
if (writtenCurrent?.title === "Blinding Lights") {
  console.log(
    "currentSong read-back matches selected?",
    writtenCurrent.albumArt === selectedAlbumArt,
  );
}

console.log("\n========== STEP 9: HTTP status on URLs after write ==========");
for (const [label, url] of Object.entries(urls)) {
  if (typeof url === "string" && url.startsWith("http")) {
    console.log(`${label}:`, await httpGet(url));
  }
}

console.log("\n========== WRITE PATH SUMMARY ==========");
console.log(`
Spotify API (track.album.images)
  → pickSpotifyAlbumArtUrl() in server.ts mapSpotifyTrack()
  → /api/spotify/search returns albumArt on track object
  → toAddInput() in add-song-modal.tsx: albumArt: track.albumArt ?? ""
  → createQueuedSong() in rooms.ts: albumArt: input.albumArt ?? ""
  → sanitizeQueuedSongForFirestore(): albumArt: song.albumArt || ""  (no URL transform)
  → transaction.update({ queue, currentSong })
  → parseRoomData on read: typeof raw.albumArt === "string" ? raw.albumArt : ""

No code replaces or re-fetches albumArt URLs. String passes through unchanged.
If input.albumArt is already dead, that exact string is stored.
`);
