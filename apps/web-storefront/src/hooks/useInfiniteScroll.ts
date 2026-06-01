/**
 * Infinite-scroll sentinel hook.
 *
 * Wraps react-intersection-observer's useInView and calls fetchNextPage()
 * when the sentinel element scrolls into the viewport (threshold: 10%).
 * Guards against double-fetching with hasNextPage + isFetchingNextPage checks.
 *
 * Usage:
 *   const { sentinelRef } = useInfiniteScroll(fetchNextPage, hasNextPage, isFetchingNextPage);
 *   // Mount: <div ref={sentinelRef} aria-hidden="true" />
 */

import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

export function useInfiniteScroll(
  fetchNextPage: () => void,
  hasNextPage: boolean,
  isFetchingNextPage: boolean,
) {
  const { ref, inView } = useInView({ threshold: 0.1 });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { sentinelRef: ref };
}
