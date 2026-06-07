import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { PageTransition } from '../components/layout/PageTransition.js';
import { FilterSidebar } from '../components/search/FilterSidebar.js';
import { ProductGrid } from '../components/search/ProductGrid.js';
import { FilterChip } from '../components/ui/FilterChip.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { Button } from '../components/ui/Button.js';
import { useFilterState } from '../hooks/useFilterState.js';
import { useUiStore } from '../store/ui-store.js';
import { useComparisonStore } from '../stores/useComparisonStore.js';
import { apiClient } from '../lib/api-client.js';
import { SlidersHorizontal, LayoutGrid, LayoutList } from 'lucide-react';
import type { CategoryTreeResponse } from '@grovio/contracts';

export type PlpView = 'grid' | 'list';
const PLP_VIEW_KEY = 'pref_plp_view';

/**
 * Category landing page (/category/:slug).
 *
 * Resolves the category by slug via GET /categories, sets the active categoryId
 * in the URL (D-06 — URL-serialized filter state), renders:
 *   - category heading (<h1>)
 *   - subcategory chips row
 *   - FilterSidebar (with category-specific filters)
 *   - ProductGrid (infinite-scroll products for this category)
 *
 * Empty state: "Nothing here yet" / "This category is still being stocked." (STORE-02)
 */
