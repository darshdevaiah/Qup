"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AddSongDiscovery } from "@/components/room/add-song-discovery";
import { AlbumArt } from "@/components/room/album-art";
import { CloseIcon, PlusIcon, SearchIcon } from "@/components/room/icons";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSound } from "@/hooks/use-sound";
import type { DiscoveryTrack } from "@/lib/discovery-sections";
import { formatDuration } from "@/lib/format-duration";
import type { AmbientPalette } from "@/lib/ambient-palette";
import {
  DEFAULT_PALETTE,
  modalCssVars,
  modalEdgeGlow,
  modalLabelColor,
  modalSearchFocusShadow,
  warmWhite,
} from "@/lib/ambient-palette";
import { fadeSmooth, springPremium } from "@/lib/motion";
import { addSongToQueue, extractSpotifyTrackId, QueueLockedError } from "@/lib/rooms";
import { logAlbumArtStage } from "@/lib/spotify/album-art";
import { useToast } from "@/components/ui/toast";
import type { NowPlayingSong, QueuedSong } from "@/types/firestore";
import type { SpotifyTrackResult } from "@/types/spotify";

type AddSongModalProps = {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
  queue: QueuedSong[];
  currentSong: NowPlayingSong | null;
  displayName: string;
  queueLocked?: boolean;
  ambient?: AmbientPalette;
};

type AddableTrack = DiscoveryTrack | SpotifyTrackResult;

function trackKey(track: AddableTrack): string {
  return track.id;
}

function toAddInput(track: AddableTrack, addedBy: string) {
  const spotifyUrl = track.spotifyUrl ?? "";
  const spotifyTrackId =
    "spotifyTrackId" in track && track.spotifyTrackId
      ? track.spotifyTrackId
      : extractSpotifyTrackId(spotifyUrl) ?? track.id;

  const input = {
    title: track.title,
    artist: track.artist,
    albumArt: track.albumArt ?? "",
    spotifyUrl,
    spotifyTrackId,
    addedBy,
    ...("durationMs" in track && typeof track.durationMs === "number"
      ? { durationMs: track.durationMs }
      : {}),
  };

  logAlbumArtStage("client.addSong", input.title, input.albumArt);

  return input;
}

