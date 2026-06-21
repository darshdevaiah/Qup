"use client";

import { useCallback, useMemo, useState } from "react";

import type { HostSettingsPatch } from "@/lib/host-actions";
import {
  getEffectiveHostSettings,
  getHostPermissionSnapshot,
} from "@/lib/host-permissions";
import type { Room } from "@/types/firestore";

type UseHostControlsOptions = {
  roomId: string;
  room: Room;
  voterId: string;
};

async function postHostAction(
  roomId: string,
  voterId: string,
  action: string,
  payload: Record<string, unknown> = {},
) {
  const response = await fetch(`/api/room/${encodeURIComponent(roomId)}/host`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voterId, action, ...payload }),
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "DJ action failed.");
  }
}

export function useHostControls({
  roomId,
  room,
  voterId,
}: UseHostControlsOptions) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticHost, setOptimisticHost] = useState<
    ReturnType<typeof getEffectiveHostSettings> | null
  >(null);

  const permissions = useMemo(
    () => getHostPermissionSnapshot(room, voterId),
    [room, voterId],
  );

  const hostSettings = optimisticHost ?? permissions.settings;

  const run = useCallback(
    async (action: string, payload: Record<string, unknown> = {}) => {
      setPending(true);
      setError(null);
      try {
        await postHostAction(roomId, voterId, action, payload);
        setOptimisticHost(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed.");
        setOptimisticHost(null);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [roomId, voterId],
  );

  const claimHost = useCallback(async () => {
    await run("claim_host");
  }, [run]);

  const skipSong = useCallback(async () => {
    await run("skip_song");
  }, [run]);

  const patchSettings = useCallback(
    async (patch: HostSettingsPatch) => {
      setOptimisticHost(mergeSettings(hostSettings, patch));
      await run("update_settings", { settings: patch });
    },
    [hostSettings, run],
  );

  const toggleVotingPaused = useCallback(async () => {
    await patchSettings({ votingPaused: !hostSettings.votingPaused });
  }, [hostSettings.votingPaused, patchSettings]);

  const toggleQueueLocked = useCallback(async () => {
    await patchSettings({ queueLocked: !hostSettings.queueLocked });
  }, [hostSettings.queueLocked, patchSettings]);

  const toggleExplicitFilter = useCallback(async () => {
    await patchSettings({
      explicitFilterEnabled: !hostSettings.explicitFilterEnabled,
    });
  }, [hostSettings.explicitFilterEnabled, patchSettings]);

  const toggleCrowdMode = useCallback(async () => {
    await patchSettings({ crowdMode: !hostSettings.crowdMode });
  }, [hostSettings.crowdMode, patchSettings]);

  const startBattle = useCallback(async () => {
    await run("start_battle");
  }, [run]);

  const removeSong = useCallback(
    async (songId: string) => {
      await run("remove_song", { songId });
    },
    [run],
  );

  const pinSong = useCallback(
    async (songId: string | null) => {
      await run("pin_song", { songId });
    },
    [run],
  );

  return {
    ...permissions,
    isHost: permissions.isHost,
    hostSettings,
    pending,
    error,
    claimHost,
    skipSong,
    toggleVotingPaused,
    toggleQueueLocked,
    toggleExplicitFilter,
    toggleCrowdMode,
    startBattle,
    removeSong,
    pinSong,
  };
}

function mergeSettings(
  current: ReturnType<typeof getEffectiveHostSettings>,
  patch: HostSettingsPatch,
) {
  return { ...current, ...patch };
}
