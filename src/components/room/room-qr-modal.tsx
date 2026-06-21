"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

import { CloseIcon } from "@/components/room/icons";
import { useToast } from "@/components/ui/toast";
import type { AmbientPalette } from "@/lib/ambient-palette";
import {
  DEFAULT_PALETTE,
  modalEdgeGlow,
  modalLabelColor,
  warmWhite,
} from "@/lib/ambient-palette";
import { copyToClipboard, getRoomShareUrl } from "@/lib/room-share";
import { fadeSmooth, springPremium } from "@/lib/motion";

type RoomQrModalProps = {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  roomCode: string;
  ambient?: AmbientPalette;
};

export function RoomQrModal({
  isOpen,
  onClose,
  roomId,
  roomName,
  roomCode,
  ambient = DEFAULT_PALETTE,
}: RoomQrModalProps) {
  const reduceMotion = useReducedMotion();
  const { showToast } = useToast();
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setShareUrl("");
      return;
    }
    setShareUrl(getRoomShareUrl(roomCode));
  }, [isOpen, roomCode]);

  const panelTransition = reduceMotion ? fadeSmooth : springPremium;
  const backdropTransition = reduceMotion
    ? { duration: 0.01 }
    : { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const };

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  async function handleCopyLink() {
    const url = getRoomShareUrl(roomCode);
    if (!url) return;

    try {
      await copyToClipboard(url);
      showToast("Link copied", "success");
    } catch {
      showToast("Could not copy link", "error");
    }
  }

  return (
    <AnimatePresence>
      {isOpen && shareUrl ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="room-qr-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={backdropTransition}
        >
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-950/92 shadow-2xl backdrop-blur-2xl sm:max-h-[85dvh] sm:rounded-3xl"
            style={{
              borderColor: ambient.borderSubtle,
              boxShadow: `0 24px 48px rgba(0, 0, 0, 0.6), 0 0 18px rgba(${ambient.glowRgb}, 0.06)`,
            }}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 40, scale: 0.98 }
            }
            animate={
              reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 24, scale: 0.98 }
            }
            transition={panelTransition}
            onClick={(event) => event.stopPropagation()}
          >
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{ background: modalEdgeGlow(ambient) }}
            />

            <div className="relative flex min-h-0 flex-1 flex-col px-5 pb-8 pt-5 sm:px-6 sm:pb-9 sm:pt-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0 text-left">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                    style={{ color: modalLabelColor(ambient) }}
                  >
                    Scan to join
                  </p>
                  <h2
                    id="room-qr-title"
                    className="mt-2 truncate text-xl font-bold tracking-tight text-white sm:text-2xl"
                  >
                    {roomName}
                  </h2>
                  <p className="mt-1 font-mono text-sm tracking-[0.22em] text-zinc-400">
                    {roomCode}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close QR modal"
                  className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition-colors hover:bg-white/[0.08]"
                >
                  <CloseIcon />
                </button>
              </div>

              <div
                className="min-h-0 flex-1 overflow-auto overscroll-contain"
                style={{ touchAction: "pinch-zoom" }}
              >
                <div
                  className="mx-auto w-full max-w-[min(100%,22rem)] rounded-2xl border border-white/10 bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:max-w-xs sm:p-5"
                  style={{ touchAction: "pinch-zoom" }}
                >
                  <QRCode
                    value={shareUrl}
                    size={256}
                    level="M"
                    bgColor="#FFFFFF"
                    fgColor="#09090B"
                    className="h-auto w-full max-w-none"
                    style={{ height: "auto", width: "100%" }}
                    viewBox="0 0 256 256"
                  />
                </div>

                <p className="mx-auto mt-4 max-w-sm break-all px-1 text-center text-xs leading-relaxed text-zinc-500">
                  {shareUrl}
                </p>
              </div>

              <motion.button
                type="button"
                onClick={() => void handleCopyLink()}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                className="mt-6 min-h-12 w-full touch-manipulation rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white transition-colors duration-300 hover:bg-white/[0.1]"
                style={{ borderColor: warmWhite(0.12) }}
              >
                Copy Link
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
