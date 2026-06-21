"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import {
  DEFAULT_PALETTE,
  modalEdgeGlow,
  modalLabelColor,
  modalSearchFocusShadow,
  warmWhite,
} from "@/lib/ambient-palette";
import { fadeSmooth, springPremium } from "@/lib/motion";
import { normalizeRoomCodeInput } from "@/lib/rooms";

type JoinRoomModalProps = {
  isOpen: boolean;
  isJoining: boolean;
  onClose: () => void;
  onJoin: (roomCode: string) => void;
};

export function JoinRoomModal({
  isOpen,
  isJoining,
  onClose,
  onJoin,
}: JoinRoomModalProps) {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const ambient = DEFAULT_PALETTE;

  const panelTransition = reduceMotion ? fadeSmooth : springPremium;
  const backdropTransition = reduceMotion
    ? { duration: 0.01 }
    : { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const };

  const normalized = normalizeRoomCodeInput(value);
  const isComplete = normalized.length === 6;

  function handleClose() {
    if (isJoining) return;
    setValue("");
    onClose();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isComplete || isJoining) return;
    onJoin(normalized);
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="join-room-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={backdropTransition}
        >
          <motion.button
            type="button"
            aria-label="Close"
            disabled={isJoining}
            onClick={handleClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md disabled:cursor-not-allowed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-950/90 px-5 pb-8 pt-6 shadow-2xl backdrop-blur-2xl sm:rounded-3xl sm:px-6 sm:pb-9 sm:pt-7"
            style={{
              borderColor: ambient.borderSubtle,
              boxShadow: `0 24px 48px rgba(0, 0, 0, 0.6), 0 0 18px rgba(${ambient.glowRgb}, 0.05)`,
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
          >
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{ background: modalEdgeGlow(ambient) }}
            />

            <div className="relative">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors duration-700"
                style={{ color: modalLabelColor(ambient) }}
              >
                Join a room
              </p>
              <h2
                id="join-room-title"
                className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl"
              >
                Enter room code
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Ask the DJ for the 6-character code, then jump in.
              </p>

              <form onSubmit={handleSubmit} className="mt-6">
                <motion.div
                  animate={{
                    boxShadow: modalSearchFocusShadow(ambient, isFocused),
                  }}
                  transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/75 backdrop-blur-xl transition-[border-color] duration-700"
                  style={{
                    borderColor: isFocused ? ambient.border : warmWhite(0.1),
                  }}
                >
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      setValue(normalizeRoomCodeInput(e.target.value));
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="A7K9XZ"
                    maxLength={6}
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    enterKeyHint="go"
                    inputMode="text"
                    disabled={isJoining}
                    className="min-h-13 w-full touch-manipulation bg-transparent px-4 py-3.5 text-center font-mono text-lg tracking-[0.28em] text-white placeholder:tracking-[0.18em] placeholder:text-zinc-500 outline-none disabled:opacity-50 sm:text-base"
                  />
                </motion.div>

                <p className="mt-2 text-center text-xs text-zinc-600">
                  {normalized.length}/6 characters
                </p>

                <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                  <motion.button
                    type="button"
                    disabled={isJoining}
                    onClick={handleClose}
                    whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                    className="min-h-12 touch-manipulation rounded-full border border-white/10 bg-transparent px-6 py-3 text-sm font-semibold text-zinc-300 transition-colors duration-300 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Cancel
                  </motion.button>

                  <motion.button
                    type="submit"
                    disabled={!isComplete || isJoining}
                    whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                    className="min-h-12 touch-manipulation rounded-full bg-white px-8 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-black/25 transition-colors duration-300 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isJoining ? "Joining…" : "Join Room"}
                  </motion.button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
