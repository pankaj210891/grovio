/**
 * Checkout hook — server-authoritative checkout state via React Query.
 *
 * Security principle (T-05-04): All monetary values are sourced exclusively
 * from GET /checkout/summary (CHK-04). The UI never computes authoritative
 * totals. walletAppliedMinor sent to server is advisory; server re-validates
 * against actual balance.
 *
 * Checkout wizard flow (D-05):
 *   /checkout/address → /checkout/delivery → /checkout/payment → /checkout/review
 *
 * CheckoutFlowStore (Zustand) holds transient UI-only state: selected address,
 * delivery option, wallet credit request, and coupon code. React Query holds
 * all server-derived state (summary, providers). This split avoids the need for
 * a combined server+UI cache object (D-04 basket data stays in its own store).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { apiClient, ApiError } from '../lib/api-client.js';
import type {
  CheckoutSummary,
  EnabledProviders,
  InitiatePaymentResult,
} from '@grovio/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckoutSummaryResponse {
  success: boolean;
  data: CheckoutSummary;
}

interface EnabledProvidersResponse {
  success: boolean;
  data: EnabledProviders;
}

interface InitiateCheckoutResponse {
  success: boolean;
  data: { reservationIds: string[] };
}

interface ApplyCouponResponse {
  success: boolean;
  data: { code: string; discountMinor: number; scopeDescription: string };
}

interface PlaceOrderResponse {
  success: boolean;
  data: InitiatePaymentResult;
}

// ---------------------------------------------------------------------------
// Checkout flow Zustand store — transient UI state only (not basket data D-04)
// ---------------------------------------------------------------------------

interface CheckoutFlowState {
  /** UUID of the customer address chosen on /checkout/address */
  selectedAddressId: string | null;
  /** Delivery option chosen on /checkout/delivery */
  selectedDeliveryOption: string | null;
  /** Wallet credit amount the user wants to apply (advisory — server re-validates) */
  walletCreditRequested: number;
  /** Applied coupon code from /checkout/apply-coupon, or null if none */
  appliedCouponCode: string | null;
  /** Payment result from POST /checkout/place-order — used to mount Stripe / Razorpay UI */
  paymentResult: InitiatePaymentResult | null;

  setSelectedAddressId: (id: string | null) => void;
  setSelectedDeliveryOption: (option: string | null) => void;
  setWalletCreditRequested: (amount: number) => void;
  setAppliedCouponCode: (code: string | null) => void;
  setPaymentResult: (result: InitiatePaymentResult | null) => void;
  resetFlow: () => void;
}

export const useCheckoutStore = create<CheckoutFlowState>((set) => ({
  selectedAddressId: null,
  selectedDeliveryOption: null,
  walletCreditRequested: 0,
  appliedCouponCode: null,
  paymentResult: null,

  setSelectedAddressId: (id) => set({ selectedAddressId: id }),
  setSelectedDeliveryOption: (option) => set({ selectedDeliveryOption: option }),
  setWalletCreditRequested: (amount) => set({ walletCreditRequested: amount }),
  setAppliedCouponCode: (code) => set({ appliedCouponCode: code }),
  setPaymentResult: (result) => set({ paymentResult: result }),
  resetFlow: () =>
    set({
      selectedAddressId: null,
      selectedDeliveryOption: null,
      walletCreditRequested: 0,
      appliedCouponCode: null,
      paymentResult: null,
    }),
}));

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const CHECKOUT_SUMMARY_KEY = ['checkout', 'summary'] as const;
export const CHECKOUT_PROVIDERS_KEY = ['checkout', 'providers'] as const;

// ---------------------------------------------------------------------------
// useCheckoutSummary — GET /checkout/summary (CHK-04, T-05-04)
// ---------------------------------------------------------------------------

export function useCheckoutSummary() {
  return useQuery<CheckoutSummary | null>({
    queryKey: CHECKOUT_SUMMARY_KEY,
    queryFn: async () => {
      try {
        const res = await apiClient.get<CheckoutSummaryResponse>('/checkout/summary');
        return res.data;
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    staleTime: 1000 * 30,
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// useCheckoutProviders — GET /checkout/providers (D-09)
// ---------------------------------------------------------------------------

export function useCheckoutProviders() {
  return useQuery<EnabledProviders | null>({
    queryKey: CHECKOUT_PROVIDERS_KEY,
    queryFn: async () => {
      try {
        const res = await apiClient.get<EnabledProvidersResponse>('/checkout/providers');
        return res.data;
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    staleTime: 1000 * 60 * 5, // providers change rarely
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// useInitiateCheckout — POST /checkout/initiate (CHK-05, D-06 inventory reserve)
// ---------------------------------------------------------------------------

export function useInitiateCheckout() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: { addressId: string; deliveryOption: string }) =>
      apiClient.post<InitiateCheckoutResponse>('/checkout/initiate', input),

    onSuccess: () => {
      // Invalidate summary so the new shipping total is re-fetched
      void qc.invalidateQueries({ queryKey: CHECKOUT_SUMMARY_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// useApplyCoupon — POST /checkout/apply-coupon (CHK-06, D-17)
// ---------------------------------------------------------------------------

export function useApplyCoupon() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (code: string) =>
      apiClient.post<ApplyCouponResponse>('/checkout/apply-coupon', { code }),

    onSuccess: () => {
      // Re-fetch summary so the updated discount is reflected (CHK-04)
      void qc.invalidateQueries({ queryKey: CHECKOUT_SUMMARY_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// usePlaceOrder — POST /checkout/place-order (CHK-03)
// Returns InitiatePaymentResult with clientSecret (Stripe) or order_id (Razorpay)
// ---------------------------------------------------------------------------

export function usePlaceOrder() {
  return useMutation({
    mutationFn: (input: {
      addressId: string;
      paymentProvider: 'stripe' | 'razorpay';
      walletAppliedMinor: number;
      couponCode?: string | null;
    }) => apiClient.post<PlaceOrderResponse>('/checkout/place-order', input),
  });
}
