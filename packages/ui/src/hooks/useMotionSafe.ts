/**
 * useMotionSafe — returns motion props respecting prefers-reduced-motion.
 *
 * When reduced motion is active, returns empty props so elements
 * render without animation. Animations are entirely skipped (not just
 * slowed) per WCAG 2.3.3 (Animation from Interactions).
 *
 * Usage:
 *   const { motion: m, variants } = useMotionSafe();
 *
 *   // Basic fade-in
 *   const safeProps = useMotionSafeProps({
 *     initial: { opacity: 0, y: 8 },
 *     animate: { opacity: 1, y: 0 },
 *     transition: { duration: 0.25, ease: 'easeOut' },
 *   });
 *   return <motion.div {...safeProps}>...</motion.div>;
 *
 * Standard easing conventions (D-56):
 *   Entries/reveals: ease: 'easeOut', duration 200-300ms
 *   Exits:           ease: 'easeIn',  duration 150-200ms
 *   Drag/pan:        type: 'spring',  stiffness: 300, damping: 30
 */

import { useReducedMotion } from 'motion/react';

interface MotionProps {
  initial?: Record<string, unknown>;
  animate?: Record<string, unknown>;
  exit?: Record<string, unknown>;
  transition?: Record<string, unknown>;
  whileHover?: Record<string, unknown>;
  whileTap?: Record<string, unknown>;
  whileDrag?: Record<string, unknown>;
}

/**
 * Returns motion props or empty object based on prefers-reduced-motion.
 * Pass your desired animation props; they are nullified when reduced motion is on.
 */
export function useMotionSafeProps(props: MotionProps): MotionProps {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return {};
  }

  return props;
}

/**
 * Standard entry animation (fade + slide up).
 * Convention: easeOut, 250ms — use for page sections, cards, modals.
 */
export const ENTRY_MOTION: MotionProps = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: 'easeOut' },
};

/**
 * Standard exit animation (fade + slide down).
 * Convention: easeIn, 180ms — use for modals, drawers, dropdowns.
 */
export const EXIT_MOTION: MotionProps = {
  exit: { opacity: 0, y: 4 },
  transition: { duration: 0.18, ease: 'easeIn' },
};

/**
 * Standard page transition (full page fade + slight slide).
 * Convention: easeOut, 220ms — use for route changes.
 */
export const PAGE_TRANSITION: MotionProps = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.22, ease: 'easeOut' },
};

/**
 * Drag/gesture spring — use for kanban cards, sortable lists.
 * Convention: spring, stiffness 300, damping 30.
 */
export const SPRING_MOTION: MotionProps = {
  transition: { type: 'spring', stiffness: 300, damping: 30 },
};

export { useReducedMotion };
