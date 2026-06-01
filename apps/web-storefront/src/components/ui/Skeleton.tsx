/**
 * CSS-only shimmer skeleton.
 *
 * Uses Tailwind's `animate-pulse` — no JS animation (per UI-SPEC "Don't
 * Hand-Roll" rule). The wrapping element sets aria-busy="true" so screen
 * readers announce that content is loading.
 */
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading…"
    >
      <div
        className={`bg-grovio-border rounded-md animate-pulse ${className}`.trim()}
      />
    </div>
  );
}
