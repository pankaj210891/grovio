/**
 * Basket hook — server-authoritative basket state via React Query (D-04).
 *
 * Security principle (T-05-06): basket state is driven by server responses
 * keyed by the httpOnly grovio_basket_token cookie. The cookie is NOT readable
 * by JS — apiClient sends credentials:'include' so the browser attaches it
 * automatically. Basket totals displayed here are informational; all totals
 * are re-computed server-side at checkout (CHK-04, T-05-UI).
 *
 * Basket query key: ['basket']
 * All mutations call onSettled → invalidate(['basket']) so server state is
 * always the source of truth after any optimistic update.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../lib/api-client.js';
import type { Basket } from '@grovio/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BasketResponse {
  success: boolean;
  data: Basket;
}

export interface AddToBasketVars {
  productId: string;
  productVariantId?: string | null;
  quantity: number;
}

export interface UpdateBasketItemVars {
  itemId: string;
  quantity: number;
}

// ---------------------------------------------------------------------------
// Basket query key — single source of truth
// ---------------------------------------------------------------------------

export const BASKET_QUERY_KEY = ['basket'] as const;

// ---------------------------------------------------------------------------
// useBasket — basket data + item count convenience
// ---------------------------------------------------------------------------

export function useBasket() {
  const { data: basket, isLoading, isError } = useQuery<Basket | null>({
    queryKey: BASKET_QUERY_KEY,
    queryFn: async () => {
      try {
        const res = await apiClient.get<BasketResponse>('/basket');
        return res.data;
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 404) {
          // No basket session yet — not an error, return null
          return null;
        }
        throw err;
      }
    },
    staleTime: 1000 * 30, // 30s — basket changes frequently
    retry: false,
  });

  const itemCount = basket?.itemCount ?? 0;

  return {
    basket,
    isLoading,
    isError,
    itemCount,
  };
}

// ---------------------------------------------------------------------------
// useAddToBasket — POST /basket/items (optimistic itemCount bump, D-04)
// ---------------------------------------------------------------------------

export function useAddToBasket() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (vars: AddToBasketVars) =>
      apiClient.post<BasketResponse>('/basket/items', {
        productId: vars.productId,
        productVariantId: vars.productVariantId ?? null,
        quantity: vars.quantity,
      }),

    onMutate: async (vars) => {
      // Cancel in-flight basket queries to avoid overwriting our optimistic update
      await qc.cancelQueries({ queryKey: BASKET_QUERY_KEY });
      const previous = qc.getQueryData<Basket | null>(BASKET_QUERY_KEY);

      // Optimistic: bump itemCount in the header badge (Pattern 8, D-04)
      qc.setQueryData<Basket | null>(BASKET_QUERY_KEY, (old) =>
        old
          ? { ...old, itemCount: old.itemCount + vars.quantity }
          : old,
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      // Roll back optimistic update on failure
      if (context?.previous !== undefined) {
        qc.setQueryData(BASKET_QUERY_KEY, context.previous);
      }
    },

    onSettled: () => {
      // Always reconcile with server state after add (success or failure)
      void qc.invalidateQueries({ queryKey: BASKET_QUERY_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateBasketItem — PATCH /basket/items/:id
// ---------------------------------------------------------------------------

export function useUpdateBasketItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, quantity }: UpdateBasketItemVars) =>
      apiClient.patch<BasketResponse>(`/basket/items/${itemId}`, { quantity }),

    onSettled: () => {
      void qc.invalidateQueries({ queryKey: BASKET_QUERY_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// useRemoveBasketItem — DELETE /basket/items/:id
// ---------------------------------------------------------------------------

export function useRemoveBasketItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) =>
      apiClient.delete<{ success: boolean }>(`/basket/items/${itemId}`),

    onMutate: async (itemId) => {
      await qc.cancelQueries({ queryKey: BASKET_QUERY_KEY });
      const previous = qc.getQueryData<Basket | null>(BASKET_QUERY_KEY);

      // Optimistic: remove item from local basket state immediately
      qc.setQueryData<Basket | null>(BASKET_QUERY_KEY, (old) => {
        if (!old) return old;
        const removedItem = old.items.find((i) => i.id === itemId);
        const removedQty = removedItem?.quantity ?? 0;
        const newItems = old.items.filter((i) => i.id !== itemId);
        const newCount = Math.max(0, old.itemCount - removedQty);
        return {
          ...old,
          items: newItems,
          itemCount: newCount,
          subtotalMinor: old.subtotalMinor - (removedItem?.lineSubtotalMinor ?? 0),
          groupedByVendor: old.groupedByVendor
            .map((g) => ({
              ...g,
              items: g.items.filter((i) => i.id !== itemId),
              vendorSubtotalMinor:
                g.vendorSubtotalMinor - (removedItem?.lineSubtotalMinor ?? 0),
            }))
            .filter((g) => g.items.length > 0),
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(BASKET_QUERY_KEY, context.previous);
      }
    },

    onSettled: () => {
      void qc.invalidateQueries({ queryKey: BASKET_QUERY_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// useMergeBasket — POST /basket/merge (CHK-02 guest-to-auth merge)
// ---------------------------------------------------------------------------

export function useMergeBasket() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiClient.post<BasketResponse>('/basket/merge'),

    onSettled: () => {
      void qc.invalidateQueries({ queryKey: BASKET_QUERY_KEY });
    },
  });
}
