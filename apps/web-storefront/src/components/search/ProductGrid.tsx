import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useProductSearch } from '../../hooks/useProductSearch.js';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll.js';
import { useFilterState } from '../../hooks/useFilterState.js';
import { ProductCard } from '../ui/ProductCard.js';
import { FilterChip } from '../ui/FilterChip.js';
import { Skeleton } from '../ui/Skeleton.js';

/**
 * Infinite-scroll product grid for PLP / search results.
 *
 * - Uses useProductSearch (useInfiniteQuery) + useInfiniteScroll (sentinel)
 * - Active filter chips row above the grid (FilterChip with × → setAttributeFilter)
 * - Sort dropdown (writes `sort` to URL — D-06)
 * - 2-col mobile / 3-col md / 4-col lg responsive grid
 * - Initial load: 24 card skeletons; next-page: bottom spinner at sentinel
 * - Empty states per UI-SPEC (filters applied vs. no-results for query)
 * - Sentinel is aria-hidden (T-04-23: screen readers see loaded product count)
 */

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
] as const;

const formatPrice = (priceMinor: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(priceMinor / 100);

interface ProductGridProps {
  /** When passed, a "back to all results" affordance replaces category empty state */
  emptyStateType?: 'filters' | 'query' | 'category';
  /** Category name for the category empty state copy */
  categoryName?: string | undefined;
}

export function ProductGrid({
  emptyStateType = 'query',
  categoryName,
}: ProductGridProps) {
  const { filters, setFilter, setAttributeFilter, clearFilters } = useFilterState();

  const {
    data,
    status,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useProductSearch();

  const { sentinelRef } = useInfiniteScroll(fetchNextPage, hasNextPage ?? false, isFetchingNextPage);

  const allHits = data?.pages.flatMap((page) => page.hits) ?? [];
  const isInitialLoading = status === 'pending';
  const isError = status === 'error';
  const hasActiveFilters = Object.keys(filters.activeFilters).length > 0;

  // Reset active index: activeFilters is in URL, no need to watch

  const activeFilterEntries = Object.entries(filters.activeFilters).flatMap(
    ([key, values]) => values.map((value) => ({ key, value })),
  );

  return (
    <div className="flex-1 min-w-0">
      {/* Sort + active filter chips toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Sort dropdown */}
        <div className="relative ml-auto flex-shrink-0">
          <label htmlFor="sort-select" className="sr-only">Sort by</label>
          <div className="relative">
            <select
              id="sort-select"
              value={filters.sort}
              onChange={(e) => setFilter('sort', e.target.value)}
              className="appearance-none h-10 pl-3 pr-8 text-sm font-medium text-grovio-text bg-grovio-surface-raised border border-grovio-border rounded-md focus:outline-none focus:ring-2 focus:ring-grovio-primary cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-grovio-text-muted"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterEntries.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4" role="list" aria-label="Active filters">
          {activeFilterEntries.map(({ key, value }) => (
            <FilterChip
              key={`${key}-${value}`}
              label={value}
              active
              onRemove={() => {
                const remaining = filters.activeFilters[key]?.filter((v) => v !== value) ?? [];
                setAttributeFilter(key, remaining);
              }}
            />
          ))}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm text-grovio-text-muted hover:text-grovio-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 rounded"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Initial loading skeleton — 24 cards */}
      {isInitialLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-[4/5] w-full" />
              <Skeleton className="h-4 w-3/4 mt-2" />
              <Skeleton className="h-4 w-1/2 mt-1" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="py-16 text-center">
          <p className="text-grovio-text">
            We're having trouble connecting. Check your connection and try again.
          </p>
        </div>
      )}

      {/* Product grid */}
      {!isInitialLoading && !isError && (
        <>
          {allHits.length === 0 ? (
            /* Empty states */
            <div className="py-16 text-center space-y-3">
              {hasActiveFilters || emptyStateType === 'filters' ? (
                <>
                  <p className="text-lg font-semibold text-grovio-text">
                    No products match your filters
                  </p>
                  <p className="text-sm text-grovio-text-muted">
                    Try removing some filters or clearing all to see more results.
                  </p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-2 bg-grovio-primary text-white font-semibold px-6 py-3 rounded-md hover:bg-grovio-primary-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
                  >
                    Clear all filters
                  </button>
                </>
              ) : emptyStateType === 'category' ? (
                <>
                  <p className="text-lg font-semibold text-grovio-text">
                    Nothing here yet
                  </p>
                  <p className="text-sm text-grovio-text-muted">
                    {categoryName
                      ? `${categoryName} is still being stocked. Check back soon.`
                      : 'This category is still being stocked. Check back soon.'}
                  </p>
                  <Link
                    to="/search"
                    className="mt-2 inline-block bg-grovio-primary text-white font-semibold px-6 py-3 rounded-md hover:bg-grovio-primary-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
                  >
                    Browse all products
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-grovio-text">
                    No results{filters.q ? ` for '${filters.q}'` : ''}
                  </p>
                  <p className="text-sm text-grovio-text-muted">
                    Check your spelling, or try a more general term.
                  </p>
                  <Link
                    to="/"
                    className="mt-2 inline-block bg-grovio-primary text-white font-semibold px-6 py-3 rounded-md hover:bg-grovio-primary-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
                  >
                    Browse categories
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {allHits.map((hit) => (
                <ProductCard
                  key={hit.id}
                  slug={hit.slug}
                  name={hit.name}
                  priceMajor={formatPrice(hit.basePriceMinor)}
                  vendorName=""
                  imageUrl={hit.imageUrl ?? undefined}
                />
              ))}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} aria-hidden="true" className="h-4" />

          {/* Next-page loading spinner */}
          {isFetchingNextPage && (
            <div className="flex justify-center py-6" aria-hidden="true">
              <Loader2 className="h-6 w-6 animate-spin text-grovio-primary" aria-hidden="true" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
