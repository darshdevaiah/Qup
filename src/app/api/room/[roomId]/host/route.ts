import { NextResponse } from "next/server";

import {
  claimRoomHost,
  hostPinQueuedSong,
  hostRemoveQueuedSong,
  hostSkipCurrentSong,
  hostTriggerBattle,
  updateRoomHostSettings,
  type HostSettingsPatch,
} from "@/lib/host-actions";
import { HostPermissionError } from "@/lib/host-permissions";

type HostActionBody = {
  voterId?: string;
  action?: string;
  songId?: string | null;
  settings?: HostSettingsPatch;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;

  let body: HostActionBody;
  try {
    body = (await request.json()) as HostActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const voterId = body.voterId?.trim();
  if (!voterId) {
    return NextResponse.json({ error: "voterId is required." }, { status: 400 });
  }

  const action = body.action;
  if (!action) {
    return NextResponse.json({ error: "action is required." }, { status: 400 });
  }

  try {
    switch (action) {
      case "claim_host":
        await claimRoomHost(roomId, voterId);
        break;
      case "skip_song":
        await hostSkipCurrentSong(roomId, voterId);
        break;
      case "update_settings":
        await updateRoomHostSettings(roomId, voterId, body.settings ?? {});
        break;
      case "remove_song":
        if (!body.songId || typeof body.songId !== "string") {
          return NextResponse.json(
            { error: "songId is required." },
            { status: 400 },
          );
        }
        await hostRemoveQueuedSong(roomId, voterId, body.songId);
        break;
      case "pin_song":
        await hostPinQueuedSong(
          roomId,
          voterId,
          body.songId === null ? null : body.songId ?? null,
        );
        break;
      case "start_battle":
        await hostTriggerBattle(roomId, voterId);
        break;
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof HostPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const message =
      error instanceof Error ? error.message : "Host action failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
