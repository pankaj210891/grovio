/**
 * OrderDetailPage — /account/orders/:id (ORD-04)
 *
 * Phase 11 T8 enhancements:
 * - Visual order timeline: vertical step list with icons + timestamps
 * - Reorder All: adds all order items back to basket via POST /basket/items
 * - Invoice Download: GET /orders/:id/invoice (Wave 5a PDF endpoint)
 *
 * Displays full order detail:
 * - Order header (ID, date, overall status)
 * - Visual timeline (placed, processing, shipped, delivered/cancelled)
 * - Items grouped by vendor sub-order
 * - Order totals
 * - "Request return" for eligible delivered items
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  Circle,
  Truck,
  Package,
  Clock,
  XCircle,
  RotateCcw,
  Download,
  Loader2,
} from 'lucide-react';
import { PageTransition } from '../../components/layout/PageTransition.js';
import { Button } from '../../components/ui/Button.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { SeoHead } from '../../components/seo/SeoHead.js';
import { apiClient, ApiError } from '../../lib/api-client.js';
import { useUiStore } from '../../store/ui-store.js';
import { BASKET_QUERY_KEY } from '../../hooks/useBasket.js';
import type { Order, OrderStatus } from '@grovio/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderResponse {
  success: boolean;
  data: Order;
}

interface ReturnRequestInput {
  orderItemIds: string[];
  reason: string;
  refundPreference: 'wallet' | 'original';
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

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
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
// Order timeline
// ---------------------------------------------------------------------------

interface TimelineStep {
  key: OrderStatus;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
}

const TIMELINE_STEPS: TimelineStep[] = [
  { key: 'pending_payment', label: 'Placed', icon: Clock },
  { key: 'processing', label: 'Processing', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

const STATUS_TO_TIMELINE_INDEX: Record<OrderStatus, number> = {
  pending_payment: 0,
  payment_received: 0,
  processing: 1,
  shipped: 2,
  delivered: 3,
  cancelled: -1, // special case
};

interface OrderTimelineProps {
  status: OrderStatus;
  createdAt: string;
}

function OrderTimeline({ status, createdAt }: OrderTimelineProps) {
  const currentIndex = STATUS_TO_TIMELINE_INDEX[status] ?? 0;
  const isCancelled = status === 'cancelled';

  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
        <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-red-700">Order Cancelled</p>
          <p className="text-xs text-red-500">Placed on {formatDate(createdAt)}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col gap-0"
      role="list"
      aria-label="Order status timeline"
    >
      {TIMELINE_STEPS.map((step, index) => {
        const isCompleted = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const Icon = step.icon;

        return (
          <div key={step.key} role="listitem" className="flex gap-4">
            {/* Icon column with vertical connector */}
            <div className="flex flex-col items-center">
              <motion.div
                initial={isCurrent ? { scale: 0.8 } : false}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isCompleted
                    ? 'border-grovio-primary bg-grovio-primary text-white'
                    : 'border-grovio-border bg-grovio-surface text-grovio-text-muted'
                } ${isCurrent ? 'ring-4 ring-grovio-primary/20' : ''}`}
                aria-hidden="true"
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </motion.div>

              {/* Connector line */}
              {index < TIMELINE_STEPS.length - 1 && (
                <div
                  className={`w-0.5 h-8 mt-0.5 transition-colors ${
                    index < currentIndex ? 'bg-grovio-primary' : 'bg-grovio-border'
                  }`}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* Step content */}
            <div className="pb-6 min-w-0">
              <p className={`text-sm font-semibold ${isCompleted ? 'text-grovio-text' : 'text-grovio-text-muted'}`}>
                {step.label}
              </p>
              {isCompleted && index === 0 && (
                <p className="text-xs text-grovio-text-muted">{formatDateTime(createdAt)}</p>
              )}
              {isCurrent && index > 0 && (
                <p className="text-xs text-grovio-primary">In progress</p>
              )}
              {!isCompleted && (
                <p className="text-xs text-grovio-text-muted">Pending</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Return request dialog (unchanged from Phase 5)
// ---------------------------------------------------------------------------

interface ReturnDialogProps {
  orderId: string;
  orderItemIds: string[];
  onClose: () => void;
}

function ReturnDialog({ orderId, orderItemIds, onClose }: ReturnDialogProps) {
  const qc = useQueryClient();
  const addToast = useUiStore((s) => s.addToast);
  const [reason, setReason] = useState('');
  const [preference, setPreference] = useState<'wallet' | 'original'>('wallet');
  const [error, setError] = useState('');

  const returnMutation = useMutation({
    mutationFn: (body: ReturnRequestInput) =>
      apiClient.post<{ success: boolean }>(`/account/orders/${orderId}/return-request`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['account', 'orders', orderId] });
      addToast({ id: crypto.randomUUID(), message: 'Return request submitted.', variant: 'success' });
      onClose();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 422) {
        setError('This order is not eligible for return.');
      } else if (err instanceof ApiError && err.status === 501) {
        setError('Refund to original payment is not yet supported. Please choose wallet credit.');
      } else {
        setError("We couldn't submit your return. Please try again.");
      }
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setError('Please provide a reason for the return.'); return; }
    setError('');
    returnMutation.mutate({ orderItemIds, reason, refundPreference: preference });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Request return"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -4 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-sm rounded-lg bg-grovio-surface-raised border border-grovio-border p-6 shadow-lg"
      >
        <h2 className="text-base font-semibold text-grovio-text mb-4">Request return</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="return-reason" className="block text-sm text-grovio-text mb-1">
              Reason for return
            </label>
            <textarea
              id="return-reason"
              rows={3}
              className="w-full rounded border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text resize-none focus:outline-none focus-visible:ring-1 focus-visible:ring-grovio-primary"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={returnMutation.isPending}
              placeholder="Describe why you want to return this item…"
            />
          </div>

          <div>
            <p className="text-sm text-grovio-text mb-2">Refund preference</p>
            <div className="flex flex-col gap-2">
              {(['wallet', 'original'] as const).map((p) => (
                <label key={p} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="refund-preference"
                    value={p}
                    checked={preference === p}
                    onChange={() => setPreference(p)}
                    className="accent-grovio-primary"
                    disabled={returnMutation.isPending}
                  />
                  <span className="text-grovio-text">
                    {p === 'wallet' ? 'Wallet credit (instant)' : 'Original payment method'}
                  </span>
                  {p === 'original' && (
                    <span className="text-xs text-grovio-text-muted">(coming soon)</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-grovio-error" role="alert">{error}</p>}

          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={returnMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={returnMutation.isPending}>
              {returnMutation.isPending ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnItemIds, setReturnItemIds] = useState<string[]>([]);
  const [isReordering, setIsReordering] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const addToast = useUiStore((s) => s.addToast);
  const qc = useQueryClient();

  const { data: order, isLoading, isError } = useQuery<Order | null>({
    queryKey: ['account', 'orders', id],
    queryFn: async () => {
      if (!id) return null;
      try {
        const res = await apiClient.get<OrderResponse>(`/account/orders/${id}`);
        return res.data;
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!id,
  });

  async function handleReorderAll() {
    if (!order) return;
    setIsReordering(true);

    try {
      const allItems = order.vendorOrders.flatMap((vo) => vo.items);
      await Promise.all(
        allItems.map((item) =>
          apiClient.post('/basket/items', {
            productId: item.productId,
            productVariantId: null,
            quantity: item.quantity,
          }),
        ),
      );
      await qc.invalidateQueries({ queryKey: BASKET_QUERY_KEY });
      addToast({ id: crypto.randomUUID(), message: 'All items added to cart!', variant: 'success' });
      window.location.href = '/cart';
    } catch {
      addToast({ id: crypto.randomUUID(), message: 'Could not reorder some items. Please try again.', variant: 'error' });
    } finally {
      setIsReordering(false);
    }
  }

  async function handleDownloadInvoice() {
    if (!id) return;
    setIsDownloadingInvoice(true);
    try {
      const response = await fetch(`${import.meta.env['VITE_API_URL'] as string ?? ''}/orders/${id}/invoice`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Invoice not available');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${order?.displayId ?? id}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      addToast({ id: crypto.randomUUID(), message: 'Invoice not available yet. Please try again later.', variant: 'error' });
    } finally {
      setIsDownloadingInvoice(false);
    }
  }

  function handleRequestReturn(itemIds: string[]) {
    setReturnItemIds(itemIds);
    setShowReturnDialog(true);
  }

  return (
    <PageTransition>
      <SeoHead
        title={order ? `Order ${order.displayId} | Grovio` : 'Order Detail | Grovio'}
        noIndex
      />
      <div className="max-w-screen-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Loading */}
        {isLoading && (
          <div aria-busy="true" aria-label="Loading order…" className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        )}

        {/* Error */}
        {isError && (
          <p className="text-sm text-grovio-error" role="alert">
            We couldn&apos;t load this order. Please try again.
          </p>
        )}

        {/* Order detail */}
        {!isLoading && !isError && order && (
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-grovio-text">{order.displayId}</h1>
                <p className="text-sm text-grovio-text-muted mt-1">
                  Placed on {formatDate(order.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                {/* Invoice download */}
                <Button
                  type="button"
                  variant="secondary"
                  className="text-sm px-3 py-1.5 flex items-center gap-1.5"
                  onClick={() => { void handleDownloadInvoice(); }}
                  disabled={isDownloadingInvoice}
                >
                  {isDownloadingInvoice ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Invoice
                </Button>

                <span
                  className={[
                    'inline-block px-2 py-1 rounded-full text-xs font-medium',
                    STATUS_COLORS[order.status],
                  ].join(' ')}
                >
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
            </div>

            {/* Visual order timeline */}
            <div className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-5">
              <h2 className="text-sm font-semibold text-grovio-text mb-4">Order Status</h2>
              <OrderTimeline status={order.status} createdAt={order.createdAt} />
            </div>

            {/* Items grouped by vendor */}
            {order.vendorOrders.map((vendorOrder) => {
              const isDelivered = vendorOrder.status === 'delivered';
              const allItemIds = vendorOrder.items.map((i) => i.id);

              return (
                <div
                  key={vendorOrder.id}
                  className="rounded-lg border border-grovio-border bg-grovio-surface-raised overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-grovio-border flex items-center justify-between gap-4 bg-grovio-surface">
                    <p className="text-xs font-semibold text-grovio-text-muted uppercase tracking-wide">
                      {vendorOrder.vendorName}
                    </p>
                    <span
                      className={[
                        'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                        STATUS_COLORS[vendorOrder.status],
                      ].join(' ')}
                    >
                      {STATUS_LABELS[vendorOrder.status]}
                    </span>
                  </div>

                  <div className="p-4 flex flex-col gap-3">
                    {vendorOrder.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-grovio-text truncate">{item.productName}</p>
                          <p className="text-xs text-grovio-text-muted">
                            Qty: {item.quantity} · {formatMinor(item.unitPriceMinor)} each
                          </p>
                        </div>
                        <p className="text-sm font-medium text-grovio-text flex-shrink-0">
                          {formatMinor(item.lineSubtotalMinor)}
                        </p>
                      </div>
                    ))}

                    <div className="pt-2 border-t border-grovio-border flex justify-between text-sm">
                      <span className="text-grovio-text-muted">Vendor subtotal</span>
                      <span className="font-medium text-grovio-text">
                        {formatMinor(vendorOrder.vendorSubtotalMinor)}
                      </span>
                    </div>

                    {isDelivered && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="self-start text-sm px-3 py-1.5 mt-1"
                        onClick={() => handleRequestReturn(allItemIds)}
                      >
                        Request return
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

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

            {/* Reorder All */}
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => { void handleReorderAll(); }}
                disabled={isReordering}
                className="flex items-center gap-2"
              >
                {isReordering ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                )}
                {isReordering ? 'Adding to cart…' : 'Reorder All'}
              </Button>
            </div>
          </div>
        )}

        {/* Not found */}
        {!isLoading && !isError && !order && (
          <p className="text-sm text-grovio-text-muted">Order not found.</p>
        )}

        {/* Return dialog */}
        <AnimatePresence>
          {showReturnDialog && id && (
            <ReturnDialog
              key="return-dialog"
              orderId={id}
              orderItemIds={returnItemIds}
              onClose={() => setShowReturnDialog(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
