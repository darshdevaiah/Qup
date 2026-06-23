/**
 * Now Playing only — run: node scripts/inspect-now-playing-firestore.mjs [roomId]
 */
import { readFileSync } from "node:fs";

function env(name) {
  const match = readFileSync(".env.local", "utf8").match(
    new RegExp(`^${name}=(.+)$`, "m"),
  );
  return match?.[1]?.trim() ?? "";
}

function firestoreValue(field) {
  if (!field || typeof field !== "object") return undefined;
  if ("stringValue" in field) return field.stringValue;
  if ("integerValue" in field) return Number(field.integerValue);
  if ("doubleValue" in field) return field.doubleValue;
  if ("booleanValue" in field) return field.booleanValue;
  if ("nullValue" in field) return null;
  if ("mapValue" in field) {
    const out = {};
    for (const [k, v] of Object.entries(field.mapValue.fields ?? {})) {
      out[k] = firestoreValue(v);
    }
    return out;
  }
  if ("arrayValue" in field) {
    return (field.arrayValue.values ?? []).map(firestoreValue);
  }
  return undefined;
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

const projectId = env("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
const apiKey = env("NEXT_PUBLIC_FIREBASE_API_KEY");
const roomArg = process.argv[2];

if (!projectId || !apiKey) {
  console.error("Missing NEXT_PUBLIC_FIREBASE_* in .env.local");
  process.exit(1);
}

async function readRoom(roomId) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/rooms/${encodeURIComponent(roomId)}?key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    return { roomId, error: `${res.status} ${await res.text()}` };
  }
  const doc = await res.json();
  const fields = doc.fields ?? {};
  const currentSong = firestoreValue(fields.currentSong) ?? null;
  return {
    roomId,
    name: firestoreValue(fields.name),
    createdAt: firestoreValue(fields.createdAt),
    currentSong,
  };
}

let rooms = [];
if (roomArg) {
  rooms = [await readRoom(roomArg)];
} else {
  const listUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/rooms?pageSize=50&key=${apiKey}`;
  const list = await fetch(listUrl).then((r) => r.json());
  for (const doc of list.documents ?? []) {
    const roomId = doc.name.split("/").pop();
    rooms.push(await readRoom(roomId));
  }
  rooms.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

for (const room of rooms) {
  console.log("\n" + "=".repeat(72));
  console.log(`ROOM: ${room.roomId}`);
  if (room.error) {
    console.log("ERROR:", room.error);
    continue;
  }
  console.log("name:", room.name);
  console.log("createdAt:", room.createdAt ?? "(unknown)");

  console.log("\n--- 1. currentSong object from Firestore (parsed) ---");
  console.log(JSON.stringify(room.currentSong, null, 2));

  const albumArt = room.currentSong?.albumArt ?? "";
  console.log("\n--- 2. currentSong.albumArt ---");
  console.log(JSON.stringify(albumArt));

  console.log("\n--- 3. HTTP GET on currentSong.albumArt ---");
  if (!albumArt?.trim()) {
    console.log("SKIP: albumArt is empty/missing → Now Playing card shows MusicIcon placeholder, NOT Spotify URL");
  } else {
    console.log("URL:", albumArt);
    console.log(await httpGet(albumArt.trim()));
  }
}

console.log("\n--- 4. Now Playing render chain ---");
console.log("now-playing-card.tsx → AlbumArt src={song.albumArt}");
console.log("now-playing-overlay.tsx → AlbumArt src={song.albumArt || undefined}");
console.log("album-art.tsx → <img src={albumArt} /> (diagnostic, no next/image, no referrerPolicy)");
