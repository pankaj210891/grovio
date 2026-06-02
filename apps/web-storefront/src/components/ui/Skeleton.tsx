/**
 * CSS-only shimmer skeleton.
 *
 * Uses Tailwind's `animate-pulse` — no JS animation (per UI-SPEC "Don't
 * Hand-Roll" rule). The calling page is responsible for wrapping skeleton
 * groups with aria-busy="true" on the container; the individual Skeleton
 * component should NOT repeat it to avoid nested announcements (WR-07).
 */
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-grovio-border rounded-md animate-pulse ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
