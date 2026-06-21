import type { Room, RoomHostSettings } from "@/types/firestore";

export class HostPermissionError extends Error {
  constructor(message = "Only the room DJ can perform this action.") {
    super(message);
    this.name = "HostPermissionError";
  }
}

export const DEFAULT_ROOM_HOST_SETTINGS: RoomHostSettings = {
  hostId: "",
  votingPaused: false,
  queueLocked: false,
  explicitFilterEnabled: false,
  crowdMode: false,
};

export function parseRoomHostSettings(raw: unknown): RoomHostSettings | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const data = raw as Record<string, unknown>;
  const hostId = typeof data.hostId === "string" ? data.hostId.trim() : "";
  if (!hostId) return undefined;

  return {
    hostId,
    votingPaused: data.votingPaused === true,
    queueLocked: data.queueLocked === true,
    explicitFilterEnabled: data.explicitFilterEnabled === true,
    crowdMode: data.crowdMode === true,
  };
}

export function sanitizeRoomHostSettingsForFirestore(
  host: RoomHostSettings,
): Record<string, string | boolean> {
  return {
    hostId: host.hostId,
    votingPaused: host.votingPaused,
    queueLocked: host.queueLocked,
    explicitFilterEnabled: host.explicitFilterEnabled,
    crowdMode: host.crowdMode,
  };
}

export function getEffectiveHostSettings(room: Room): RoomHostSettings {
  return room.host ?? DEFAULT_ROOM_HOST_SETTINGS;
}

export function isRoomHost(room: Room, voterId: string): boolean {
  const hostId = room.host?.hostId;
  return Boolean(hostId && hostId === voterId);
}

export function canClaimHost(room: Room): boolean {
  return !room.host?.hostId;
}

export function assertRoomHost(room: Room, voterId: string): void {
  if (!isRoomHost(room, voterId)) {
    throw new HostPermissionError();
  }
}

export type HostPermissionSnapshot = {
  isHost: boolean;
  canClaim: boolean;
  settings: RoomHostSettings;
};

export function getHostPermissionSnapshot(
  room: Room,
  voterId: string,
): HostPermissionSnapshot {
  return {
    isHost: isRoomHost(room, voterId),
    canClaim: canClaimHost(room),
    settings: getEffectiveHostSettings(room),
  };
}