export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { filters, setFilter, setAttributeFilter } = useFilterState();
  const { filterDrawerOpen, setFilterDrawerOpen } = useUiStore();
  const clearComparison = useComparisonStore((s) => s.clear);

  // Auto-clear comparison tray when leaving CategoryPage
  useEffect(() => {
    return () => {
      clearComparison();
    };
  }, [clearComparison, location.pathname]);

  // View preference persisted in localStorage
  const [plpView, setPlpView] = useState<PlpView>(() => {
    try {
      const stored = localStorage.getItem(PLP_VIEW_KEY);
      return (stored === 'list' ? 'list' : 'grid') as PlpView;
    } catch {
      return 'grid';
    }
  });

  function handleViewChange(v: PlpView) {
    setPlpView(v);
    try { localStorage.setItem(PLP_VIEW_KEY, v); } catch { /* ignore */ }
  }

  // Active filter chips derived from URL search params
  const activeChips = Object.entries(filters.activeFilters).flatMap(([key, values]) =>
    values.map((value) => ({ key, value })),
  );

  // Fetch category tree to resolve the slug
  const { data: categoryTree, isLoading, isError, refetch } = useQuery<CategoryTreeResponse>({
    queryKey: ['categories'],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: CategoryTreeResponse }>('/categories')
        .then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  // Flatten tree to find the category matching the slug
  function flattenTree(nodes: CategoryTreeResponse['tree']): CategoryTreeResponse['tree'][number][] {
    const result: CategoryTreeResponse['tree'][number][] = [];
    for (const node of nodes) {
      result.push(node);
      if (node.children.length > 0) {
        result.push(...flattenTree(node.children));
      }
    }
    return result;
  }

  const allCategories = categoryTree ? flattenTree(categoryTree.tree) : [];
  const category = allCategories.find((c) => c.slug === slug);
  const subcategories = category ? allCategories.filter((c) => c.parentId === category.id) : [];

  // Guard against rendering ProductGrid before categoryId is synced to URL (CR-06).
  // Without this check, ProductGrid fires a search with no categoryId on the first
  // render, fetching uncategorized results that are immediately discarded.
  const isGridReady = category != null && filters.categoryId === category.id;

  // Sync categoryId to URL when category is resolved
  useEffect(() => {
    if (category && filters.categoryId !== category.id) {
      setFilter('categoryId', category.id);
    }
  }, [category, filters.categoryId, setFilter]);

  return (
    <PageTransition>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Loading state */}
        {isLoading && (
          <>
            <Skeleton className="h-8 w-48 mb-6" />
            <div className="flex gap-2 mb-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-24 rounded-full" />
              ))}
            </div>
            <div className="flex gap-8">
              <div className="hidden lg:block w-64 flex-shrink-0 space-y-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
              <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 24 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[4/5] w-full" />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Error state */}
        {isError && (
          <div className="py-16 text-center space-y-4">
            <p className="text-grovio-text">
              We're having trouble loading this category.
            </p>
            <Button variant="primary" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        )}

        {/* Not found state */}
        {!isLoading && !isError && !category && (
          <div className="py-16 text-center space-y-4">
            <h1 className="text-xl font-semibold text-grovio-text">
              Category not found
            </h1>
            <Link to="/" className="text-grovio-primary hover:underline">
              Back to home
            </Link>
          </div>
        )}

        {/* Loaded state */}
        {!isLoading && !isError && category && (
          <>
            {/* Category heading — single h1 */}
            <h1 className="text-xl font-semibold text-grovio-text mb-4">
              {category.name}
            </h1>

            {/* Subcategory chips */}
            {subcategories.length > 0 && (
              <div
                className="flex gap-2 overflow-x-auto pb-2 mb-6"
                role="list"
                aria-label="Subcategories"
              >
                {subcategories.map((sub) => (
                  <Link
                    key={sub.id}
                    to={`/category/${sub.slug}`}
                    role="listitem"
                    className="flex-shrink-0 inline-flex items-center rounded-full bg-grovio-surface border border-grovio-border text-grovio-text text-sm font-medium px-4 py-1.5 hover:border-grovio-primary hover:text-grovio-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
                  >
                    {sub.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Toolbar row: mobile filters button + view toggle */}
            <div className="flex items-center justify-between mb-4 gap-3">
              {/* Mobile "Filters" button — hidden on desktop */}
              <button
                type="button"
                onClick={() => setFilterDrawerOpen(true)}
                aria-label="Open filters"
                aria-expanded={filterDrawerOpen}
                className="lg:hidden inline-flex items-center gap-2 text-sm font-medium text-grovio-text border border-grovio-border rounded-md px-4 py-2 bg-grovio-surface-raised hover:border-grovio-primary hover:text-grovio-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 min-h-[48px]"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Filters
                {activeChips.length > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-grovio-primary text-white text-[10px] font-bold">
                    {activeChips.length}
                  </span>
                )}
              </button>

              {/* View toggle: grid / list */}
              <div
                className="ml-auto flex items-center gap-1 rounded-md border border-grovio-border bg-grovio-surface-raised p-0.5"
                role="group"
                aria-label="Product list view"
              >
                <button
                  type="button"
                  onClick={() => handleViewChange('grid')}
                  aria-pressed={plpView === 'grid'}
                  aria-label="Grid view"
                  className={`flex items-center justify-center p-2 rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-1 ${
                    plpView === 'grid'
                      ? 'bg-grovio-primary text-white'
                      : 'text-grovio-text-muted hover:text-grovio-text'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => handleViewChange('list')}
                  aria-pressed={plpView === 'list'}
                  aria-label="List view"
                  className={`flex items-center justify-center p-2 rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-1 ${
                    plpView === 'list'
                      ? 'bg-grovio-primary text-white'
                      : 'text-grovio-text-muted hover:text-grovio-text'
                  }`}
                >
                  <LayoutList className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Active filter chips strip — horizontal scrollable row above product grid */}
            {activeChips.length > 0 && (
              <div
                className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide"
                aria-label="Active filters"
              >
                {activeChips.map(({ key, value }) => (
                  <FilterChip
                    key={`${key}-${value}`}
                    label={value}
                    active
                    onRemove={() => {
                      const remaining = (filters.activeFilters[key] ?? []).filter((v) => v !== value);
                      setAttributeFilter(key, remaining);
                    }}
                  />
                ))}
              </div>
            )}

            {/* Main layout: sidebar + product grid */}
            <div className="flex gap-8">
              <FilterSidebar categoryId={category.id} />
              {isGridReady && (
                <ProductGrid
                  emptyStateType="category"
                  categoryName={category.name}
                  view={plpView}
                />
              )}
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
