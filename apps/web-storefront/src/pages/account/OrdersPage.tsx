/**
 * OrdersPage — /account/orders (ORD-03)
 *
 * Displays a list of all customer orders with:
 * - Display ID, date, status badge, grand total
 * - Loading skeletons / empty / error states (AddressesPage analog)
 * - Links to order detail page
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageTransition } from '../../components/layout/PageTransition.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { apiClient } from '../../lib/api-client.js';
import type { Order, OrderStatus } from '@grovio/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderListResponse {
  success: boolean;
  data: { orders: Order[] };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMinor(minor: number): string {
  return `₹${(minor / 100).toFixed(2)}`;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Pending payment',
  payment_received: 'Payment received',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending_payment: 'bg-yellow-100 text-yellow-800',
  payment_received: 'bg-blue-100 text-blue-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function OrdersPage() {
  const { data: orders, isLoading, isError } = useQuery<Order[]>({
    queryKey: ['account', 'orders'],
    queryFn: async () => {
      const res = await apiClient.get<OrderListResponse>('/account/orders');
      return res.data.orders;
    },
  });

  return (
    <PageTransition>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-xl font-semibold text-grovio-text mb-8">My Orders</h1>

        {/* Loading skeleton */}
        {isLoading && (
          <div aria-busy="true" aria-label="Loading orders…" className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        )}

        {/* Error */}
        {isError && (
          <p className="text-sm text-grovio-error" role="alert">
            We&apos;re having trouble loading your orders. Please refresh and try again.
          </p>
        )}

        {/* Empty */}
        {!isLoading && !isError && orders && orders.length === 0 && (
          <div className="text-center py-16">
            <p className="text-base font-semibold text-grovio-text">No orders yet</p>
            <p className="text-sm text-grovio-text-muted mt-1">
              Your orders will appear here once you place one.
            </p>
          </div>
        )}

        {/* Order list */}
        {!isLoading && !isError && orders && orders.length > 0 && (
          <div className="flex flex-col gap-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                to={`/account/orders/${order.id}`}
                className="block rounded-lg border border-grovio-border bg-grovio-surface-raised p-4 hover:border-grovio-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-grovio-text">{order.displayId}</p>
                    <p className="text-xs text-grovio-text-muted mt-0.5">
                      {formatDate(order.createdAt)}
                    </p>
                    <p className="text-xs text-grovio-text-muted mt-0.5">
                      {order.vendorOrders.reduce((sum, vo) => sum + vo.items.length, 0)} item
                      {order.vendorOrders.reduce((sum, vo) => sum + vo.items.length, 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span
                      className={[
                        'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                        STATUS_COLORS[order.status],
                      ].join(' ')}
                    >
                      {STATUS_LABELS[order.status]}
                    </span>
                    <p className="text-sm font-semibold text-grovio-text">
                      {formatMinor(order.grandTotalMinor)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
