"use client";

import { motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";

import { RoomQrModal } from "@/components/room/room-qr-modal";
import { useToast } from "@/components/ui/toast";
import type { AmbientPalette } from "@/lib/ambient-palette";
import { DEFAULT_PALETTE, warmWhite } from "@/lib/ambient-palette";
import {
  copyToClipboard,
  getRoomShareCode,
  getRoomShareUrl,
  shareRoomNative,
} from "@/lib/room-share";

type ShareRoomProps = {
  roomId: string;
  roomName: string;
  roomCode?: string;
  ambient?: AmbientPalette;
};

type ShareAction = {
  id: string;
  label: string;
  onPress: () => void | Promise<void>;
};

export function ShareRoom({
  roomId,
  roomName,
  roomCode,
  ambient = DEFAULT_PALETTE,
}: ShareRoomProps) {
  const { showToast } = useToast();
  const [isQrOpen, setIsQrOpen] = useState(false);

  const code = useMemo(
    () => getRoomShareCode(roomId, roomCode),
    [roomId, roomCode],
  );

  const handleCopyCode = useCallback(async () => {
    try {
      await copyToClipboard(code);
      showToast("Room code copied", "success");
    } catch {
      showToast("Could not copy code", "error");
    }
  }, [code, showToast]);

  const handleCopyLink = useCallback(async () => {
    const url = getRoomShareUrl(roomId);
    if (!url) return;

    try {
      await copyToClipboard(url);
      showToast("Link copied", "success");
    } catch {
      showToast("Could not copy link", "error");
    }
  }, [roomId, showToast]);

  const handleShareRoom = useCallback(async () => {
    const url = getRoomShareUrl(roomId);
    if (!url) return;

    try {
      const shared = await shareRoomNative({
        title: roomName,
        url,
        text: `Join ${roomName} on Qup`,
      });

      if (!shared) {
        await copyToClipboard(url);
        showToast("Link copied", "success");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      showToast("Could not share room", "error");
    }
  }, [roomId, roomName, showToast]);

  const handleShowQr = useCallback(() => {
    const url = getRoomShareUrl(roomId);
    if (!url) {
      showToast("Could not build share link", "error");
      return;
    }
    setIsQrOpen(true);
  }, [roomId, showToast]);

  const actions: ShareAction[] = [
    { id: "copy-code", label: "Copy Code", onPress: handleCopyCode },
    { id: "copy-link", label: "Copy Link", onPress: handleCopyLink },
    { id: "share-room", label: "Share Room", onPress: handleShareRoom },
    { id: "show-qr", label: "Show QR", onPress: handleShowQr },
  ];

  return (
    <>
      <div
        className="mx-auto mt-4 w-full max-w-md rounded-2xl border border-white/[0.08] bg-zinc-950/40 px-3 py-3 backdrop-blur-xl sm:px-4"
        style={{
          borderColor: warmWhite(0.08),
          boxShadow: `0 8px 24px rgba(0,0,0,0.22), 0 0 16px rgba(${ambient.glowRgb}, 0.04)`,
        }}
      >
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Share room
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {actions.map((action) => (
            <motion.button
              key={action.id}
              type="button"
              onClick={() => void action.onPress()}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="min-h-10 touch-manipulation rounded-xl border border-white/[0.08] bg-white/[0.04] px-2 py-2 text-[11px] font-semibold leading-tight text-zinc-200 transition-colors duration-300 hover:border-white/[0.14] hover:bg-white/[0.07] sm:text-xs"
            >
              {action.label}
            </motion.button>
          ))}
        </div>
      </div>

      <RoomQrModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        roomId={roomId}
        roomName={roomName}
        roomCode={code}
        ambient={ambient}
      />
    </>
  );
}
