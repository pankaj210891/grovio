import { create } from 'zustand';

/**
 * Comparison store — client-side product comparison (T3).
 *
 * Tracks up to 3 product IDs for side-by-side comparison.
 * Auto-cleared when navigating away from CategoryPage (via useEffect in CategoryPage).
 *
 * Max 3 products enforced by addProduct (noop if already 3 and id not in list).
 */

interface ComparisonState {
  selectedProductIds: string[];
  addProduct: (id: string) => void;
  removeProduct: (id: string) => void;
  clear: () => void;
}

export const useComparisonStore = create<ComparisonState>((set, get) => ({
  selectedProductIds: [],

  addProduct: (id: string) => {
    const { selectedProductIds } = get();
    if (selectedProductIds.includes(id)) return; // already in list
    if (selectedProductIds.length >= 3) return;   // max 3
    set({ selectedProductIds: [...selectedProductIds, id] });
  },

  removeProduct: (id: string) => {
    set((s) => ({ selectedProductIds: s.selectedProductIds.filter((pid) => pid !== id) }));
  },

  clear: () => set({ selectedProductIds: [] }),
}));
