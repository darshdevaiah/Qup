"use client";

import { getDoc, onSnapshot } from "firebase/firestore";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AmbientAlbumBackground } from "@/components/room/ambient-album-background";
import { AddSongModal } from "@/components/room/add-song-modal";
import {
  CrowdModeAtmosphere,
  HostControls,
} from "@/components/room/host-controls";
import { JoinIdentityModal } from "@/components/room/join-identity-modal";
import { NowPlayingCard } from "@/components/room/now-playing-card";
import { NowPlayingOverlay } from "@/components/room/now-playing-overlay";
import { QueueList } from "@/components/room/queue-list";
import { RoomActionPill } from "@/components/room/room-action-pill";
import { ShareRoom } from "@/components/room/share-room";
import { useAmbientPalette } from "@/hooks/use-ambient-palette";
import { useDisplayName } from "@/hooks/use-display-name";
import { useSound } from "@/hooks/use-sound";
import { auditFirebaseEnv, traceFirebaseStartup } from "@/lib/firebase-startup";
import { getEffectiveHostSettings } from "@/lib/host-permissions";
import { nowPlayingFingerprint } from "@/lib/live-playback";
import {
  describeStartupBlocker,
  INITIAL_ROOM_LOAD_DEBUG,
  type RoomLoadDebug,
  runSafariCompatChecks,
} from "@/lib/room-load-debug";
import { isWalletExtensionError } from "@/lib/third-party-errors";
import { getVoterId } from "@/lib/voter-session";
import {
  cleanupRoomQueueDuplicates,
  deduplicateQueue,
  getRoomRef,
  parseRoomData,
  queueHasDuplicates,
  roomPlaybackNeedsSync,
  syncRoomPlaybackState,
} from "@/lib/rooms";
import type { Room } from "@/types/firestore";
import type { AmbientPalette } from "@/lib/ambient-palette";

type RoomViewProps = {
  roomId: string;
};

type ViewState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "error"; message: string }
  | { status: "ready"; room: Room };

const FIRESTORE_LOAD_TIMEOUT_MS = 12_000;

