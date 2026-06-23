/**
 * Side-by-side: Spotify images → selected albumArt → write payload → Firestore stored
 * Run: node scripts/album-art-four-values.mjs [searchQuery] [roomId]
 */
import { readFileSync } from "node:fs";

function env(name) {
  const m = readFileSync(".env.local", "utf8").match(new RegExp(`^${name}=(.+)$`, "m"));
  return m?.[1]?.trim() ?? "";
}

function pickSpotifyAlbumArtUrl(images) {
  if (!images?.length) return null;
  const c = images.filter((i) => typeof i?.url === "string" && i.url.trim());
  if (!c.length) return null;
  c.sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return c[0].url;
}

function toAddInput(track) {
  return {
    title: track.title,
    artist: track.artist,
    albumArt: track.albumArt ?? "",
    spotifyUrl: track.spotifyUrl ?? "",
    spotifyTrackId: track.id,
    addedBy: "trace",
    durationMs: track.durationMs,
  };
}

function createQueuedSong(input) {
  return {
    id: "trace-id",
    title: input.title,
    artist: input.artist,
    albumArt: input.albumArt ?? "",
    spotifyUrl: input.spotifyUrl ?? "",
    addedAt: Date.now(),
    addedBy: input.addedBy ?? "",
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
  return Object.fromEntries(Object.entries(complete).filter(([, v]) => v !== undefined));
}

function firestoreValue(field) {
  if (!field || typeof field !== "object") return undefined;
  if ("stringValue" in field) return field.stringValue;
  if ("integerValue" in field) return Number(field.integerValue);
  if ("doubleValue" in field) return field.doubleValue;
  if ("mapValue" in field) {
    const o = {};
    for (const [k, v] of Object.entries(field.mapValue.fields ?? {})) o[k] = firestoreValue(v);
    return o;
  }
  if ("arrayValue" in field) return (field.arrayValue.values ?? []).map(firestoreValue);
  return undefined;
}

const query = process.argv[2] ?? "Blinding Lights";
const roomId = process.argv[3];

// --- 1 & 2: Spotify API via local app route (same path as Add Song search) ---
const searchRes = await fetch(
  `http://localhost:3000/api/spotify/search?q=${encodeURIComponent(query)}`,
);
const searchJson = await searchRes.json();
const track =
  searchJson.tracks?.find((t) => new RegExp(query.split(" ")[0], "i").test(t.title)) ??
  searchJson.tracks?.[0];

if (!track) {
  console.error("No search results. Is dev server running on :3000?");
  process.exit(1);
}

// Also fetch raw Spotify album.images for step 1
const clientId = env("SPOTIFY_CLIENT_ID");
const clientSecret = env("SPOTIFY_CLIENT_SECRET");
const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
const tok = await fetch("https://accounts.spotify.com/api/token", {
  method: "POST",
  headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
}).then((r) => r.json());
const rawSearch = await fetch(
  `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=3&market=US`,
  { headers: { Authorization: `Bearer ${tok.access_token}` } },
).then((r) => r.json());
const rawItem =
  rawSearch.tracks?.items?.find((t) => t.id === track.id) ?? rawSearch.tracks?.items?.[0];
const albumImages = rawItem?.album?.images ?? null;
const selectedFromMapper = pickSpotifyAlbumArtUrl(albumImages);

// --- 3: Firestore write payload (exact sanitize path) ---
const input = toAddInput(track);
const song = createQueuedSong(input);
const writePayload = sanitizeQueuedSongForFirestore(song);

// --- 4: Firestore stored value (read newest matching queue item) ---
let storedAlbumArt = "(no roomId — pass roomId as 2nd arg to read Firestore)";
let storedTitle = "";
let storedQueueItem = null;

const projectId = env("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
const apiKey = env("NEXT_PUBLIC_FIREBASE_API_KEY");

if (roomId && projectId && apiKey) {
  const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/rooms/${encodeURIComponent(roomId)}?key=${apiKey}`;
  const doc = await fetch(docUrl).then((r) => r.json());
  const queue = firestoreValue(doc.fields?.queue) ?? [];
  const match =
    [...queue]
      .filter((s) => s.spotifyUrl === track.spotifyUrl || s.title === track.title)
      .sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))[0] ??
    [...queue].sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))[0];

  storedQueueItem = match ?? null;
  storedAlbumArt = match?.albumArt ?? "(not found in queue)";
  storedTitle = match?.title ?? "";
  const cs = firestoreValue(doc.fields?.currentSong);
  if (cs?.title === track.title) {
    storedAlbumArt = cs.albumArt ?? storedAlbumArt;
    storedTitle = cs.title;
    storedQueueItem = { ...cs, source: "currentSong" };
  }
} else if (projectId && apiKey) {
  const list = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/rooms?pageSize=20&key=${apiKey}`,
  ).then((r) => r.json());
  let best = null;
  for (const d of list.documents ?? []) {
    const id = d.name.split("/").pop();
    const queue = firestoreValue(d.fields?.queue) ?? [];
    for (const s of queue) {
      if (s.spotifyUrl === track.spotifyUrl || s.title === track.title) {
        if (!best || (s.addedAt ?? 0) > (best.song.addedAt ?? 0)) {
          best = { roomId: id, song: s };
        }
      }
    }
    const cs = firestoreValue(d.fields?.currentSong);
    if (cs && (cs.spotifyUrl === track.spotifyUrl || cs.title === track.title)) {
      if (!best || (cs.startedAt ?? 0) > (best.song.addedAt ?? 0)) {
        best = { roomId: id, song: { ...cs, source: "currentSong" } };
      }
    }
  }
  if (best) {
    storedQueueItem = best.song;
    storedAlbumArt = best.song.albumArt ?? "";
    storedTitle = best.song.title;
    storedAlbumArt = `${storedAlbumArt} (room ${best.roomId})`;
  } else {
    storedAlbumArt = "(no matching song in any room — add from search first, then re-run with roomId)";
  }
}

console.log("\n" + "=".repeat(80));
console.log(`TRACK: ${track.title} — ${track.artist}`);
console.log("=".repeat(80));

console.log("\n┌─ 1. track.album.images (Spotify Web API raw) ─────────────────────────────");
console.log(JSON.stringify(albumImages, null, 2));

console.log("\n├─ 2. selected albumArt (pickSpotifyAlbumArtUrl → mapSpotifyTrack → /api/search) ─");
console.log("   mapper pick:", selectedFromMapper);
console.log("   app API track.albumArt:", track.albumArt);
console.log("   match?", selectedFromMapper === track.albumArt);

console.log("\n├─ 3. Firestore write payload (sanitizeQueuedSongForFirestore) ──────────────");
console.log(JSON.stringify({ albumArt: writePayload.albumArt, full: writePayload }, null, 2));

console.log("\n└─ 4. Firestore stored value (read back) ─────────────────────────────────────");
console.log("   title:", storedTitle || track.title);
console.log("   albumArt:", storedAlbumArt);
if (storedQueueItem) console.log("   full record:", JSON.stringify(storedQueueItem, null, 2));

console.log("\n" + "─".repeat(80));
console.log("SIDE BY SIDE (albumArt URLs only)");
console.log("─".repeat(80));
console.log(`1. images[0].url (640w):  ${albumImages?.[0]?.url ?? "null"}`);
console.log(`2. selected albumArt:     ${track.albumArt ?? selectedFromMapper ?? "null"}`);
console.log(`3. write payload:         ${writePayload.albumArt}`);
console.log(`4. Firestore stored:      ${typeof storedAlbumArt === "string" && storedAlbumArt.includes("http") ? storedAlbumArt.split(" (room")[0] : storedAlbumArt}`);

const u2 = track.albumArt ?? selectedFromMapper;
const u3 = writePayload.albumArt;
const u4 = storedQueueItem?.albumArt;
console.log("\nComparisons:");
console.log(`  2 === 3?  ${u2 === u3}  (client→sanitize: no mutation)`);
if (u4) console.log(`  3 === 4?  ${u3 === u4}  (write→read: ${u3 === u4 ? "IDENTICAL" : "DIFFER — investigate"})`);
if (u4 && u2 !== u4) console.log(`  2 === 4?  ${u2 === u4}`);

if (u2?.startsWith("http")) {
  const h = await fetch(u2, { headers: { "User-Agent": "Mozilla/5.0" } });
  console.log(`\nHTTP GET on selected URL: status=${h.status} bytes=${(await h.arrayBuffer()).byteLength}`);
}
if (u4?.startsWith("http") && u4 !== u2) {
  const h = await fetch(u4, { headers: { "User-Agent": "Mozilla/5.0" } });
  console.log(`HTTP GET on stored URL:    status=${h.status} bytes=${(await h.arrayBuffer()).byteLength}`);
}
