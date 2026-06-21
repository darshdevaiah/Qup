import { NextResponse } from "next/server";

import { searchSpotifyTracks } from "@/lib/spotify/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ tracks: [] });
  }

  const hasClientId = Boolean(process.env.SPOTIFY_CLIENT_ID?.trim());
  const hasClientSecret = Boolean(process.env.SPOTIFY_CLIENT_SECRET?.trim());

  if (!hasClientId || !hasClientSecret) {
    const message =
      "Spotify credentials missing. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local";
    console.error("[Spotify] Search route:", message);
    return NextResponse.json({ error: message, tracks: [] }, { status: 500 });
  }

  try {
    const tracks = await searchSpotifyTracks(query);
    return NextResponse.json({ tracks });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Spotify search failed";

    console.error("[Spotify] Search route error:", {
      query,
      message,
      error,
    });

    return NextResponse.json({ error: message, tracks: [] }, { status: 500 });
  }
}