export function RoomView({ roomId }: RoomViewProps) {
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [debug, setDebug] = useState<RoomLoadDebug>(INITIAL_ROOM_LOAD_DEBUG);
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [skipShimmer, setSkipShimmer] = useState(false);
  const [voterId, setVoterId] = useState("");
  const cleanupInFlightRef = useRef(false);
  const playbackSyncInFlightRef = useRef(false);

  const patchDebug = (patch: Partial<RoomLoadDebug>) => {
    setDebug((prev) => {
      const next = { ...prev, ...patch };
      return {
        ...next,
        startupBlocker: describeStartupBlocker(next),
      };
    });
  };

  const albumArt =
    state.status === "ready" ? state.room.currentSong?.albumArt : undefined;
  const currentSong =
    state.status === "ready" ? state.room.currentSong : null;
  const ambient = useAmbientPalette(albumArt);
  const { displayName, isReady, showJoinModal, confirmName, openJoinModal } =
    useDisplayName();
  const { play } = useSound();
  const prevOverlayOpenRef = useRef(false);
  const prevSongFingerprintRef = useRef("");

  useEffect(() => {
    patchDebug({
      clientRuntime:
        typeof window === "undefined"
          ? "ssr"
          : `browser (${window.location.origin})`,
      clientHydrated: "yes",
      lastEvent: "client-mounted",
    });
  }, []);

  useEffect(() => {
    patchDebug({ safariChecks: runSafariCompatChecks() });

    function handleWindowError(event: ErrorEvent) {
      const message = event.message || "Unknown runtime error";
      if (isWalletExtensionError(message)) {
        console.warn(
          "[Qup Room] ignored browser wallet extension error (not from Qup)",
          message,
        );
        return;
      }
      console.error("[Qup Room] window error", event.error ?? message);
      patchDebug({
        error: message,
        lastEvent: "window.error",
      });
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const reason =
        event.reason instanceof Error
          ? event.reason.message
          : String(event.reason);
      if (isWalletExtensionError(reason)) {
        console.warn(
          "[Qup Room] ignored browser wallet extension rejection (not from Qup)",
          reason,
        );
        return;
      }
      console.error("[Qup Room] unhandled rejection", event.reason);
      patchDebug({
        error: reason,
        lastEvent: "unhandledrejection",
      });
    }

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    const id = getVoterId();
    setVoterId(id);
    console.log("[Qup Room] voter session", { roomId, voterId: id || "(empty)" });
  }, [roomId]);

  useEffect(() => {
    console.log("[Qup Room] subscribe start", { roomId });

    const envAudit = auditFirebaseEnv();
    patchDebug({
      loadingState: "loading",
      firestoreConnected: "connecting",
      snapshotReceived: "no",
      roomParseSuccess: "no",
      identityGate: "waiting for room",
      error: "none",
      firebaseEnv: envAudit.summary,
      firebaseEnvMissing:
        envAudit.missing.length > 0 ? envAudit.missing.join(", ") : "none",
      lastEvent: "subscribe-start",
    });
    setState({ status: "loading" });

    if (!envAudit.ok) {
      const message = `Missing Firebase env: ${envAudit.missing.join(", ")}`;
      console.error("[Qup Room] Firebase config missing", envAudit.missing);
      patchDebug({
        loadingState: "error",
        firestoreConnected: "no",
        error: message,
        lastEvent: "firebase-config-missing",
      });
      setState({
        status: "error",
        message:
          "Firebase is not configured on this device. Redeploy or restart the dev server with NEXT_PUBLIC_FIREBASE_* variables.",
      });
      return;
    }

    let unsubscribe = () => {};
    let initialLoadComplete = false;
    let loadTimedOut = false;

    const timeoutId = window.setTimeout(() => {
      if (initialLoadComplete || loadTimedOut) return;
      loadTimedOut = true;
      console.error("[Qup Room] Firestore timeout", { roomId });
      patchDebug({
        loadingState: "error",
        error: "Firestore timeout after 12s",
        lastEvent: "timeout",
      });
      setState({
        status: "error",
        message:
          "Could not connect to the room. Check your network connection and try again.",
      });
    }, FIRESTORE_LOAD_TIMEOUT_MS);

    function applyRoomFromFirestore(
      source: "onSnapshot" | "getDoc",
      snapshot: Awaited<ReturnType<typeof getDoc>>,
    ) {
      if (loadTimedOut) return;

      // getDoc is a one-shot bootstrap; live updates come from onSnapshot only.
      if (source === "getDoc" && initialLoadComplete) {
        return;
      }

      console.log("[Qup Room] snapshot event", {
        roomId,
        source,
        exists: snapshot.exists(),
        fromCache: snapshot.metadata.fromCache,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
      });

      if (!snapshot.exists()) {
        if (
          source === "onSnapshot" &&
          snapshot.metadata.fromCache &&
          !initialLoadComplete
        ) {
          console.log("[Qup Room] waiting for server snapshot (local cache miss)");
          patchDebug({
            snapshotReceived: "pending (cache miss)",
            lastEvent: "waiting-server",
          });
          return;
        }

        initialLoadComplete = true;
        window.clearTimeout(timeoutId);
        patchDebug({ loadingState: "not_found", lastEvent: "not-found" });
        setState({ status: "not_found" });
        return;
      }

      try {
        const parsed = parseRoomData(
          snapshot.data() as Record<string, unknown>,
        );
        const displayQueue = deduplicateQueue(parsed.queue);
        const needsCleanup =
          displayQueue.length < parsed.queue.length ||
          queueHasDuplicates(parsed.queue);
        const roomForDisplay = { ...parsed, queue: displayQueue };
        const needsPlaybackSync = roomPlaybackNeedsSync(roomForDisplay);

        console.log("[Qup Queue] snapshot received");
        console.log("[Qup Queue] queue length", displayQueue.length);

        if (!initialLoadComplete) {
          initialLoadComplete = true;
          window.clearTimeout(timeoutId);
          patchDebug({
            loadingState: "ready",
            roomParseSuccess: "yes",
            lastEvent: "parse-success",
          });
          console.log("[Qup Room] room ready", {
            roomId,
            roomName: roomForDisplay.name,
          });
        }

        patchDebug({
          snapshotReceived: `yes (${source}, cache=${snapshot.metadata.fromCache ? "yes" : "no"})`,
          lastEvent: "snapshot-received",
        });

        // Firestore is the source of truth — every snapshot replaces local room state.
        setState({
          status: "ready",
          room: roomForDisplay,
        });

        if (needsPlaybackSync && !playbackSyncInFlightRef.current) {
          playbackSyncInFlightRef.current = true;
          syncRoomPlaybackState(roomId)
            .catch((error) => {
              console.error("[Qup Room] playback sync failed", error);
            })
            .finally(() => {
              playbackSyncInFlightRef.current = false;
            });
        }

        if (needsCleanup && !cleanupInFlightRef.current) {
          cleanupInFlightRef.current = true;
          cleanupRoomQueueDuplicates(roomId)
            .catch((error) => {
              console.error("[Qup Room] queue cleanup failed", error);
            })
            .finally(() => {
              cleanupInFlightRef.current = false;
            });
        }
      } catch (error) {
        console.error("[Qup Room] room parse failed", { roomId, error, source });
        const message =
          error instanceof Error ? error.message : "Failed to read room data.";
        if (!initialLoadComplete) {
          initialLoadComplete = true;
          window.clearTimeout(timeoutId);
          patchDebug({
            loadingState: "error",
            roomParseSuccess: "no",
            error: message,
            lastEvent: "parse-error",
          });
          setState({ status: "error", message });
        }
      }
    }

    function finishError(source: "onSnapshot" | "getDoc", error: unknown) {
      if (initialLoadComplete) {
        console.error("[Qup Room] Firestore listener error (room still live)", {
          roomId,
          source,
          error,
        });
        return;
      }
      if (loadTimedOut) return;

      loadTimedOut = true;
      window.clearTimeout(timeoutId);

      const message =
        error instanceof Error ? error.message : "Failed to load room.";
      console.error("[Qup Room] Firestore error", { roomId, source, error });
      patchDebug({
        loadingState: "error",
        error: `${source}: ${message}`,
        lastEvent: "snapshot-error",
      });
      setState({ status: "error", message });
    }

    try {
      traceFirebaseStartup((event, detail) => {
        console.log("[Qup Room] firebase startup", { event, detail });
        patchDebug({
          lastEvent: event,
          ...(event === "firestore-created"
            ? { firestoreConnected: "yes" }
            : {}),
          ...(event === "firebase-config-missing" && detail
            ? {
                firebaseEnvMissing: detail,
                error: `Missing Firebase env: ${detail}`,
              }
            : {}),
        });
      });

      const roomRef = getRoomRef(roomId);
      console.log("[Qup Room] Firestore listener attach", { roomId });

      unsubscribe = onSnapshot(
        roomRef,
        { includeMetadataChanges: true },
        (snapshot) => {
          console.log("[Qup Room] onSnapshot callback", {
            roomId,
            exists: snapshot.exists(),
            fromCache: snapshot.metadata.fromCache,
            hasPendingWrites: snapshot.metadata.hasPendingWrites,
          });
          applyRoomFromFirestore("onSnapshot", snapshot);
        },
        (error) => {
          finishError("onSnapshot", error);
        },
      );

      void getDoc(roomRef)
        .then((snapshot) => {
          console.log("[Qup Room] getDoc callback", {
            roomId,
            exists: snapshot.exists(),
            fromCache: snapshot.metadata.fromCache,
          });
          applyRoomFromFirestore("getDoc", snapshot);
        })
        .catch((error) => {
          finishError("getDoc", error);
        });
    } catch (error) {
      window.clearTimeout(timeoutId);
      finishError("getDoc", error);
    }

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [roomId]);

  useEffect(() => {
    if (!currentSong) {
      setIsNowPlayingOpen(false);
    }
  }, [currentSong]);

  useEffect(() => {
    if (isNowPlayingOpen && !prevOverlayOpenRef.current) {
      play("overlay-open");
    } else if (!isNowPlayingOpen && prevOverlayOpenRef.current) {
      play("overlay-close");
    }
    prevOverlayOpenRef.current = isNowPlayingOpen;
  }, [isNowPlayingOpen, play]);

  useEffect(() => {
    if (!currentSong) {
      prevSongFingerprintRef.current = "";
      return;
    }

    const fingerprint = nowPlayingFingerprint(currentSong);
    if (
      prevSongFingerprintRef.current &&
      prevSongFingerprintRef.current !== fingerprint
    ) {
      play("song-transition");
    }
    prevSongFingerprintRef.current = fingerprint;
  }, [currentSong, play]);

  useEffect(() => {
    if (state.status !== "ready" || !isReady || displayName) return;
    openJoinModal();
  }, [state.status, isReady, displayName, openJoinModal]);

  useEffect(() => {
    if (state.status !== "ready") return;
    const blocked = !voterId || !displayName;
    patchDebug({
      identityGate: blocked
        ? `blocked (voterId=${voterId ? "yes" : "no"}, name=${displayName ? "yes" : "no"})`
        : "open",
      lastEvent: blocked ? "identity-blocked" : "identity-open",
    });
    console.log("[Qup Room] identity gate", {
      roomId,
      voterId: voterId || "(empty)",
      displayName: displayName || "(empty)",
      showJoinModal,
      isReady,
      queueBlocked: blocked,
    });
  }, [state.status, roomId, voterId, displayName, showJoinModal, isReady]);

  if (state.status === "loading") {
    return <RoomLoading roomId={roomId} debug={debug} />;
  }

  if (state.status === "not_found") {
    return <RoomNotFound roomId={roomId} debug={debug} />;
  }

  if (state.status === "error") {
    return (
      <RoomError roomId={roomId} message={state.message} debug={debug} />
    );
  }

  const { room } = state;
  const hostSettings = getEffectiveHostSettings(room);
  const queueBlocked = !voterId || !displayName;

  return (
    <>
      <AmbientAlbumBackground albumArt={room.currentSong?.albumArt} />
      <CrowdModeAtmosphere active={hostSettings.crowdMode} ambient={ambient} />
      <AnimatePresence>
        {skipShimmer ? (
          <motion.div
            key="skip-shimmer"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            className="pointer-events-none fixed inset-0 z-[75]"
            aria-hidden
            style={{
              background: `radial-gradient(ellipse 70% 50% at 50% 40%, rgba(${ambient.glowRgb}, 0.35), transparent 70%)`,
            }}
          />
        ) : null}
      </AnimatePresence>
      <LayoutGroup id="room-now-playing">
      <main className="relative z-20 min-h-screen text-white">
      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-4 pb-[6.5rem] pt-8 sm:px-5 sm:pb-[7rem] sm:pt-10">
        <header className="mb-8 text-center sm:mb-10">
          <p className="text-[11px] font-medium tracking-[0.28em] text-zinc-500/70">
            Qup
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:mt-4 sm:text-4xl">
            {room.name}
          </h1>
          {queueBlocked ? (
            <p className="mt-3 inline-flex items-center justify-center gap-2 text-xs font-medium text-emerald-400/90">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]"
                aria-hidden
              />
              Live · Room loaded
            </p>
          ) : (
            <p className="mt-3 text-sm font-normal tracking-wide text-zinc-500/90">
              Hosted by the crowd
            </p>
          )}
          <ShareRoom
            roomId={roomId}
            roomName={room.name}
            roomCode={room.code}
            ambient={ambient}
          />
        </header>

        <section className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Now Playing
          </h2>
          <NowPlayingCard
            song={room.currentSong}
            ambient={ambient}
            isExpanded={isNowPlayingOpen}
            onOpen={
              room.currentSong
                ? () => setIsNowPlayingOpen(true)
                : undefined
            }
          />
        </section>

        <section className="flex-1">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Queue
          </h2>
          {queueBlocked ? (
            <JoinRoomCta onJoin={openJoinModal} ambient={ambient} />
          ) : (
            <QueueList
              roomId={roomId}
              queue={room.queue}
              voterId={voterId}
              roomBattle={room.battle}
              pinnedSongId={room.pinnedSongId}
              hostSettings={hostSettings}
              ambient={ambient}
            />
          )}
        </section>

        {displayName ? (
          <RoomActionPill
            queue={room.queue}
            currentSong={room.currentSong}
            displayName={displayName}
            disabled={false}
            queueLocked={hostSettings.queueLocked}
            onPress={() => setIsAddSongOpen(true)}
            ambient={ambient}
          />
        ) : null}

        {isReady ? (
          <JoinIdentityModal
            isOpen={showJoinModal}
            onConfirm={confirmName}
            ambient={ambient}
          />
        ) : null}

        {room.currentSong ? (
          <NowPlayingOverlay
            isOpen={isNowPlayingOpen}
            song={room.currentSong}
            roomName={room.name}
            onClose={() => setIsNowPlayingOpen(false)}
            ambient={ambient}
          />
        ) : null}

        {displayName ? (
          <AddSongModal
            roomId={roomId}
            isOpen={isAddSongOpen}
            onClose={() => setIsAddSongOpen(false)}
            queue={room.queue}
            currentSong={room.currentSong}
            displayName={displayName}
            queueLocked={hostSettings.queueLocked}
            ambient={ambient}
          />
        ) : null}

        {voterId ? (
          <HostControls
            roomId={roomId}
            room={room}
            voterId={voterId}
            ambient={ambient}
            onSkipSuccess={() => {
              play("song-transition", { intensity: 0.85 });
              setSkipShimmer(true);
              window.setTimeout(() => setSkipShimmer(false), 1100);
            }}
          />
        ) : null}
      </div>
    </main>
      </LayoutGroup>
    </>
  );
}

