import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Shared page-transition wrapper.
 *
 * Every page in Wave 6 uses this as its root element so that AnimatePresence
 * in AppLayout can detect the exit animation (Pitfall 3 from RESEARCH.md:
 * exit only fires if the exiting component renders a motion element).
 *
 * Animation (UI-SPEC Animation Contract):
 *   initial: opacity 0, y 8
 *   animate: opacity 1, y 0
 *   exit:    opacity 0, y 8
 *   transition: duration 0.25, ease easeOut
 */
export function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
