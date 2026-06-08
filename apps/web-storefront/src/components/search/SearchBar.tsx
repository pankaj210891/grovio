import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Search, Clock, TrendingUp, Camera, Mic } from 'lucide-react';
import { apiClient } from '../../lib/api-client.js';
import { useUiStore } from '../../store/ui-store.js';
import type { SuggestResponse } from '@grovio/contracts';

/**
 * Enhanced search bar with:
 * - Search history dropdown (last 5 queries from localStorage)
 * - Popular searches from GET /search/popular
 * - Category-grouped typeahead suggestions (categoryName on each suggestion)
 * - Camera / voice icons (non-functional, show Toast)
 * - History persistence on search submit (max 5, newest first, deduped)
 *
 * T5 enhancements over Phase 4 SearchBar:
 * - On focus: shows history + popular searches when query is empty
 * - Suggestions now group by categoryName
 * - Camera/voice icons in search bar
 */

const HISTORY_KEY = 'search_history';
const MAX_HISTORY = 5;

function getHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveToHistory(query: string): void {
  try {
    const trimmed = query.trim();
    if (!trimmed) return;
    const existing = getHistory().filter((q) => q !== trimmed);
    const updated = [trimmed, ...existing].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

export function SearchBar() {
  const navigate = useNavigate();
  const addToast = useUiStore((s) => s.addToast);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce query
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebounced(query), 250);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [query]);

  // Typeahead suggestions
  const { data: suggestions } = useQuery<SuggestResponse>({
    queryKey: ['search', 'suggest', debounced],
    queryFn: () => {
      const params = new URLSearchParams({ q: debounced });
      return apiClient
        .get<{ success: boolean; data: SuggestResponse }>(`/search/suggest?${params.toString()}`)
        .then((r) => r.data);
    },
    enabled: debounced.length >= 2,
    staleTime: 30 * 1000,
  });

  // Popular searches
  const { data: popularSearches } = useQuery<string[]>({
    queryKey: ['search', 'popular'],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: string[] }>('/search/popular')
        .then((r) => r.data),
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  // Group suggestions by category
  interface GroupedSuggestion {
    type: 'product' | 'category';
    name: string;
    slug: string;
    categoryName?: string | undefined;
  }

  const allSuggestions: GroupedSuggestion[] = [
    ...(suggestions?.products.map((p) => ({
      type: 'product' as const,
      name: p.name,
      slug: p.slug,
      categoryName: p.categoryName,
    })) ?? []),
    ...(suggestions?.categories.map((c) => ({
      type: 'category' as const,
      name: c.name,
      slug: c.slug,
    })) ?? []),
  ].slice(0, 8);

  // Group products by categoryName for display
  const categoryGroups: Record<string, GroupedSuggestion[]> = {};
  const uncategorized: GroupedSuggestion[] = [];

  for (const s of allSuggestions) {
    if (s.type === 'product' && s.categoryName) {
      const catName = s.categoryName;
      const group = categoryGroups[catName];
      if (!group) {
        categoryGroups[catName] = [s];
      } else {
        group.push(s);
      }
    } else {
      uncategorized.push(s);
    }
  }

  const showSuggestions = open && debounced.length >= 2 && allSuggestions.length > 0;
  const showHistory = open && debounced.length < 2 && history.length > 0;
  const showPopular = open && debounced.length < 2 && (popularSearches?.length ?? 0) > 0;
  const showDropdown = showSuggestions || showHistory || showPopular;

  // Build flat list of clickable items for keyboard nav
  const flatItems: { type: 'history' | 'popular' | 'suggestion'; value: string }[] = [];
  if (showHistory) {
    history.forEach((h) => flatItems.push({ type: 'history', value: h }));
  }
  if (showPopular) {
    (popularSearches ?? []).slice(0, 5).forEach((p) => flatItems.push({ type: 'popular', value: p }));
  }
  if (showSuggestions) {
    allSuggestions.forEach((s) => flatItems.push({ type: 'suggestion', value: s.name }));
  }

  const navigateToSearch = useCallback(
    (q: string) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      setOpen(false);
      setQuery(q);
      setActiveIndex(-1);
      saveToHistory(q);
      setHistory(getHistory());
      void navigate(`/search?${params.toString()}`);
    },
    [navigate],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateToSearch(query.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const selected = flatItems[activeIndex];
      if (selected) navigateToSearch(selected.value);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit} role="search" aria-label="Search products">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-grovio-text-muted pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => {
              setHistory(getHistory());
              setOpen(true);
            }}
            onBlur={() => { setTimeout(() => setOpen(false), 150); }}
            onKeyDown={handleKeyDown}
            placeholder="Search for products, brands, and more…"
            aria-label="Search"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-activedescendant={activeIndex >= 0 ? `search-item-${activeIndex}` : undefined}
            autoComplete="off"
            className="h-12 w-full rounded-md border border-grovio-border bg-grovio-surface-raised pl-10 pr-20 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:outline-none focus:ring-2 focus:ring-grovio-primary"
          />

          {/* Camera + Voice icon buttons */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-1">
            <button
              type="button"
              aria-label="Search by image"
              onClick={() => addToast({ id: crypto.randomUUID(), message: 'Image search coming soon.', variant: 'info' })}
              className="p-1.5 text-grovio-text-muted hover:text-grovio-text transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Search by voice"
              onClick={() => addToast({ id: crypto.randomUUID(), message: 'Voice search coming soon.', variant: 'info' })}
              className="p-1.5 text-grovio-text-muted hover:text-grovio-text transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary"
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </form>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            role="listbox"
            aria-label="Search suggestions"
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 overflow-hidden rounded-md border border-grovio-border bg-grovio-surface-raised shadow-lg max-h-80 overflow-y-auto"
          >
            {/* History section */}
            {showHistory && (
              <div>
                <p className="px-4 pt-3 pb-1 text-xs font-medium text-grovio-text-muted uppercase tracking-wider">
                  Recent searches
                </p>
                {history.map((h, index) => {
                  const flatIndex = flatItems.findIndex((fi) => fi.type === 'history' && fi.value === h);
                  return (
                    <button
                      id={`search-item-${flatIndex}`}
                      key={h}
                      type="button"
                      role="option"
                      aria-selected={flatIndex === activeIndex}
                      onMouseDown={() => navigateToSearch(h)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-100 ${
                        flatIndex === activeIndex
                          ? 'bg-grovio-surface text-grovio-primary'
                          : 'text-grovio-text hover:bg-grovio-surface'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5 flex-shrink-0 text-grovio-text-muted" aria-hidden="true" />
                      <span className="flex-1 truncate">{h}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Popular searches section */}
            {showPopular && (
              <div className={showHistory ? 'border-t border-grovio-border' : ''}>
                <p className="px-4 pt-3 pb-1 text-xs font-medium text-grovio-text-muted uppercase tracking-wider">
                  Popular searches
                </p>
                {(popularSearches ?? []).slice(0, 5).map((term) => {
                  const flatIndex = flatItems.findIndex((fi) => fi.type === 'popular' && fi.value === term);
                  return (
                    <button
                      id={`search-item-${flatIndex}`}
                      key={term}
                      type="button"
                      role="option"
                      aria-selected={flatIndex === activeIndex}
                      onMouseDown={() => navigateToSearch(term)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-100 ${
                        flatIndex === activeIndex
                          ? 'bg-grovio-surface text-grovio-primary'
                          : 'text-grovio-text hover:bg-grovio-surface'
                      }`}
                    >
                      <TrendingUp className="h-3.5 w-3.5 flex-shrink-0 text-grovio-text-muted" aria-hidden="true" />
                      <span className="flex-1 truncate">{term}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Category-grouped suggestions */}
            {showSuggestions && (
              <>
                {/* Uncategorized / category items first */}
                {uncategorized.map((suggestion) => {
                  const flatIndex = flatItems.findIndex((fi) => fi.type === 'suggestion' && fi.value === suggestion.name);
                  return (
                    <button
                      id={`search-item-${flatIndex}`}
                      key={`${suggestion.type}-${suggestion.slug}`}
                      type="button"
                      role="option"
                      aria-selected={flatIndex === activeIndex}
                      onMouseDown={() => navigateToSearch(suggestion.name)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-100 ${
                        flatIndex === activeIndex
                          ? 'bg-grovio-surface text-grovio-primary'
                          : 'text-grovio-text hover:bg-grovio-surface'
                      }`}
                    >
                      <Search className="h-3.5 w-3.5 flex-shrink-0 text-grovio-text-muted" aria-hidden="true" />
                      <span className="flex-1 truncate">{suggestion.name}</span>
                      {suggestion.type === 'category' && (
                        <span className="ml-auto flex-shrink-0 text-xs text-grovio-text-muted">Category</span>
                      )}
                    </button>
                  );
                })}

                {/* Category-grouped product suggestions */}
                {Object.entries(categoryGroups).map(([catName, catSuggestions]) => (
                  <div key={catName}>
                    <p className="px-4 pt-2 pb-1 text-xs font-medium text-grovio-text-muted uppercase tracking-wider border-t border-grovio-border">
                      {catName}
                    </p>
                    {catSuggestions.map((suggestion) => {
                      const flatIndex = flatItems.findIndex((fi) => fi.type === 'suggestion' && fi.value === suggestion.name);
                      return (
                        <button
                          id={`search-item-${flatIndex}`}
                          key={`${suggestion.type}-${suggestion.slug}`}
                          type="button"
                          role="option"
                          aria-selected={flatIndex === activeIndex}
                          onMouseDown={() => navigateToSearch(suggestion.name)}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-100 ${
                            flatIndex === activeIndex
                              ? 'bg-grovio-surface text-grovio-primary'
                              : 'text-grovio-text hover:bg-grovio-surface'
                          }`}
                        >
                          <Search className="h-3.5 w-3.5 flex-shrink-0 text-grovio-text-muted" aria-hidden="true" />
                          <span className="flex-1 truncate">{suggestion.name}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
