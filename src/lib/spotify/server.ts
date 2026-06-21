import type { SpotifyTrackResult } from "@/types/spotify";

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  error?: string;
  error_description?: string;
};

type SpotifyApiError = {
  error?: {
    status?: number;
    message?: string;
  };
};

type SpotifySearchResponse = {
  tracks?: {
    items?: Array<{
      id: string;
      name: string;
      duration_ms: number;
      external_urls?: { spotify?: string };
      album?: {
        images?: Array<{ url: string; width: number; height: number }>;
      };
      artists?: Array<{ name: string }>;
    } | null>;
  };
};

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

/** Spotify search allows max 10 results per type. */
const SEARCH_LIMIT = 10;

let tokenCache: TokenCache | null = null;

function getSpotifyCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Spotify credentials missing. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local",
    );
  }

  return { clientId, clientSecret };
}

function encodeBasicAuth(clientId: string, clientSecret: string): string {
  const raw = `${clientId}:${clientSecret}`;
  if (typeof Buffer !== "undefined") {
    return Buffer.from(raw, "utf-8").toString("base64");
  }
  return globalThis.btoa(raw);
}

async function readSpotifyError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      const error = record.error;

      if (error && typeof error === "object" && "message" in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === "string") {
          return message;
        }
      }

      if (typeof record.error_description === "string") {
        return record.error_description;
      }

      if (typeof error === "string") {
        return error;
      }
    }
  } catch {
    // Response body was not JSON — fall through to status text.
  }

  return response.statusText || `HTTP ${response.status}`;
}

/** Client Credentials flow — app-only token, cached until expiry. */
export async function getSpotifyAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  const { clientId, clientSecret } = getSpotifyCredentials();
  const credentials = encodeBasicAuth(clientId, clientSecret);

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await readSpotifyError(response);
    console.error("[Spotify] Token request failed:", {
      status: response.status,
      message,
    });
    throw new Error(`Spotify token request failed: ${message}`);
  }

  const data = (await response.json()) as SpotifyTokenResponse;

  if (!data.access_token) {
    console.error("[Spotify] Token response missing access_token:", data);
    throw new Error("Spotify token response did not include an access token.");
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return tokenCache.accessToken;
}

type SpotifySearchTrack = NonNullable<
  NonNullable<SpotifySearchResponse["tracks"]>["items"]
>[number];

export function mapSpotifyTrack(
  item: NonNullable<SpotifySearchTrack>,
): SpotifyTrackResult {
  const albumArt =
    item.album?.images?.find((img) => img.width >= 64)?.url ??
    item.album?.images?.[0]?.url ??
    null;

  return {
    id: item.id,
    title: item.name,
    artist: item.artists?.map((a) => a.name).join(", ") ?? "Unknown artist",
    albumArt,
    durationMs: item.duration_ms,
    spotifyUrl:
      item.external_urls?.spotify ??
      `https://open.spotify.com/track/${item.id}`,
  };
}

export async function searchSpotifyTracks(
  query: string,
): Promise<SpotifyTrackResult[]> {
  const token = await getSpotifyAccessToken();
  const params = new URLSearchParams({
    q: query.trim(),
    type: "track",
    limit: String(SEARCH_LIMIT),
  });

  const url = `https://api.spotify.com/v1/search?${params.toString()}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await readSpotifyError(response);
    console.error("[Spotify] Search request failed:", {
      status: response.status,
      message,
      query,
      url,
    });
    throw new Error(`Spotify search failed: ${message}`);
  }

  const data = (await response.json()) as SpotifySearchResponse;
  const items = data.tracks?.items ?? [];

  return items
    .filter(
      (item): item is NonNullable<typeof item> =>
        Boolean(item?.id && item?.name),
    )
    .map(mapSpotifyTrack);
}