export function AddSongModal({
  roomId,
  isOpen,
  onClose,
  queue,
  currentSong,
  displayName,
  queueLocked = false,
  ambient = DEFAULT_PALETTE,
}: AddSongModalProps) {
  const { showToast } = useToast();
  const { play } = useSound();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 350);
  const [tracks, setTracks] = useState<SpotifyTrackResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const isAdding = addingTrackId !== null;
  const showDiscovery = debouncedQuery.trim().length < 2;

  const resetModal = useCallback(() => {
    setQuery("");
    setTracks([]);
    setSearchError(null);
    setAddError(null);
    setAddingTrackId(null);
    setIsFocused(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetModal();
    }
  }, [isOpen, resetModal]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isAdding) {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isAdding, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const trimmed = debouncedQuery.trim();

    if (trimmed.length < 2) {
      setTracks([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();

    async function runSearch() {
      setIsSearching(true);
      setSearchError(null);

      try {
        const response = await fetch(
          `/api/spotify/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );

        const data = (await response.json()) as {
          tracks?: SpotifyTrackResult[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Search failed");
        }

        setTracks(data.tracks ?? []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setTracks([]);
        setSearchError(
          error instanceof Error ? error.message : "Search failed. Try again.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }

    runSearch();
    return () => controller.abort();
  }, [debouncedQuery, isOpen]);

  async function handleAddTrack(track: AddableTrack) {
    if (queueLocked) {
      setAddError("The DJ has locked the queue.");
      return;
    }

    setAddError(null);
    setAddingTrackId(trackKey(track));

    try {
      const result = await addSongToQueue(
        roomId,
        toAddInput(track, displayName),
      );

      if (result.action === "boosted") {
        showToast("This song is already in the mix 🎵", "duplicate");
      } else {
        play("song-placed", { intensity: 0.72 });
        showToast("Added to the queue 🚀", "success");
      }

      resetModal();
      onClose();
    } catch (error) {
      const message =
        error instanceof QueueLockedError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to add song. Try again.";
      setAddError(message);
    } finally {
      setAddingTrackId(null);
    }
  }

  const placeholder = useMemo(() => {
    if (isFocused) return "Search millions of tracks…";
    return "Search songs, artists, albums…";
  }, [isFocused]);

  const showEmpty =
    debouncedQuery.trim().length >= 2 && !isSearching && tracks.length === 0;

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-song-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isAdding && onClose()}
            disabled={isAdding}
          />

          <motion.div
            className="relative flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-950/80 shadow-2xl shadow-black/60 backdrop-blur-2xl transition-[border-color,box-shadow] duration-700 ease-out sm:max-h-[min(88vh,720px)] sm:rounded-3xl"
            style={{
              ...modalCssVars(ambient),
              borderColor: ambient.borderSubtle,
              boxShadow: `0 24px 48px rgba(0, 0, 0, 0.55), 0 0 20px rgba(${ambient.glowRgb}, 0.04)`,
            }}
            initial={{ opacity: 0, y: 48, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.98 }}
            transition={springPremium}
          >
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-80 transition-opacity duration-700"
              style={{ background: modalEdgeGlow(ambient) }}
            />

            <div className="relative shrink-0 border-b border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors duration-700"
                    style={{ color: modalLabelColor(ambient) }}
                  >
                    Discover
                  </p>
                  <h2
                    id="add-song-title"
                    className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl"
                  >
                    Add to the queue
                  </h2>
                  <p className="mt-1.5 text-sm text-zinc-400">
                    Pick a vibe or search Spotify
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isAdding}
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                  aria-label="Close dialog"
                >
                  <CloseIcon />
                </button>
              </div>

              <motion.div
                animate={{
                  boxShadow: modalSearchFocusShadow(ambient, isFocused),
                }}
                transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70 backdrop-blur-xl transition-[border-color] duration-700"
                style={{
                  borderColor: isFocused
                    ? ambient.border
                    : warmWhite(0.1),
                }}
              >
                <motion.div
                  animate={{
                    scale: isFocused ? 1.06 : 1,
                    opacity: isFocused ? 1 : 0.5,
                  }}
                  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-700"
                  style={{
                    color: isFocused
                      ? ambient.accentStrong
                      : warmWhite(0.45),
                  }}
                >
                  <SearchIcon className="h-4 w-4" />
                </motion.div>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder={placeholder}
                  disabled={isAdding}
                  className="min-h-13 w-full touch-manipulation bg-transparent py-3.5 pl-11 pr-4 text-base text-white placeholder:text-zinc-500 placeholder:transition-opacity outline-none disabled:opacity-50 sm:text-sm"
                  autoFocus
                />
              </motion.div>

              {addError ? (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 rounded-xl border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300"
                >
                  {addError}
                </motion.p>
              ) : null}
            </div>

            <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 scroll-smooth sm:px-5 sm:py-5">
              <AnimatePresence mode="wait" initial={false}>
                {showDiscovery && !isSearching ? (
                  <motion.div
                    key="discovery"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={fadeSmooth}
                  >
                    <AddSongDiscovery
                      queue={queue}
                      currentSong={currentSong}
                      onAdd={handleAddTrack}
                      addingTrackId={addingTrackId}
                      disabled={isAdding}
                      ambient={ambient}
                    />
                  </motion.div>
                ) : null}

                {isSearching ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="flex animate-pulse items-center gap-3 rounded-2xl border border-white/5 bg-zinc-900/50 p-3"
                      >
                        <div className="h-16 w-16 shrink-0 rounded-xl bg-zinc-800" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-3/4 rounded bg-zinc-800" />
                          <div className="h-2.5 w-1/2 rounded bg-zinc-800" />
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ) : null}

                {searchError && !isSearching && !showDiscovery ? (
                  <motion.p
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="px-2 py-12 text-center text-sm text-red-400"
                  >
                    {searchError}
                  </motion.p>
                ) : null}

                {showEmpty && !searchError && !showDiscovery ? (
                  <motion.p
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="px-2 py-12 text-center text-sm text-zinc-500"
                  >
                    No tracks found for &ldquo;{debouncedQuery}&rdquo;
                  </motion.p>
                ) : null}

                {!isSearching && !showDiscovery && tracks.length > 0 ? (
                  <motion.ul
                    key="results"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={fadeSmooth}
                    className="space-y-2"
                  >
                    <li className="px-1 pb-1">
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                        Search results
                      </p>
                    </li>
                    {tracks.map((track) => {
                      const isAddingThis = addingTrackId === track.id;

                      return (
                        <li key={track.id}>
                          <motion.button
                            type="button"
                            layout
                            onClick={() => handleAddTrack(track)}
                            disabled={isAdding}
                            whileHover={{ y: -2 }}
                            whileTap={isAdding ? undefined : { scale: 0.99 }}
                            transition={springPremium}
                            className="group flex min-h-[4.5rem] w-full touch-manipulation items-center gap-3.5 rounded-2xl border border-white/5 bg-zinc-900/55 p-3 text-left transition-[border-color,background-color,box-shadow] duration-700 ease-out hover:border-[color:var(--modal-border-hover)] hover:bg-zinc-900/88 hover:shadow-[var(--modal-shadow-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10">
                              <AlbumArt
                                src={track.albumArt ?? undefined}
                                alt={`${track.title} cover`}
                                titleForLog={track.title}
                                size="xl"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-white">
                                {track.title}
                              </p>
                              <p className="truncate text-xs text-zinc-500">
                                {track.artist}
                              </p>
                              <p className="mt-1 text-[11px] tabular-nums text-zinc-600">
                                {formatDuration(track.durationMs)}
                              </p>
                            </div>
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-[border-color,background-color] duration-700 ease-out group-hover:border-[color:var(--modal-add-border-hover)] group-hover:bg-[color:var(--modal-add-bg-hover)]">
                              {isAddingThis ? (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                              ) : (
                                <PlusIcon className="h-4 w-4" />
                              )}
                            </span>
                          </motion.button>
                        </li>
                      );
                    })}
                  </motion.ul>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
