import { extractSpotifyTrackId } from "@/lib/rooms";
import type { NowPlayingSong, QueuedSong } from "@/types/firestore";

export type DiscoveryTrack = {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  spotifyUrl: string;
  spotifyTrackId?: string;
};

export type DiscoverySection = {
  id: string;
  title: string;
  subtitle?: string;
  tracks: DiscoveryTrack[];
};

const FALLBACK_TRACKS: DiscoveryTrack[] = [
  {
    id: "fallback-1",
    title: "SICKO MODE",
    artist: "Travis Scott",
    albumArt: "",
    spotifyUrl: "https://open.spotify.com/track/2xLMifQCjGrVQ5JAQYXcfm",
    spotifyTrackId: "2xLMifQCjGrVQ5JAQYXcfm",
  },
  {
    id: "fallback-2",
    title: "Blinding Lights",
    artist: "The Weeknd",
    albumArt: "",
    spotifyUrl: "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b",
    spotifyTrackId: "0VjIjW4GlUZAMYd2vXMi3b",
  },
  {
    id: "fallback-3",
    title: "Levitating",
    artist: "Dua Lipa",
    albumArt: "",
    spotifyUrl: "https://open.spotify.com/track/463CkQjx2Zk1yXoBuierJ9",
    spotifyTrackId: "463CkQjx2Zk1yXoBuierJ9",
  },
  {
    id: "fallback-4",
    title: "As It Was",
    artist: "Harry Styles",
    albumArt: "",
    spotifyUrl: "https://open.spotify.com/track/4LRPiHGyFHib96NpAt6ot9",
    spotifyTrackId: "4LRPiHGyFHib96NpAt6ot9",
  },
  {
    id: "fallback-5",
    title: "Save Your Tears",
    artist: "The Weeknd",
    albumArt: "",
    spotifyUrl: "https://open.spotify.com/track/5QO79kh1waicV47BqGRLbI",
    spotifyTrackId: "5QO79kh1waicV47BqGRLbI",
  },
  {
    id: "fallback-6",
    title: "Good 4 U",
    artist: "Olivia Rodrigo",
    albumArt: "",
    spotifyUrl: "https://open.spotify.com/track/4ZtFanR9U6nd4OkOeE1nOR",
    spotifyTrackId: "4ZtFanR9U6nd4OkOeE1nOR",
  },
];

function toDiscoveryTrack(
  song: QueuedSong | NowPlayingSong,
  id?: string,
): DiscoveryTrack {
  const spotifyUrl = song.spotifyUrl || "";
  return {
    id: id ?? ("id" in song ? song.id : `now-${song.title}`),
    title: song.title,
    artist: song.artist,
    albumArt: song.albumArt || "",
    spotifyUrl,
    spotifyTrackId: extractSpotifyTrackId(spotifyUrl) ?? undefined,
  };
}

function uniqueTracks(tracks: DiscoveryTrack[]): DiscoveryTrack[] {
  const seen = new Set<string>();
  const result: DiscoveryTrack[] = [];

  for (const track of tracks) {
    const key = track.spotifyTrackId || `${track.title}::${track.artist}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(track);
  }

  return result;
}

function topArtist(tracks: DiscoveryTrack[]): string | null {
  const counts = new Map<string, number>();
  for (const track of tracks) {
    counts.set(track.artist, (counts.get(track.artist) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [artist, count] of counts) {
    if (count > bestCount) {
      best = artist;
      bestCount = count;
    }
  }
  return best;
}

function trendingScore(song: QueuedSong): number {
  const ageHours = (Date.now() - song.addedAt) / (1000 * 60 * 60);
  const recencyBoost = Math.max(0, 48 - ageHours) / 48;
  return song.voteCount * 3 + recencyBoost * 2;
}

function getFallbackSections(): DiscoverySection[] {
  return [
    {
      id: "tonights-vibe",
      title: "Tonight's vibe",
      subtitle: "Start the room with a crowd-pleaser",
      tracks: FALLBACK_TRACKS.slice(0, 4),
    },
    {
      id: "late-night",
      title: "Late night picks",
      subtitle: "Smooth energy for after hours",
      tracks: FALLBACK_TRACKS.slice(2, 6),
    },
    {
      id: "crowd-favorites",
      title: "Crowd favorites",
      subtitle: "Tracks that always hit",
      tracks: [...FALLBACK_TRACKS].reverse().slice(0, 5),
    },
  ];
}

/**
 * Builds personalized discovery rows from room queue + now playing.
 * Uses mock fallbacks when the room is empty.
 */
export function buildDiscoverySections(
  queue: QueuedSong[],
  currentSong: NowPlayingSong | null,
): DiscoverySection[] {
  const pool = uniqueTracks([
    ...(currentSong ? [toDiscoveryTrack(currentSong, "current")] : []),
    ...queue.map((song) => toDiscoveryTrack(song)),
  ]);

  if (pool.length === 0) {
    return getFallbackSections();
  }

  const sections: DiscoverySection[] = [];
  const featuredArtist = topArtist(pool) ?? currentSong?.artist;

  const recentlyAdded = uniqueTracks(
    [...queue]
      .sort((a, b) => b.addedAt - a.addedAt)
      .map((song) => toDiscoveryTrack(song)),
  ).slice(0, 10);

  if (recentlyAdded.length > 0) {
    sections.push({
      id: "recently-added",
      title: "Recently added",
      subtitle: "Fresh from this room",
      tracks: recentlyAdded,
    });
  }

  const crowdFavorites = uniqueTracks(
    [...queue]
      .sort((a, b) => b.voteCount - a.voteCount)
      .map((song) => toDiscoveryTrack(song)),
  ).slice(0, 10);

  if (crowdFavorites.length > 0) {
    sections.push({
      id: "crowd-favorites",
      title: "Crowd favorites",
      subtitle: "Most upvoted in the queue",
      tracks: crowdFavorites,
    });
  }

  const trending = uniqueTracks(
    [...queue]
      .sort((a, b) => trendingScore(b) - trendingScore(a))
      .map((song) => toDiscoveryTrack(song)),
  ).slice(0, 8);

  if (trending.length > 0) {
    sections.push({
      id: "trending-room",
      title: "Trending in this room",
      subtitle: "Hot right now",
      tracks: trending,
    });
  }

  if (featuredArtist) {
    const becauseYouAdded = pool
      .filter((track) => track.artist === featuredArtist)
      .slice(0, 8);

    if (becauseYouAdded.length > 0) {
      sections.push({
        id: "because-you-added",
        title: `Because you added ${featuredArtist}`,
        subtitle: "More from this artist",
        tracks: becauseYouAdded,
      });
    }
  }

  sections.push({
    id: "tonights-vibe",
    title: "Tonight's vibe",
    subtitle: "The mood of this room",
    tracks: [...pool].slice(0, 8),
  });

  const lateNight = uniqueTracks(
    [...queue]
      .sort((a, b) => a.voteCount - b.voteCount || b.addedAt - a.addedAt)
      .map((song) => toDiscoveryTrack(song)),
  ).slice(0, 8);

  if (lateNight.length > 0) {
    sections.push({
      id: "late-night",
      title: "Late night picks",
      subtitle: "Hidden gems & deep cuts",
      tracks: lateNight,
    });
  }

  return sections.filter((section) => section.tracks.length > 0).slice(0, 6);
}
