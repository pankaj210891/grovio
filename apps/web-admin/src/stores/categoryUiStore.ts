/**
 * Zustand UI store for category tree expand/collapse state.
 *
 * Persisted to localStorage so tree expand state survives page refreshes.
 * Store name: "category-ui-state" (matches the configured persist key).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CategoryUiState {
  /** Set of category IDs that are currently expanded in the tree view. */
  expandedIds: Set<string>;
  /** Toggle expand/collapse for a single category node. */
  toggleExpand: (id: string) => void;
  /** Expand a category (idempotent). */
  expand: (id: string) => void;
  /** Collapse a category (idempotent). */
  collapse: (id: string) => void;
}

/**
 * Zustand persist does not serialize Set out of the box.
 * We store expandedIds as a string[] in localStorage and rehydrate as a Set.
 */
type PersistedState = {
  expandedIds: string[];
};

export const useCategoryUiStore = create<CategoryUiState>()(
  persist(
    (set) => ({
      expandedIds: new Set<string>(),

      toggleExpand: (id: string) =>
        set((state) => {
          const next = new Set(state.expandedIds);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return { expandedIds: next };
        }),

      expand: (id: string) =>
        set((state) => {
          if (state.expandedIds.has(id)) return state;
          const next = new Set(state.expandedIds);
          next.add(id);
          return { expandedIds: next };
        }),

      collapse: (id: string) =>
        set((state) => {
          if (!state.expandedIds.has(id)) return state;
          const next = new Set(state.expandedIds);
          next.delete(id);
          return { expandedIds: next };
        }),
    }),
    {
      name: 'category-ui-state',
      // Custom serialization: Set<string> → string[]
      storage: {
        getItem: (name) => {
          const raw = localStorage.getItem(name);
          if (!raw) return null;
          try {
            const parsed = JSON.parse(raw) as { state: PersistedState };
            return {
              state: {
                expandedIds: new Set(parsed.state.expandedIds ?? []),
              },
            };
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          const serializable = {
            state: {
              expandedIds: Array.from((value.state as CategoryUiState).expandedIds),
            },
          };
          localStorage.setItem(name, JSON.stringify(serializable));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);
