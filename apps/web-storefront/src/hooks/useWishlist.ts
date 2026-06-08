/**
 * useWishlist — wishlist state management hooks.
 *
 * Uses React Query for server state with optimistic updates.
 * Guest users are redirected to login on toggle attempts.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client.js';
import { useAuth } from './useAuth.js';

interface WishlistStatusResponse {
  items: Record<string, boolean>;
}

interface WishlistItem {
  productId: string;
  productName: string;
  priceMajor: string;
  imageUrl: string | null;
  slug: string;
  isPriceDropped: boolean;
}

interface WishlistResponse {
  items: WishlistItem[];
}

/** Fetch wishlist status for an array of product IDs. */
export function useWishlistStatus(productIds: string[]) {
  const { isAuthenticated } = useAuth();

  return useQuery<Record<string, boolean>>({
    queryKey: ['wishlist', 'status', productIds.slice().sort().join(',')],
    queryFn: async () => {
      if (productIds.length === 0) return {};
      const res = await apiClient.get<{ success: boolean; data: WishlistStatusResponse }>(
        `/wishlist/status?productIds=${productIds.join(',')}`,
      );
      return res.data.items;
    },
    enabled: isAuthenticated && productIds.length > 0,
    staleTime: 0, // Always fresh
  });
}

/** Toggle wishlist status for a single product (optimistic). */
export function useWishlistToggle() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      isWishlisted,
    }: {
      productId: string;
      isWishlisted: boolean;
    }) => {
      if (!isAuthenticated) throw new Error('auth_required');
      if (isWishlisted) {
        await apiClient.delete(`/wishlist/${productId}`);
      } else {
        await apiClient.post(`/wishlist/${productId}`, {});
      }
    },
    onMutate: async ({ productId, isWishlisted }) => {
      // Optimistic update: flip the status in all status queries
      await queryClient.cancelQueries({ queryKey: ['wishlist', 'status'] });

      const previousData = queryClient.getQueriesData<Record<string, boolean>>({
        queryKey: ['wishlist', 'status'],
      });

      queryClient.setQueriesData<Record<string, boolean>>(
        { queryKey: ['wishlist', 'status'] },
        (old) => {
          if (!old) return old;
          return { ...old, [productId]: !isWishlisted };
        },
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      // Roll back on error
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });
}

/** Fetch all wishlisted products for the account page. */
export function useWishlist() {
  const { isAuthenticated } = useAuth();

  return useQuery<WishlistItem[]>({
    queryKey: ['wishlist', 'items'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: WishlistResponse }>(
        '/account/wishlist',
      );
      return res.data.items;
    },
    enabled: isAuthenticated,
    staleTime: 0,
  });
}
