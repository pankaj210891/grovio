/**
 * OrderConfirmationPage — /order-confirmation/:orderId (ORD-01)
 *
 * Fetches the placed order and shows:
 * - Order display ID
 * - Grouped vendor items + line totals
 * - Order totals
 * - Success motion entrance animation
 *
 * This page is the return_url target for Stripe's confirmPayment redirect
 * and the handler destination for Razorpay's success callback.
 */

import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { PageTransition } from '../components/layout/PageTransition.js';
import { Button } from '../components/ui/Button.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { apiClient, ApiError } from '../lib/api-client.js';
import { useCheckoutStore } from '../hooks/useCheckout.js';
import type { Order } from '@grovio/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderResponse {
  success: boolean;
  data: Order;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMinor(minor: number): string {
  return `₹${(minor / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function OrderConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const resetFlow = useCheckoutStore((s) => s.resetFlow);

  const {
    data: order,
    isLoading,
    isError,
  } = useQuery<Order | null>({
    queryKey: ['checkout', 'confirmation', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      try {
        const res = await apiClient.get<OrderResponse>(`/account/orders/${orderId}`);
        return res.data;
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!orderId,
    retry: false,
  });

  // Reset checkout flow state once the confirmed order loads successfully.
  // This must live in useEffect (not queryFn) because queryFn must be a pure
  // function — side effects in queryFn fire on every background refetch and
  // can race with CheckoutGuard (CR-01).
  useEffect(() => {
    if (order) {
      resetFlow();
    }
  }, [order, resetFlow]);

  return (
    <PageTransition>
      <div className="max-w-screen-md mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Loading */}
        {isLoading && (
          <div aria-busy="true" aria-label="Loading order…" className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        )}

        {/* Error */}
        {isError && (
          <p className="text-sm text-grovio-error" role="alert">
            We couldn&apos;t load your order. Please check your orders page.
          </p>
        )}

        {/* Success */}
        {!isLoading && !isError && order && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="flex flex-col gap-6"
          >
            {/* Success header */}
            <div className="text-center py-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"
              >
                <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </motion.div>
              <h1 className="text-2xl font-bold text-grovio-text">Order confirmed!</h1>
              <p className="text-grovio-text-muted mt-1">
                Order <span className="font-medium text-grovio-text">{order.displayId}</span>
              </p>
            </div>

            {/* Items grouped by vendor */}
            <div className="flex flex-col gap-4">
              {order.vendorOrders.map((vendorOrder) => (
                <div
                  key={vendorOrder.id}
                  className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-4"
                >
                  <p className="text-xs font-semibold text-grovio-text-muted uppercase tracking-wide mb-3">
                    {vendorOrder.vendorName}
                  </p>
                  <div className="flex flex-col gap-2">
                    {vendorOrder.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-grovio-text truncate">{item.productName}</p>
                          <p className="text-xs text-grovio-text-muted">Qty: {item.quantity}</p>
                        </div>
                        <p className="text-sm font-medium text-grovio-text flex-shrink-0">
                          {formatMinor(item.lineSubtotalMinor)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-grovio-border flex justify-between text-sm">
                    <span className="text-grovio-text-muted">Vendor subtotal</span>
                    <span className="font-medium text-grovio-text">
                      {formatMinor(vendorOrder.vendorSubtotalMinor)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Order totals */}
            <div className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-5">
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-grovio-text-muted">Subtotal</span>
                  <span>{formatMinor(order.subtotalMinor)}</span>
                </div>
                {order.shippingMinor > 0 && (
                  <div className="flex justify-between">
                    <span className="text-grovio-text-muted">Shipping</span>
                    <span>{formatMinor(order.shippingMinor)}</span>
                  </div>
                )}
                {order.discountMinor > 0 && (
                  <div className="flex justify-between">
                    <span className="text-grovio-text-muted">Discount</span>
                    <span className="text-green-600">-{formatMinor(order.discountMinor)}</span>
                  </div>
                )}
                {order.walletAppliedMinor > 0 && (
                  <div className="flex justify-between">
                    <span className="text-grovio-text-muted">Wallet credit</span>
                    <span className="text-green-600">-{formatMinor(order.walletAppliedMinor)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-grovio-border flex justify-between font-semibold">
                  <span>Total paid</span>
                  <span>{formatMinor(order.grandTotalMinor)}</span>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/account/orders" className="flex-1">
                <Button type="button" variant="primary" className="w-full">
                  View my orders
                </Button>
              </Link>
              <Link to="/" className="flex-1">
                <Button type="button" variant="secondary" className="w-full">
                  Continue shopping
                </Button>
              </Link>
            </div>
          </motion.div>
        )}

        {/* Not found */}
        {!isLoading && !isError && !order && (
          <div className="text-center py-16">
            <p className="text-grovio-text-muted">Order not found.</p>
            <Link to="/account/orders">
              <Button type="button" variant="secondary" className="mt-4">
                View all orders
              </Button>
            </Link>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
