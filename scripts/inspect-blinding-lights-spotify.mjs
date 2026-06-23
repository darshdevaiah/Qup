/**
 * Evidence only — run: node scripts/inspect-blinding-lights-spotify.mjs
 * Prints raw Spotify JSON + mapped albumArt for Blinding Lights.
 */
import { readFileSync } from "node:fs";

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

const clientId = env("SPOTIFY_CLIENT_ID");
const clientSecret = env("SPOTIFY_CLIENT_SECRET");
if (!clientId || !clientSecret) {
  console.error("Missing SPOTIFY credentials in .env.local");
  process.exit(1);
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
const { access_token: token } = await tokenRes.json();

const query = "Blinding Lights";
const searchUrl =
  "https://api.spotify.com/v1/search?" +
  new URLSearchParams({
    q: query,
    type: "track",
    limit: "5",
    market: "US",
  });

console.log("\n========== 1. SPOTIFY WEB API SEARCH ==========");
console.log("GET", searchUrl);

const searchRes = await fetch(searchUrl, {
  headers: { Authorization: `Bearer ${token}` },
});
const searchJson = await searchRes.json();

const items = searchJson.tracks?.items ?? [];
const blinding =
  items.find(
    (t) =>
      /blinding lights/i.test(t?.name ?? "") &&
      t?.artists?.some((a) => /weeknd/i.test(a?.name ?? "")),
  ) ?? items[0];

if (!blinding) {
  console.log("No track found");
  process.exit(1);
}

console.log("\n========== 2. COMPLETE TRACK OBJECT (first Weeknd match) ==========");
console.log(JSON.stringify(blinding, null, 2));

console.log("\n========== 3. track.album ==========");
console.log(JSON.stringify(blinding.album ?? null, null, 2));

console.log("\n========== 4. track.album.images ==========");
console.log(JSON.stringify(blinding.album?.images ?? null, null, 2));

console.log("\n========== 5. track.images (track-level — usually absent) ==========");
console.log(JSON.stringify(blinding.images ?? null, null, 2));

console.log("\n========== 6. MAPPER (pickSpotifyAlbumArtUrl on track.album.images) ==========");
const albumArtFromMapper = pickSpotifyAlbumArtUrl(blinding.album?.images ?? null);
console.log("Source field: track.album.images (NOT track.images, NOT discovery-sections)");
console.log("Assigned albumArt:", albumArtFromMapper);

console.log("\n========== 7. DIRECT URL HTTP GET ==========");
if (albumArtFromMapper) {
  console.log("URL:", albumArtFromMapper);
  console.log("HTTP:", await httpGet(albumArtFromMapper));
} else {
  console.log("(no URL to test — mapper returned null)");
}

console.log("\n========== 8. LOCAL /api/spotify/search (same as app) ==========");
try {
  const localRes = await fetch(
    "http://localhost:3000/api/spotify/search?q=" +
      encodeURIComponent(query),
  );
  const localJson = await localRes.json();
  const localTrack =
    localJson.tracks?.find((t) => /blinding lights/i.test(t.title)) ??
    localJson.tracks?.[0];
  console.log("status:", localRes.status);
  console.log("mapped track from app API:", JSON.stringify(localTrack, null, 2));
  if (localTrack?.albumArt) {
    console.log("HTTP GET on app albumArt:", await httpGet(localTrack.albumArt));
  }
} catch (e) {
  console.log("local API unavailable:", e.message);
}

console.log("\n========== 9. discovery-sections.ts FALLBACK (empty room) ==========");
console.log(
  JSON.stringify(
    {
      id: "fallback-2",
      title: "Blinding Lights",
      artist: "The Weeknd",
      albumArt: "",
      spotifyUrl: "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b",
      spotifyTrackId: "0VjIjW4GlUZAMYd2vXMi3b",
      note: "Hardcoded in discovery-sections.ts — albumArt is empty string, NOT from Spotify API",
    },
    null,
    2,
  ),
);

console.log("\n========== 10. ALL SEARCH RESULTS albumArt ==========");
for (const t of items) {
  const art = pickSpotifyAlbumArtUrl(t.album?.images ?? null);
  console.log(`- ${t.name} | ${t.artists?.map((a) => a.name).join(", ")}`);
  console.log(`  albumArt: ${art}`);
  if (art) {
    const head = await httpGet(art);
    console.log(`  HTTP: status=${head.status} type=${head.contentType} bytes=${head.bytes}`);
  }
}
