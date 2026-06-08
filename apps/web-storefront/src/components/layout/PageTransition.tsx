import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Shared page-transition wrapper.
 *
 * Every page uses this as its root element so that AnimatePresence
 * in AppLayout can detect the exit animation (Pitfall 3 from RESEARCH.md:
 * exit only fires if the exiting component renders a motion element).
 *
 * Animation (D-56 convention):
 *   initial: opacity 0, y 8
 *   animate: opacity 1, y 0
 *   exit:    opacity 0
 *   transition: duration 0.22, ease easeOut
 *
 * Accessibility: respects prefers-reduced-motion — renders immediately
 * without animation when reduced motion is preferred (WCAG 2.3.3).
 */
export function PageTransition({ children }: PageTransitionProps) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
