/**
 * Vendor Orders page — kanban + bulk ship redesign (Plan 11-03, T4).
 *
 * View toggle: List (default) ↔ Kanban.
 * Bulk ship: select multiple → "Mark as Shipped" modal with tracking number inputs.
 * 30s polling.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import { useUiStore } from '../stores/uiStore.js';
import { useVendorAuthStore } from '../stores/vendorAuthStore.js';
import { OrderKanban } from '../components/orders/OrderKanban.js';

interface VendorOrder {
  id: string;
  orderDisplayId: string;
  status: string;
  customerName: string;
  subtotalMinor: number;
  itemCount?: number;
  createdAt: string;
}

interface OrdersResponse {
  success: boolean;
  data: { orders: VendorOrder[] };
}

interface BulkShipItem {
  orderId: string;
  displayId: string;
  trackingNumber: string;
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

function formatMajor(minorUnits: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(minorUnits / 100);
}

type ViewMode = 'list' | 'kanban';

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const { addToast } = useUiStore();
  const { role } = useVendorAuthStore();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem('grovio:orders-view') as ViewMode) ?? 'list';
    } catch {
      return 'list';
    }
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkShip, setShowBulkShip] = useState(false);
  const [bulkShipItems, setBulkShipItems] = useState<BulkShipItem[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isStaff = role === 'staff';

  const { data, isLoading, error: queryError } = useQuery<VendorOrder[]>({
    queryKey: ['vendorOrders'],
    queryFn: async () => {
      const res = await apiClient.get<OrdersResponse>('/vendor/orders');
      return res.data.orders;
    },
    refetchInterval: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/vendor/orders/${id}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorOrders'] });
    },
  });

  const bulkShipMutation = useMutation({
    mutationFn: (items: { orderId: string; trackingNumber: string }[]) =>
      apiClient.patch('/vendor/orders/bulk-ship', { orders: items }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorOrders'] });
      setShowBulkShip(false);
      setSelectedIds(new Set());
      addToast({ id: Date.now().toString(), message: 'Orders marked as shipped.', variant: 'success' });
    },
    onError: () => {
      addToast({ id: Date.now().toString(), message: 'Failed to update orders.', variant: 'error' });
    },
  });

  useEffect(() => {
    try { localStorage.setItem('grovio:orders-view', viewMode); } catch { /* ignore */ }
  }, [viewMode]);

  function getAvailableTransitions(order: VendorOrder): string[] {
    const allTransitions: Record<string, string[]> = {
      pending: ['processing', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped'],
      shipped: ['delivered'],
    };
    const staffTransitions: Record<string, string[]> = {
      processing: ['shipped'],
      shipped: ['delivered'],
    };
    return (isStaff ? staffTransitions : allTransitions)[order.status] ?? [];
  }

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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openBulkShip() {
    const shippableOrders = (data ?? []).filter(
      (o) => selectedIds.has(o.id) && (o.status === 'processing' || o.status === 'confirmed'),
    );
    setBulkShipItems(
      shippableOrders.map((o) => ({
        orderId: o.id,
        displayId: o.orderDisplayId,
        trackingNumber: '',
      })),
    );
    setShowBulkShip(true);
  }

  function handleBulkShipSubmit() {
    const items = bulkShipItems.map(({ orderId, trackingNumber }) => ({
      orderId,
      trackingNumber: trackingNumber.trim(),
    }));
    bulkShipMutation.mutate(items);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grovio-text">Orders</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">
            View and manage your store orders.
          </p>
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border border-grovio-border bg-grovio-surface p-1 gap-1">
          {(['list', 'kanban'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={[
                'rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                viewMode === mode
                  ? 'bg-grovio-primary text-white'
                  : 'text-grovio-text-muted hover:text-grovio-text',
              ].join(' ')}
            >
              {mode}
            </button>
          ))}
        </div>
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

      {/* Floating bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && viewMode === 'list' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mb-4 flex items-center justify-between rounded-lg border border-grovio-border bg-grovio-surface-raised px-4 py-2.5 shadow-sm"
          >
            <span className="text-sm font-medium text-grovio-text">
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={openBulkShip}
              className="rounded-lg bg-grovio-primary px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Mark as Shipped
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {data && (
        <>
          {viewMode === 'kanban' ? (
            <OrderKanban orders={data} />
          ) : (
            <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
              {data.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-grovio-text-muted">
                  No orders yet.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-grovio-border text-left">
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === data.length && data.length > 0}
                          onChange={() => {
                            if (selectedIds.size === data.length) setSelectedIds(new Set());
                            else setSelectedIds(new Set(data.map((o) => o.id)));
                          }}
                          className="rounded border-grovio-border"
                        />
                      </th>
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
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(order.id)}
                              onChange={() => toggleSelect(order.id)}
                              className="rounded border-grovio-border"
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-grovio-text">
                            {order.orderDisplayId}
                          </td>
                          <td className="px-4 py-3 text-grovio-text">{order.customerName}</td>
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
        </>
      )}

      {/* Bulk Ship Modal */}
      <AnimatePresence>
        {showBulkShip && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBulkShip(false)}
            />
            <motion.div
              key="modal"
              className="fixed inset-x-4 top-1/2 z-50 max-w-lg -translate-y-1/2 rounded-xl border border-grovio-border bg-grovio-surface-raised shadow-2xl sm:left-1/2 sm:-translate-x-1/2"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="border-b border-grovio-border px-6 py-4">
                <h2 className="text-base font-semibold text-grovio-text">
                  Mark Orders as Shipped
                </h2>
                <p className="mt-0.5 text-sm text-grovio-text-muted">
                  Enter tracking numbers for {bulkShipItems.length} order(s).
                </p>
              </div>

              <div className="max-h-80 overflow-y-auto p-6">
                {bulkShipItems.length === 0 ? (
                  <p className="text-sm text-grovio-text-muted">
                    No shippable orders selected. Select orders in "Processing" status.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {bulkShipItems.map((item, idx) => (
                      <div key={item.orderId} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 font-mono text-xs text-grovio-text">
                          #{item.displayId}
                        </span>
                        <input
                          type="text"
                          placeholder="Tracking number (optional)"
                          value={item.trackingNumber}
                          onChange={(e) => {
                            const updated = [...bulkShipItems];
                            if (updated[idx]) updated[idx].trackingNumber = e.target.value;
                            setBulkShipItems(updated);
                          }}
                          className="flex-1 rounded-lg border border-grovio-border bg-grovio-surface px-3 py-1.5 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:border-grovio-primary focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 border-t border-grovio-border px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowBulkShip(false)}
                  className="flex-1 rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text hover:bg-grovio-surface"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkShipMutation.isPending || bulkShipItems.length === 0}
                  onClick={handleBulkShipSubmit}
                  className="flex-1 rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkShipMutation.isPending ? 'Updating…' : `Ship ${bulkShipItems.length} Order(s)`}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
