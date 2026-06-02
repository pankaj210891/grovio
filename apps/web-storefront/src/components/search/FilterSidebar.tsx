import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { X, SlidersHorizontal } from 'lucide-react';
import { apiClient } from '../../lib/api-client.js';
import { useUiStore } from '../../store/ui-store.js';
import { useFilterState } from '../../hooks/useFilterState.js';
import { FilterChip } from '../ui/FilterChip.js';
import { Skeleton } from '../ui/Skeleton.js';
import type { FacetResult } from '@grovio/contracts';

interface FilterSidebarProps {
  categoryId?: string | undefined;
}

/**
 * Filter sidebar / mobile drawer.
 *
 * - Desktop (lg+): fixed left sidebar `w-64`
 * - Mobile: slide-in drawer from left, driven by filterDrawerOpen in ui-store (D-07)
 * - Fetches facet schema from GET /categories/:id/filters when categoryId is present
 * - Selecting a facet value calls setAttributeFilter (writes to URL — D-06)
 * - "Clear all" calls clearFilters; "Show Results" (mobile) closes drawer
 * - Keyboard: Escape closes the drawer (accessibility contract)
 * - T-04-23: filter keys/values are encoded via setAttributeFilter (useSearchParams)
 */
export function FilterSidebar({ categoryId }: FilterSidebarProps) {
  const { filterDrawerOpen, setFilterDrawerOpen } = useUiStore();
  const { filters, setAttributeFilter, clearFilters } = useFilterState();
  const drawerRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  const { data: facets, isLoading: facetsLoading } = useQuery<FacetResult[]>({
    queryKey: ['category-filters', categoryId],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: FacetResult[] }>(`/categories/${categoryId}/filters`)
        .then((r) => r.data),
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
  });

  // Escape key closes the drawer
  useEffect(() => {
    if (!filterDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterDrawerOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filterDrawerOpen, setFilterDrawerOpen]);

  // Focus management: focus the close button when drawer opens
  useEffect(() => {
    if (filterDrawerOpen && firstFocusRef.current) {
      firstFocusRef.current.focus();
    }
  }, [filterDrawerOpen]);

  const hasActiveFilters = Object.keys(filters.activeFilters).length > 0;

  const filterContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-grovio-border">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-grovio-text-muted" aria-hidden="true" />
          <h2 className="text-base font-semibold text-grovio-text">Filters</h2>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-grovio-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 rounded"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="py-3 flex flex-wrap gap-2 border-b border-grovio-border">
          {Object.entries(filters.activeFilters).flatMap(([key, values]) =>
            values.map((value) => (
              <FilterChip
                key={`${key}-${value}`}
                label={value}
                active
                onRemove={() => {
                  const remaining = filters.activeFilters[key]?.filter((v) => v !== value) ?? [];
                  setAttributeFilter(key, remaining);
                }}
              />
            )),
          )}
        </div>
      )}

      {/* Facet groups */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        {facetsLoading && categoryId && (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/6" />
              </div>
            ))}
          </>
        )}
        {!facetsLoading && facets && facets.map((facet) => (
          <div key={facet.key}>
            <p className="text-sm font-semibold text-grovio-text mb-2">{facet.label}</p>
            <div className="flex flex-wrap gap-2">
              {facet.values.map((fv) => {
                const isActive = filters.activeFilters[facet.key]?.includes(fv.value) ?? false;
                return (
                  <FilterChip
                    key={fv.value}
                    label={`${fv.label} (${fv.count})`}
                    active={isActive}
                    onRemove={
                      isActive
                        ? () => {
                            const remaining =
                              filters.activeFilters[facet.key]?.filter((v) => v !== fv.value) ?? [];
                            setAttributeFilter(facet.key, remaining);
                          }
                        : undefined
                    }
                    onClick={
                      !isActive
                        ? () => {
                            const current = filters.activeFilters[facet.key] ?? [];
                            setAttributeFilter(facet.key, [...current, fv.value]);
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        ))}
        {!facetsLoading && !facets && !categoryId && (
          <p className="text-sm text-grovio-text-muted">
            Select a category to see filters.
          </p>
        )}
      </div>

      {/* Mobile "Show Results" button */}
      <div className="pt-4 border-t border-grovio-border lg:hidden">
        <button
          type="button"
          onClick={() => setFilterDrawerOpen(false)}
          className="w-full bg-grovio-primary text-white font-semibold text-base px-6 py-3 rounded-md hover:bg-grovio-primary-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
        >
          Show Results
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — fixed left column, hidden on mobile */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        {filterContent}
      </aside>

      {/* Mobile drawer (AnimatePresence) */}
      <AnimatePresence>
        {filterDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setFilterDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              aria-hidden="true"
            />

            {/* Drawer panel */}
            <motion.div
              key="drawer"
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-grovio-surface-raised shadow-xl p-6 flex flex-col lg:hidden"
            >
              {/* Drawer close button */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-grovio-text-muted" aria-hidden="true" />
                  <span className="text-base font-semibold text-grovio-text">Filters</span>
                </div>
                <button
                  ref={firstFocusRef}
                  type="button"
                  onClick={() => setFilterDrawerOpen(false)}
                  aria-label="Close filters"
                  className="p-1 rounded-md text-grovio-text-muted hover:text-grovio-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filterContent}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
