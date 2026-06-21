"use client";

import { useEffect, useRef, useState } from "react";

import {
  computePlaybackState,
  nowPlayingFingerprint,
  playbackSessionKey,
  resolveServerStartedAt,
  smoothProgress,
  spotifyDurationMs,
} from "@/lib/live-playback";
import type { NowPlayingSong } from "@/types/firestore";

export type LivePlaybackState = {
  elapsedMs: number;
  durationMs: number | null;
  progress: number;
  hasDuration: boolean;
  isComplete: boolean;
  startedAt: number;
};

const EMPTY: LivePlaybackState = {
  elapsedMs: 0,
  durationMs: null,
  progress: 0,
  hasDuration: false,
  isComplete: false,
  startedAt: 0,
};

/**
 * Authoritative live progress: Date.now() - startedAt over Spotify durationMs.
 * rAF-derived math only — no interval drift.
 */
export function useLivePlayback(song: NowPlayingSong | null): LivePlaybackState {
  const [playback, setPlayback] = useState<LivePlaybackState>(EMPTY);

  const trackFingerprintRef = useRef("");
  const sessionKeyRef = useRef("");
  const startedAtRef = useRef(0);
  const durationMsRef = useRef<number | null>(null);
  const displayProgressRef = useRef(0);
  const adoptedServerStartRef = useRef(false);

  useEffect(() => {
    if (!song) {
      trackFingerprintRef.current = "";
      sessionKeyRef.current = "";
      displayProgressRef.current = 0;
      adoptedServerStartRef.current = false;
      setPlayback(EMPTY);
      return;
    }

    const fingerprint = nowPlayingFingerprint(song);
    const sessionKey = playbackSessionKey(song);
    const serverStartedAt = resolveServerStartedAt(song);
    const durationMs = spotifyDurationMs(song.durationMs);

    const trackChanged = fingerprint !== trackFingerprintRef.current;
    const sessionChanged = sessionKey !== sessionKeyRef.current;

    if (trackChanged || sessionChanged) {
      trackFingerprintRef.current = fingerprint;
      sessionKeyRef.current = sessionKey;
      adoptedServerStartRef.current = Boolean(serverStartedAt);
      startedAtRef.current = serverStartedAt ?? Date.now();
      durationMsRef.current = durationMs;
      displayProgressRef.current = 0;

      setPlayback({
        elapsedMs: 0,
        durationMs,
        progress: 0,
        hasDuration: durationMs !== null,
        isComplete: false,
        startedAt: startedAtRef.current,
      });
    } else {
      if (serverStartedAt && !adoptedServerStartRef.current) {
        startedAtRef.current = serverStartedAt;
        adoptedServerStartRef.current = true;
      }

      if (durationMs !== durationMsRef.current) {
        durationMsRef.current = durationMs;
      }
    }

    let frameId = 0;

    const tick = () => {
      const now = Date.now();
      const { elapsedMs, progress: targetProgress, isComplete, hasDuration } =
        computePlaybackState(
          startedAtRef.current,
          durationMsRef.current,
          now,
        );

      const progress = hasDuration
        ? smoothProgress(displayProgressRef.current, targetProgress, 0.14)
        : 0;

      displayProgressRef.current = progress;

      setPlayback({
        elapsedMs,
        durationMs: durationMsRef.current,
        progress,
        hasDuration,
        isComplete,
        startedAt: startedAtRef.current,
      });

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;

      const now = Date.now();
      const state = computePlaybackState(
        startedAtRef.current,
        durationMsRef.current,
        now,
      );

      if (state.hasDuration) {
        displayProgressRef.current = state.progress;
      }

      setPlayback((prev) => ({
        ...prev,
        elapsedMs: state.elapsedMs,
        progress: state.hasDuration ? state.progress : prev.progress,
        isComplete: state.isComplete,
      }));
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [song]);

  return playback;
}
