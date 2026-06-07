/**
 * CheckoutGuard — step-skip prevention for the checkout wizard (D-05, T-05-DSK).
 *
 * Derives step completion from React Query / Zustand checkout state, never
 * from localStorage (auth principle inherited from useAuth — T-04-18).
 *
 * Step prerequisites:
 *   /checkout/address  → requires authenticated customer + non-empty basket
 *   /checkout/delivery → requires selectedAddressId to be set
 *   /checkout/payment  → requires selectedAddressId + selectedDeliveryOption
 *   /checkout/review   → requires paymentResult (placed order + provider initialized)
 *
 * If the prerequisite is unmet, redirects via <Navigate> to the earliest
 * incomplete step. The guard never blocks if prerequisites are still loading.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useBasket } from '../../hooks/useBasket.js';
import { useCheckoutStore } from '../../hooks/useCheckout.js';

/** Step key type — kept here since CheckoutProgress.tsx is deleted in Phase 11 T7. */
type CheckoutStepKey = 'address' | 'delivery' | 'payment' | 'review';

// ---------------------------------------------------------------------------
// Guard logic
// ---------------------------------------------------------------------------

interface CheckoutGuardProps {
  /** The step this guard instance protects */
  step: CheckoutStepKey;
}

/**
 * Returns the earliest step the customer should be on given current state.
 * Used to redirect when a step's prerequisites are unmet.
 */
function getEarliestAllowedStep(
  isAuthenticated: boolean,
  hasBasketItems: boolean,
  selectedAddressId: string | null,
  selectedDeliveryOption: string | null,
  paymentResult: unknown,
): CheckoutStepKey {
  if (!isAuthenticated || !hasBasketItems) return 'address';
  if (!selectedAddressId) return 'address';
  if (!selectedDeliveryOption) return 'delivery';
  if (!paymentResult) return 'payment';
  return 'review';
}

/**
 * Per-step minimum required step — a guard passes if the earliest allowed
 * step is <= the guarded step's order.
 */
const STEP_ORDER: Record<CheckoutStepKey, number> = {
  address: 0,
  delivery: 1,
  payment: 2,
  review: 3,
};

/**
 * Wraps a checkout step route. If the guard determines the customer has not
 * completed the prerequisites for `step`, redirects to the earliest allowed step.
 */
export function CheckoutGuard({ step }: CheckoutGuardProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { basket, isLoading: basketLoading } = useBasket();
  const { selectedAddressId, selectedDeliveryOption, paymentResult } =
    useCheckoutStore();
  const location = useLocation();

  // While auth or basket is loading, render nothing — avoid flash of redirect
  if (authLoading || basketLoading) {
    return null;
  }

  const hasBasketItems = (basket?.itemCount ?? 0) > 0;

  const earliestAllowed = getEarliestAllowedStep(
    isAuthenticated,
    hasBasketItems,
    selectedAddressId,
    selectedDeliveryOption,
    paymentResult,
  );

  // Guard direction: forward-skip prevention only.
  // Backward navigation (e.g. /payment → /address) is intentionally permitted so
  // customers can correct a wrong address selection. CheckoutAddressPage clears
  // selectedDeliveryOption on continue (WR-02) so re-entry resets the delivery
  // step rather than silently reusing the old reservation.
  if (STEP_ORDER[earliestAllowed] < STEP_ORDER[step]) {
    return (
      <Navigate
        to={`/checkout/${earliestAllowed}`}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <Outlet />;
}

// ---------------------------------------------------------------------------
// Top-level checkout guard (wraps the entire /checkout section)
// ---------------------------------------------------------------------------

/**
 * Top-level guard that simply requires authentication + a non-empty basket.
 * Used as the parent element of the checkout nested routes.
 * Child step guards do the finer-grained prerequisite checks.
 */
export function CheckoutRootGuard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { basket, isLoading: basketLoading, isSuccess: basketSuccess } = useBasket();
  const location = useLocation();

  if (authLoading || basketLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // WR-06: use isSuccess as the "basket loaded" signal so a basket query that
  // returns undefined (error fallback) does not accidentally pass the guard.
  if (basketSuccess && (basket?.itemCount ?? 0) === 0) {
    // Basket loaded and is empty — redirect to cart
    return <Navigate to="/cart" replace />;
  }

  return <Outlet />;
}