function JoinRoomCta({
  onJoin,
  ambient,
}: {
  onJoin: () => void;
  ambient: AmbientPalette;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col items-center justify-center px-2 py-6 sm:py-10"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-zinc-950/50 px-6 py-8 text-center backdrop-blur-xl"
        style={{
          borderColor: `rgba(${ambient.glowRgb}, 0.14)`,
          boxShadow: `0 12px 32px rgba(0,0,0,0.28), 0 0 24px rgba(${ambient.glowRgb}, 0.06)`,
        }}
      >
        <h3 className="text-lg font-bold tracking-tight text-white sm:text-xl">
          Join the room
        </h3>
        <p className="mx-auto mt-2 max-w-[16rem] text-sm leading-relaxed text-zinc-400">
          Enter your name to vote and add songs
        </p>
        <motion.button
          type="button"
          onClick={onJoin}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.18 }}
          className="mt-6 min-h-12 w-full touch-manipulation rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-black/25 transition-colors duration-300 hover:bg-zinc-200"
        >
          Join Room
        </motion.button>
      </div>
    </motion.div>
  );
}

function RoomLoadDebugPanel({ debug }: { debug: RoomLoadDebug }) {
  return (
    <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-left font-mono text-[10px] leading-relaxed text-amber-100/90">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
        Debug
      </p>
      <p>Client runtime: {debug.clientRuntime}</p>
      <p>Client hydrated: {debug.clientHydrated}</p>
      <p>Loading state: {debug.loadingState}</p>
      <p>Firebase env: {debug.firebaseEnv}</p>
      <p>Firebase env missing: {debug.firebaseEnvMissing}</p>
      <p>Firestore connected: {debug.firestoreConnected}</p>
      <p>Room snapshot received: {debug.snapshotReceived}</p>
      <p>Room parse success: {debug.roomParseSuccess}</p>
      <p>Identity gate: {debug.identityGate}</p>
      <p>Error: {debug.error}</p>
      <p className="mt-2 break-all text-amber-200/70">
        Startup blocker: {debug.startupBlocker}
      </p>
      <p className="break-all text-amber-200/70">Safari checks: {debug.safariChecks}</p>
      <p className="break-all text-amber-200/70">Last event: {debug.lastEvent}</p>
    </div>
  );
}

