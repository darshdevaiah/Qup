/**
 * Evidence script — run: node scripts/verify-spotify-artwork.mjs
 * Does NOT print credentials.
 */
import { readFileSync } from "node:fs";

function env(name) {
  const match = readFileSync(".env.local", "utf8").match(
    new RegExp(`^${name}=(.+)$`, "m"),
  );
  return match?.[1]?.trim() ?? "";
}

function pickAlbumArtUrl(images) {
  if (!images?.length) return null;
  const candidates = images.filter((img) => img?.url?.trim());
  candidates.sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return candidates[0]?.url ?? null;
}

async function head(url, label) {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
  });
  const buf = await res.arrayBuffer();
  console.log(`${label}: status=${res.status} type=${res.headers.get("content-type")} bytes=${buf.byteLength}`);
}

const clientId = env("SPOTIFY_CLIENT_ID");
const clientSecret = env("SPOTIFY_CLIENT_SECRET");
if (!clientId || !clientSecret) {
  console.error("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .env.local");
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
const tokenJson = await tokenRes.json();
if (!tokenJson.access_token) {
  console.error("Token failed:", tokenJson);
  process.exit(1);
}

const searchRes = await fetch(
  "https://api.spotify.com/v1/search?q=SICKO%20MODE%20Travis%20Scott&type=track&limit=3&market=US",
  { headers: { Authorization: `Bearer ${tokenJson.access_token}` } },
);
const searchJson = await searchRes.json();
const items = searchJson.tracks?.items ?? [];

console.log("\n=== Spotify search API (SICKO MODE) ===");
for (const item of items) {
  const mapped = pickAlbumArtUrl(item.album?.images);
  console.log("\nTrack:", item.name, "|", item.artists?.[0]?.name);
  console.log("Raw images:", JSON.stringify(item.album?.images ?? [], null, 2));
  console.log("Mapped albumArt:", mapped ?? "(null)");
  if (mapped) await head(mapped, "GET mapped URL");
}

const stale =
  "https://i.scdn.co/image/ab67616d0000b273006940f445b2cbaa10c457f0";
console.log("\n=== Previously hardcoded discovery URL ===");
console.log("URL:", stale);
await head(stale, "GET stale URL");
