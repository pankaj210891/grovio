/**
 * Vendor Orders page (VEN-04).
 *
 * Lists vendor sub-orders via GET /vendor/orders.
 * Status update via PATCH /vendor/orders/:id.
 * Staff can mark shipped/delivered only; manager/owner see all actions.
 *
 * Money in major units.
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import { useUiStore } from '../stores/uiStore.js';
import { useVendorAuthStore } from '../stores/vendorAuthStore.js';

interface VendorOrder {
  id: string;
  orderDisplayId: string;
  status: string;
  customerName: string;
  subtotalMinor: number;
  createdAt: string;
}

interface OrdersResponse {
  success: boolean;
  data: { orders: VendorOrder[] };
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700',
  shipped: 'bg-cyan-100 text-cyan-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  return_requested: 'bg-orange-100 text-orange-700',
};

function formatMajor(minorUnits: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minorUnits / 100);
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const { addToast } = useUiStore();
  const { role } = useVendorAuthStore();

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isStaff = role === 'staff';

  const { data, isLoading, error: queryError } = useQuery<VendorOrder[]>({
    queryKey: ['vendorOrders'],
    queryFn: async () => {
      const res = await apiClient.get<OrdersResponse>('/vendor/orders');
      return res.data.orders;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/vendor/orders/${id}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorOrders'] });
    },
  });

  async function handleStatusChange(order: VendorOrder, newStatus: string) {
    setUpdatingId(order.id);
    try {
      await updateMutation.mutateAsync({ id: order.id, status: newStatus });
      addToast({ id: Date.now().toString(), message: 'Order status updated.', variant: 'success' });
    } catch {
      addToast({ id: Date.now().toString(), message: 'Failed to update order.', variant: 'error' });
    } finally {
      setUpdatingId(null);
    }
  }

  function getAvailableTransitions(order: VendorOrder): string[] {
    const allTransitions: Record<string, string[]> = {
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped'],
      shipped: ['delivered'],
    };
    const staffTransitions: Record<string, string[]> = {
      processing: ['shipped'],
      shipped: ['delivered'],
    };
    const transitions = isStaff ? staffTransitions : allTransitions;
    return transitions[order.status] ?? [];
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-grovio-text">Orders</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">
          View and manage your store orders.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {queryError && (
        <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
          Failed to load orders:{' '}
          {queryError instanceof Error ? queryError.message : 'Unknown error'}
        </div>
      )}

      {data && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          {data.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-grovio-text-muted">
              No orders yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grovio-border text-left">
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Order ID</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Customer</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Status</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Subtotal</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-grovio-border">
                {data.map((order) => {
                  const transitions = getAvailableTransitions(order);
                  return (
                    <tr key={order.id} className="hover:bg-grovio-surface/50">
                      <td className="px-4 py-3 font-mono text-xs text-grovio-text">
                        {order.orderDisplayId}
                      </td>
                      <td className="px-4 py-3 text-grovio-text">
                        {order.customerName}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                            STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600',
                          ].join(' ')}
                        >
                          {order.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-grovio-text">
                        {formatMajor(order.subtotalMinor)}
                      </td>
                      <td className="px-4 py-3 text-grovio-text-muted">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {transitions.length > 0 && (
                          <div className="flex gap-1">
                            {transitions.map((status) => (
                              <button
                                key={status}
                                type="button"
                                disabled={updatingId === order.id}
                                onClick={() => void handleStatusChange(order, status)}
                                className="rounded-md px-2.5 py-1 text-xs font-medium text-grovio-primary transition-colors hover:bg-grovio-primary/10 disabled:cursor-not-allowed disabled:opacity-50 capitalize"
                              >
                                {status.replace('_', ' ')}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </motion.div>
  );
}
