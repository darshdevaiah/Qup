/**
 * Evidence script — run: node scripts/diagnose-album-art-pipeline.mjs [roomCode]
 * Does NOT print credentials.
 */
import { readFileSync } from "node:fs";

function env(name) {
  const match = readFileSync(".env.local", "utf8").match(
    new RegExp(`^${name}=(.+)$`, "m"),
  );
  return match?.[1]?.trim() ?? "";
}

function classifyUrl(raw) {
  if (raw === null) return { state: "null", src: null };
  if (raw === undefined) return { state: "undefined", src: undefined };
  if (typeof raw !== "string") return { state: "not-a-string", src: String(raw) };
  const trimmed = raw.trim();
  if (!trimmed) return { state: "empty", src: "" };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { state: "malformed-protocol", src: trimmed };
    }
    return { state: "valid-url", src: trimmed, hostname: parsed.hostname };
  } catch {
    return { state: "malformed", src: trimmed };
  }
}

async function httpGet(url) {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
  });
  const buf = await res.arrayBuffer();
  return {
    status: res.status,
    contentType: res.headers.get("content-type"),
    bytes: buf.byteLength,
  };
}

async function spotifySearchUrls() {
  const clientId = env("SPOTIFY_CLIENT_ID");
  const clientSecret = env("SPOTIFY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    console.log("\n=== Spotify search API ===\nSKIP (missing SPOTIFY_CLIENT_ID/SECRET)");
    return;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const tokenJson = await tokenRes.json();
  if (!tokenJson.access_token) {
    console.log("\n=== Spotify search API ===\nToken failed");
    return;
  }

  const searchRes = await fetch(
    "https://api.spotify.com/v1/search?q=SICKO%20MODE%20Travis%20Scott&type=track&limit=1&market=US",
    { headers: { Authorization: `Bearer ${tokenJson.access_token}` } },
  );
  const searchJson = await searchRes.json();
  const item = searchJson.tracks?.items?.[0];
  const images = item?.album?.images ?? [];
  images.sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  const mapped = images[0]?.url ?? null;

  console.log("\n=== Spotify search API (SICKO MODE) ===");
  console.log("Mapped albumArt:", mapped ?? "(null)");
  const mappedClass = classifyUrl(mapped);
  console.log("URL classification:", mappedClass);
  if (mappedClass.state === "valid-url") {
    const head = await httpGet(mappedClass.src);
    console.log("HTTP GET mapped URL:", head);
  }

  const stale =
    "https://i.scdn.co/image/ab67616d0000b273006940f445b2cbaa10c457f0";
  console.log("\n=== Previously hardcoded discovery URL ===");
  console.log("URL:", stale);
  const staleHead = await httpGet(stale);
  console.log("HTTP GET stale URL:", staleHead);
}

async function localSearchApi() {
  console.log("\n=== Local /api/spotify/search ===");
  try {
    const res = await fetch(
      "http://localhost:3000/api/spotify/search?q=sicko%20mode&limit=1",
    );
    const data = await res.json();
    const track = data.tracks?.[0];
    if (!track) {
      console.log("No tracks (is dev server running on :3000?)");
      return;
    }
    console.log("title:", track.title);
    console.log("albumArt:", track.albumArt);
    const c = classifyUrl(track.albumArt);
    console.log("URL classification:", c);
    if (c.state === "valid-url") {
      console.log("HTTP GET:", await httpGet(c.src));
    }
  } catch (e) {
    console.log("SKIP:", e.message);
  }
}

async function firestoreRoom(roomCode) {
  const projectId = env("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const apiKey = env("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!projectId || !apiKey) {
    console.log("\n=== Firestore room data ===\nSKIP (missing Firebase env)");
    return;
  }

  const code = (roomCode || "TEST").toUpperCase();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/rooms/${code}?key=${apiKey}`;

  console.log(`\n=== Firestore room/${code} ===`);
  const res = await fetch(url);
  if (!res.ok) {
    console.log("Firestore read failed:", res.status, await res.text());
    return;
  }

  const doc = await res.json();
  const fields = doc.fields ?? {};

  function readString(field) {
    return field?.stringValue ?? "";
  }

  const current = fields.currentSong?.mapValue?.fields;
  if (current) {
    const albumArt = readString(current.albumArt);
    console.log("\nnowPlaying:", readString(current.title), "-", readString(current.artist));
    console.log("albumArt:", albumArt || "(empty string)");
    console.log("classification:", classifyUrl(albumArt));
    const c = classifyUrl(albumArt);
    if (c.state === "valid-url") {
      console.log("HTTP GET:", await httpGet(c.src));
    }
  } else {
    console.log("\nnowPlaying: (null)");
  }

  const queue = fields.queue?.arrayValue?.values ?? [];
  console.log(`\nqueue (${queue.length} items):`);
  for (let i = 0; i < Math.min(queue.length, 5); i++) {
    const song = queue[i]?.mapValue?.fields;
    if (!song) continue;
    const title = readString(song.title);
    const albumArt = readString(song.albumArt);
    const c = classifyUrl(albumArt);
    console.log(`  [${i}] ${title}`);
    console.log(`      albumArt: ${albumArt || "(empty)"}`);
    console.log(`      classification: ${c.state}`);
    if (c.state === "valid-url") {
      const head = await httpGet(c.src);
      console.log(`      HTTP GET: status=${head.status} type=${head.contentType}`);
    } else if (c.state === "empty") {
      console.log("      → UI renders <img src=\"\"> → browser broken-image icon");
    }
  }
}

const roomArg = process.argv[2];
await spotifySearchUrls();
await localSearchApi();
await firestoreRoom(roomArg);
