"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import type { AmbientPalette } from "@/lib/ambient-palette";
import {
  DEFAULT_PALETTE,
  modalEdgeGlow,
  modalLabelColor,
  modalSearchFocusShadow,
  warmWhite,
} from "@/lib/ambient-palette";
import {
  DISPLAY_NAME_MAX_LENGTH,
  sanitizeDisplayName,
} from "@/lib/display-name";
import { springPremium } from "@/lib/motion";

type JoinIdentityModalProps = {
  isOpen: boolean;
  onConfirm: (name: string) => void;
  ambient?: AmbientPalette;
};

export function JoinIdentityModal({
  isOpen,
  onConfirm,
  ambient = DEFAULT_PALETTE,
}: JoinIdentityModalProps) {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onConfirm(value.trim());
  }

  const previewName = value.trim()
    ? sanitizeDisplayName(value)
    : null;

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="join-identity-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
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
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={springPremium}
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
                Join the room
              </p>
              <h2
                id="join-identity-title"
                className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl"
              >
                What should the room call you?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Your name shows when you add songs. Stored on this device only.
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
                      setValue(e.target.value.slice(0, DISPLAY_NAME_MAX_LENGTH));
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Your name"
                    maxLength={DISPLAY_NAME_MAX_LENGTH}
                    autoFocus
                    autoComplete="nickname"
                    enterKeyHint="done"
                    className="min-h-13 w-full touch-manipulation bg-transparent px-4 py-3.5 text-base text-white placeholder:text-zinc-500 outline-none sm:text-sm"
                  />
                </motion.div>

                <p className="mt-2 text-xs text-zinc-600">
                  {value.length}/{DISPLAY_NAME_MAX_LENGTH} · letters &amp; numbers
                </p>

                {previewName && value.trim() !== previewName ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    We&apos;ll show you as{" "}
                    <span className="text-zinc-300">{previewName}</span>
                  </p>
                ) : null}

                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="mt-5 min-h-12 w-full touch-manipulation rounded-full bg-white py-3.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-black/25 transition-colors duration-300 hover:bg-zinc-200"
                >
                  Join Room
                </motion.button>
              </form>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
