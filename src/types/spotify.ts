/** Normalized track returned from `/api/spotify/search`. */
export type SpotifyTrackResult = {
  id: string;
  title: string;
  artist: string;
  albumArt: string | null;
  durationMs: number;
  spotifyUrl: string;
};
