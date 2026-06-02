import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Search } from 'lucide-react';
import { apiClient } from '../../lib/api-client.js';
import type { SuggestResponse } from '@grovio/contracts';

/**
 * Search bar with type-ahead suggestions.
 *
 * - Debounced calls to GET /search/suggest?q= for suggestions
 * - Suggestions dropdown: scale/y entrance animation in AnimatePresence
 * - Selecting a suggestion or submitting navigates to /search?q=...
 * - Keyboard accessible: arrow keys navigate suggestions, Escape closes
 * - T-04-23: q is encoded via URLSearchParams (encodeURIComponent)
 */
export function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the query for suggest calls
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebounced(query);
    }, 250);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

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

  const allSuggestions = [
    ...(suggestions?.products.map((p) => ({ type: 'product' as const, name: p.name, slug: p.slug })) ?? []),
    ...(suggestions?.categories.map((c) => ({ type: 'category' as const, name: c.name, slug: c.slug })) ?? []),
  ].slice(0, 8);

  const showDropdown = open && allSuggestions.length > 0 && debounced.length >= 2;

  const navigateToSearch = useCallback(
    (q: string) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      setOpen(false);
      setQuery(q);
      setActiveIndex(-1);
      navigate(`/search?${params.toString()}`);
    },
    [navigate],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateToSearch(query.trim());
  };

  const handleSuggestionClick = (name: string) => {
    navigateToSearch(name);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, allSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const selected = allSuggestions[activeIndex];
      if (selected) navigateToSearch(selected.name);
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
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // Delay so clicks on suggestions register first
              setTimeout(() => setOpen(false), 150);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search for products, brands, and more…"
            aria-label="Search"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-activedescendant={
              activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined
            }
            autoComplete="off"
            className="h-12 w-full rounded-md border border-grovio-border bg-grovio-surface-raised pl-10 pr-4 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:outline-none focus:ring-2 focus:ring-grovio-primary"
          />
        </div>
      </form>

      {/* Suggestions dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.ul
            role="listbox"
            aria-label="Search suggestions"
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 overflow-hidden rounded-md border border-grovio-border bg-grovio-surface-raised shadow-lg"
          >
            {allSuggestions.map((suggestion, index) => (
              <li key={`${suggestion.type}-${suggestion.slug}`} role="option" aria-selected={index === activeIndex}>
                <button
                  id={`suggestion-${index}`}
                  type="button"
                  onMouseDown={() => handleSuggestionClick(suggestion.name)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-100 ${
                    index === activeIndex
                      ? 'bg-grovio-surface text-grovio-primary'
                      : 'text-grovio-text hover:bg-grovio-surface'
                  }`}
                >
                  <Search className="h-3.5 w-3.5 flex-shrink-0 text-grovio-text-muted" aria-hidden="true" />
                  <span className="flex-1 truncate">{suggestion.name}</span>
                  {suggestion.type === 'category' && (
                    <span className="ml-auto flex-shrink-0 text-xs text-grovio-text-muted">
                      Category
                    </span>
                  )}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
