import { useEffect, useState } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from "framer-motion";

/** Premium spring presets for cinematic, tactile motion. */
export const SPRING = {
  /** Gentle, default UI spring (cards, hovers, drawers). */
  soft: { type: "spring" as const, stiffness: 220, damping: 24, mass: 0.9 },
  /** Snappy interactive spring (buttons, taps). */
  snap: { type: "spring" as const, stiffness: 420, damping: 28, mass: 0.7 },
  /** Slow, breath-like spring (hero, ambient). */
  breath: { type: "spring" as const, stiffness: 80, damping: 18, mass: 1.2 },
};

export const EASE = [0.22, 0.61, 0.36, 1] as const;

/** Page transition variants — gentle fade + tiny rise. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8, filter: "blur(6px)" },
  enter: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.45, ease: EASE } },
  exit: { opacity: 0, y: -6, filter: "blur(4px)", transition: { duration: 0.25, ease: EASE } },
};

/** Stagger container for lists / grids. */
export const staggerContainer = (stagger = 0.045): Variants => ({
  initial: {},
  enter: { transition: { staggerChildren: stagger, delayChildren: 0.04 } },
  exit: {},
});

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 14 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: EASE } },
};

/** Hook: prefers-reduced-motion safe wrapper for spring config. */
export function useSafeSpring(spring = SPRING.soft) {
  const reduced = useReducedMotion();
  return reduced ? { duration: 0 } : spring;
}

/** Wrap any clickable target to give it a snappy "haptic" press. */
export function HapticPress({
  as: As = motion.button,
  className,
  children,
  ...rest
}: HTMLMotionProps<"button"> & { as?: typeof motion.button }) {
  const reduced = useReducedMotion();
  return (
    <As
      whileHover={reduced ? undefined : { y: -1, scale: 1.015 }}
      whileTap={reduced ? undefined : { y: 0, scale: 0.97 }}
      transition={SPRING.snap}
      className={className}
      {...rest}
    >
      {children}
    </As>
  );
}

/** Animated number that springs to its value (used for wallet balance). */
export function SpringNumber({
  value,
  className,
  format = (v) => Math.round(v).toLocaleString(),
}: {
  value: number;
  className?: string;
  format?: (v: number) => string;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = display;
    const dur = 700;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      // ease-out-quart
      const eased = 1 - Math.pow(1 - k, 4);
      setDisplay(from + (value - from) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span className={className}>{format(display)}</span>;
}

export { motion, AnimatePresence, useReducedMotion };
