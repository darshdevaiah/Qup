"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getSoundEngine } from "@/lib/sound/sound-engine";
import { prefersReducedSensory, readSoundEnabled } from "@/lib/sound/sound-settings";
import type { PlaySoundOptions, SoundEvent } from "@/lib/sound/sound-types";

type SoundContextValue = {
  play: (event: SoundEvent, options?: PlaySoundOptions) => void;
  unlock: () => void;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  masterVolume: number;
  setMasterVolume: (volume: number) => void;
};

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const engine = useMemo(() => getSoundEngine(), []);
  const [enabled, setEnabledState] = useState(() => readSoundEnabled());
  const [masterVolume, setMasterVolumeState] = useState(() => engine.masterVolume);

  const unlock = useCallback(() => {
    void engine.unlock();
  }, [engine]);

  const play = useCallback(
    (event: SoundEvent, options?: PlaySoundOptions) => {
      engine.play(event, options);
    },
    [engine],
  );

  const setEnabled = useCallback(
    (value: boolean) => {
      engine.setEnabled(value);
      setEnabledState(value);
    },
    [engine],
  );

  const setMasterVolume = useCallback(
    (value: number) => {
      engine.setMasterVolume(value);
      setMasterVolumeState(engine.masterVolume);
    },
    [engine],
  );

  useEffect(() => {
    const onGesture = () => unlock();
    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("touchstart", onGesture, { passive: true });
    window.addEventListener("keydown", onGesture);

    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("touchstart", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [unlock]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (prefersReducedSensory()) {
        engine.setEnabled(false);
        setEnabledState(false);
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [engine]);

  const value = useMemo(
    () => ({
      play,
      unlock,
      enabled,
      setEnabled,
      masterVolume,
      setMasterVolume,
    }),
    [play, unlock, enabled, setEnabled, masterVolume, setMasterVolume],
  );

  return (
    <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
  );
}

export function useSound(): SoundContextValue {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error("useSound must be used within SoundProvider");
  }
  return context;
}
