import { PageTransition } from '../components/layout/PageTransition.js';
import { FilterSidebar } from '../components/search/FilterSidebar.js';
import { ProductGrid } from '../components/search/ProductGrid.js';
import { SearchBar } from '../components/search/SearchBar.js';
import { useUiStore } from '../store/ui-store.js';
import { useFilterState } from '../hooks/useFilterState.js';
import { SlidersHorizontal } from 'lucide-react';

/**
 * Search / Product Listing Page (/search).
 *
 * Full PLP driven entirely by URL params (q/filters/sort/categoryId — D-06).
 * Renders:
 *   - SearchBar context (the header also has one, but the search page shows
 *     a prominent search bar above the results)
 *   - Mobile "Filters" button above grid (opens FilterSidebar drawer)
 *   - FilterSidebar (left on desktop, slide-in drawer on mobile)
 *   - ProductGrid (infinite-scroll, sort dropdown, removable filter chips)
 *
 * State is 100% URL-driven — no Zustand filter state (D-06).
 * STORE-03.
 */
export default function SearchPage() {
  const { filterDrawerOpen, setFilterDrawerOpen } = useUiStore();
  const { filters } = useFilterState();

  return (
    <PageTransition>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page title — single h1 */}
        <h1 className="sr-only">
          {filters.q ? `Search results for "${filters.q}"` : 'All Products'}
        </h1>

        {/* Prominent search bar */}
        <div className="mb-6">
          <SearchBar />
        </div>

        {/* Search context heading */}
        {filters.q && (
          <p className="text-sm text-grovio-text-muted mb-4">
            Showing results for{' '}
            <span className="font-semibold text-grovio-text">"{filters.q}"</span>
          </p>
        )}

        {/* Mobile "Filters" button */}
        <div className="flex items-center justify-between mb-4 lg:hidden">
          <button
            type="button"
            onClick={() => setFilterDrawerOpen(true)}
            aria-label="Open filters"
            aria-expanded={filterDrawerOpen}
            className="inline-flex items-center gap-2 text-sm font-medium text-grovio-text border border-grovio-border rounded-md px-4 py-2 bg-grovio-surface-raised hover:border-grovio-primary hover:text-grovio-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 min-h-[48px]"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters
          </button>
        </div>

        {/* Main layout: sidebar + product grid */}
        <div className="flex gap-8">
          <FilterSidebar categoryId={filters.categoryId || undefined} />
          <ProductGrid emptyStateType={filters.q ? 'query' : 'filters'} />
        </div>
      </div>
    </PageTransition>
  );
}