function RoomLoading({
  roomId,
  debug,
}: {
  roomId: string;
  debug: RoomLoadDebug;
}) {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-8 sm:px-5 sm:py-10">
        <header className="mb-10">
          <p className="text-xs font-medium tracking-widest text-zinc-500">
            Qup
          </p>
          <div className="mt-2 h-9 w-48 animate-pulse rounded-lg bg-zinc-800" />
          <p className="mt-3 text-sm text-zinc-500">Room · {roomId}</p>
        </header>

        <section className="mb-6">
          <div className="mb-3 h-3 w-24 animate-pulse rounded bg-zinc-800" />
          <div className="h-28 animate-pulse rounded-2xl bg-zinc-900/80" />
        </section>

        <section className="flex-1 space-y-2">
          <div className="mb-3 h-3 w-16 animate-pulse rounded bg-zinc-800" />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-zinc-900/60"
            />
          ))}
        </section>

        <p className="mt-10 text-center text-sm text-zinc-500">Loading room…</p>
        <RoomLoadDebugPanel debug={debug} />
      </div>
    </main>
  );
}

function RoomNotFound({
  roomId,
  debug,
}: {
  roomId: string;
  debug: RoomLoadDebug;
}) {
  return (
    <>
      <StatusScreen
        roomId={roomId}
        title="Room not found"
        message={`No room exists with code "${roomId}". Check the code or create a new room from the homepage.`}
      />
      <div className="fixed inset-x-0 bottom-4 z-[90] mx-auto max-w-lg px-4">
        <RoomLoadDebugPanel debug={debug} />
      </div>
    </>
  );
}

function RoomError({
  roomId,
  message,
  debug,
}: {
  roomId: string;
  message: string;
  debug: RoomLoadDebug;
}) {
  return (
    <>
      <StatusScreen roomId={roomId} title="Something went wrong" message={message} />
      <div className="fixed inset-x-0 bottom-4 z-[90] mx-auto max-w-lg px-4">
        <RoomLoadDebugPanel debug={debug} />
      </div>
    </>
  );
}

function StatusScreen({
  roomId,
  title,
  message,
}: {
  roomId: string;
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-5 py-10 text-center">
        <p className="text-xs font-medium tracking-widest text-zinc-500">
          Qup
        </p>
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        <p className="mt-3 max-w-sm text-sm text-zinc-400">{message}</p>
        <p className="mt-2 text-xs text-zinc-600">Room · {roomId}</p>
        <Link
          href="/"
          className="mt-8 rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}

