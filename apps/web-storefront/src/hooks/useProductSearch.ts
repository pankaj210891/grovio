/**
 * Infinite-scroll product search hook (D-05, D-08).
 *
 * Uses useInfiniteQuery so filter/sort/category changes automatically reset
 * to page 1 (all URL params are in the queryKey — RESEARCH.md Pitfall 1).
 *
 * Batch size: 24 products per page (D-08).
 * Cursor: opaque string from SearchResponse.nextCursor; empty string for page 1.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client.js';
import type { SearchResponse } from '@grovio/contracts';

export function useProductSearch() {
  const [searchParams] = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const filters = searchParams.get('filters') ?? '';
  const sort = searchParams.get('sort') ?? 'relevance';
  const categoryId = searchParams.get('categoryId') ?? '';

  return useInfiniteQuery<SearchResponse>({
    // All URL params in queryKey — URL change resets to page 1 (Pitfall 1)
    queryKey: ['search', q, filters, sort, categoryId],

    queryFn: ({ pageParam }) => {
      const cursor = typeof pageParam === 'string' ? pageParam : '';
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (filters) params.set('filters', filters);
      if (sort) params.set('sort', sort);
      if (categoryId) params.set('categoryId', categoryId);
      params.set('limit', '24');
      if (cursor) params.set('cursor', cursor);

      return apiClient
        .get<{ success: boolean; data: SearchResponse }>(
          `/search?${params.toString()}`,
        )
        .then((r) => r.data);
    },

    initialPageParam: '',

    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
