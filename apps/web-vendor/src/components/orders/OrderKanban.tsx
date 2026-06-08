/**
 * OrderKanban — 5-column read-only kanban board (Plan 11-03, T4).
 *
 * Columns: New, Processing, Shipped, Delivered, Return Requested.
 * Cards: order ID, customer, items, total, age.
 * Status changes via action buttons (not drag).
 */

import { motion } from 'motion/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient.js';
import { useUiStore } from '../../stores/uiStore.js';
import { useVendorAuthStore } from '../../stores/vendorAuthStore.js';

interface VendorOrder {
  id: string;
  orderDisplayId: string;
  status: string;
  customerName: string;
  subtotalMinor: number;
  itemCount?: number;
  createdAt: string;
}

interface Props {
  orders: VendorOrder[];
}

const COLUMNS = [
  { key: 'pending', label: 'New', color: 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/30' },
  { key: 'processing', label: 'Processing', color: 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800/30' },
  { key: 'shipped', label: 'Shipped', color: 'bg-cyan-50 border-cyan-200 dark:bg-cyan-900/10 dark:border-cyan-800/30' },
  { key: 'delivered', label: 'Delivered', color: 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800/30' },
  { key: 'return_requested', label: 'Return Requested', color: 'bg-orange-50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-800/30' },
];

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped'],
  shipped: ['delivered'],
  return_requested: [], // handled via approve/reject
};

const STAFF_TRANSITIONS: Record<string, string[]> = {
  processing: ['shipped'],
  shipped: ['delivered'],
};

function formatMajor(minor: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function OrderKanban({ orders }: Props) {
  const queryClient = useQueryClient();
  const { addToast } = useUiStore();
  const { role } = useVendorAuthStore();
  const isStaff = role === 'staff';

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/vendor/orders/${id}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorOrders'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/vendor/returns/${id}/approve`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorOrders'] });
      addToast({ id: Date.now().toString(), message: 'Return approved.', variant: 'success' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/vendor/returns/${id}/reject`, { rejectionReason: 'Rejected by vendor' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorOrders'] });
      addToast({ id: Date.now().toString(), message: 'Return rejected.', variant: 'success' });
    },
  });

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 min-w-max pb-2">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.key);
          return (
            <div key={col.key} className={`w-64 rounded-xl border ${col.color} flex flex-col`}>
              <div className="flex items-center justify-between px-3 py-2.5">
                <h3 className="text-sm font-semibold text-grovio-text">{col.label}</h3>
                <span className="rounded-full bg-grovio-surface px-2 py-0.5 text-xs font-medium text-grovio-text-muted">
                  {colOrders.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {colOrders.length === 0 && (
                  <div className="rounded-lg border border-dashed border-grovio-border p-4 text-center text-xs text-grovio-text-muted">
                    No orders
                  </div>
                )}
                {colOrders.map((order) => {
                  const transitions = isStaff
                    ? STAFF_TRANSITIONS[order.status] ?? []
                    : STATUS_TRANSITIONS[order.status] ?? [];

                  return (
                    <motion.div
                      key={order.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <p className="font-mono text-xs font-medium text-grovio-primary">
                          #{order.orderDisplayId}
                        </p>
                        <span className="text-xs text-grovio-text-muted">
                          {timeAgo(order.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-grovio-text">
                        {order.customerName}
                      </p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-xs text-grovio-text-muted">
                          {order.itemCount ?? '?'} items
                        </span>
                        <span className="text-sm font-bold text-grovio-text">
                          {formatMajor(order.subtotalMinor)}
                        </span>
                      </div>

                      {/* Action buttons */}
                      {transitions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {transitions.map((status) => (
                            <button
                              key={status}
                              type="button"
                              disabled={updateMutation.isPending}
                              onClick={() => {
                                updateMutation.mutate({ id: order.id, status });
                                addToast({
                                  id: Date.now().toString(),
                                  message: `Order marked as ${status}.`,
                                  variant: 'success',
                                });
                              }}
                              className="rounded-md border border-grovio-border bg-grovio-surface px-2 py-0.5 text-xs font-medium text-grovio-text hover:bg-grovio-primary hover:text-white transition-colors capitalize disabled:opacity-50"
                            >
                              → {status.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Return actions */}
                      {order.status === 'return_requested' && !isStaff && (
                        <div className="mt-2 flex gap-1">
                          <button
                            type="button"
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate(order.id)}
                            className="flex-1 rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={rejectMutation.isPending}
                            onClick={() => rejectMutation.mutate(order.id)}
                            className="flex-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
