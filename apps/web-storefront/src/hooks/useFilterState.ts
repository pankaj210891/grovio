/**
 * URL-serialized filter state hook (D-06).
 *
 * All filter values are stored in URL search params so that:
 * - links are shareable and bookmarkable
 * - back-navigation from PDP restores the exact filter state
 * - filter changes automatically reset useInfiniteQuery to page 1 (because
 *   the queryKey includes the URL params — RESEARCH.md Pitfall 1)
 *
 * Dynamic attribute filters (size, color, brand, …) are stored as a single
 * JSON-serialized `filters` param to avoid URL explosion when many attributes
 * are active at once (RESEARCH.md Pattern 4).
 *
 * Note: react-router-dom v7 re-exports from react-router. We import from
 * react-router-dom (installed package) using the canonical hook names.
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface FilterState {
  q: string;
  categoryId: string;
  sort: string;
  /** JSON-parsed dynamic attribute filters, e.g. { color: ['red'], size: ['L'] } */
  activeFilters: Record<string, string[]>;
}

export function useFilterState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<FilterState>(
    () => ({
      q: searchParams.get('q') ?? '',
      categoryId: searchParams.get('categoryId') ?? '',
      sort: searchParams.get('sort') ?? 'relevance',
      activeFilters: (() => {
        try {
          return JSON.parse(
            searchParams.get('filters') ?? '{}',
          ) as Record<string, string[]>;
        } catch {
          return {};
        }
      })(),
    }),
    [searchParams],
  );

  /**
   * Set a single top-level filter param (q, categoryId, sort).
   */
  const setFilter = useCallback(
    (key: 'q' | 'categoryId' | 'sort', value: string) => {
      setSearchParams(
        (prev: URLSearchParams) => {
          if (value) {
            prev.set(key, value);
          } else {
            prev.delete(key);
          }
          return prev;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  /**
   * Set a dynamic attribute filter inside the JSON `filters` param.
   * Passing an empty array removes the key.
   */
  const setAttributeFilter = useCallback(
    (attributeKey: string, values: string[]) => {
      setSearchParams(
        (prev: URLSearchParams) => {
          let current: Record<string, string[]> = {};
          try {
            current = JSON.parse(prev.get('filters') ?? '{}') as Record<
              string,
              string[]
            >;
          } catch {
            current = {};
          }
          if (values.length === 0) {
            delete current[attributeKey];
          } else {
            current[attributeKey] = values;
          }
          const encoded = JSON.stringify(current);
          if (encoded === '{}') {
            prev.delete('filters');
          } else {
            prev.set('filters', encoded);
          }
          return prev;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  /** Remove all dynamic attribute filters (clears the `filters` param). */
  const clearFilters = useCallback(() => {
    setSearchParams((prev: URLSearchParams) => {
      prev.delete('filters');
      return prev;
    });
  }, [setSearchParams]);

  return { filters, setFilter, setAttributeFilter, clearFilters };
}
