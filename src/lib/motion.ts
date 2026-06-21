import type { Transition } from "framer-motion";

/** Premium spring — subtle damping, not bouncy. */
export const springPremium: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 28,
  mass: 0.85,
};

/** Layout reorder — overdamped glide (~400ms feel). */
export const springLayout: Transition = {
  type: "spring",
  stiffness: 210,
  damping: 38,
  mass: 0.98,
};

export const fadeSmooth: Transition = {
  duration: 0.55,
  ease: [0.4, 0, 0.2, 1],
};

export const fadeAmbient: Transition = {
  duration: 0.7,
  ease: [0.4, 0, 0.2, 1],
};

/** Fullscreen now playing — cinematic open/close. */
export const fadeCinematic: Transition = {
  duration: 0.85,
  ease: [0.22, 0.03, 0.26, 1],
};

export const staggerCinematic = {
  staggerChildren: 0.09,
  delayChildren: 0.12,
};
