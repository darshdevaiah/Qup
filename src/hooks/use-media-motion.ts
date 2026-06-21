"use client";

import { useEffect, useState } from "react";

/** Respects reduced motion + fine pointer (desktop hover/parallax). */
export function useMediaMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [finePointer, setFinePointer] = useState(false);

  useEffect(() => {
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerMq = window.matchMedia("(hover: hover) and (pointer: fine)");

    const sync = () => {
      setReducedMotion(motionMq.matches);
      setFinePointer(pointerMq.matches);
    };

    sync();
    motionMq.addEventListener("change", sync);
    pointerMq.addEventListener("change", sync);

    return () => {
      motionMq.removeEventListener("change", sync);
      pointerMq.removeEventListener("change", sync);
    };
  }, []);

  return { reducedMotion, finePointer, motionEnabled: !reducedMotion };
}

/** Minimal desktop parallax — GPU translate only. */
export function useSubtleParallax(enabled: boolean) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) {
      setOffset({ x: 0, y: 0 });
      return;
    }

    const onMove = (event: MouseEvent) => {
      const x = ((event.clientX / window.innerWidth) - 0.5) * 10;
      const y = ((event.clientY / window.innerHeight) - 0.5) * 7;
      setOffset({ x, y });
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [enabled]);

  return offset;
}
