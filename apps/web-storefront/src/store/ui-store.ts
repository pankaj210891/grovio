/**
 * Zustand UI store — ephemeral UI state only.
 *
 * D-06 boundary rule: this store holds ONLY drawer open/close state and the
 * toast notification queue. All filter values, search queries, sort params, and
 * category IDs live in URL search params (useSearchParams). Never put filter
 * state here — doing so would break URL shareability and back-navigation
 * filter restore (RESEARCH.md Pitfall 1).
 */

import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  /** 'info' | 'success' | 'error' */
  variant: 'info' | 'success' | 'error';
}

interface UiState {
  // Filter drawer (mobile — D-07)
  filterDrawerOpen: boolean;
  setFilterDrawerOpen: (open: boolean) => void;

  // Toast notifications
  toasts: Toast[];
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  filterDrawerOpen: false,
  setFilterDrawerOpen: (open) => set({ filterDrawerOpen: open }),

  toasts: [],
  addToast: (toast) => set((s) => ({ toasts: [...s.toasts, toast] })),
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
