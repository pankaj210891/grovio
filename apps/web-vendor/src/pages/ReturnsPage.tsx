/**
 * Vendor Returns page (VEN-04, D-16).
 *
 * Lists return_requests for vendor sub-orders: GET /vendor/returns.
 * Per-row actions:
 *   Approve (optional note)  → POST /vendor/returns/:id/approve
 *   Reject (required reason) → POST /vendor/returns/:id/reject
 *
 * Reject button disabled until reason is non-empty.
 * Manager + owner only (backend enforces; UI hides for staff).
 */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import { useUiStore } from '../stores/uiStore.js';
import { useVendorAuthStore } from '../stores/vendorAuthStore.js';
import { hasRole } from '../hooks/useVendorAuth.js';

interface ReturnRequest {
  id: string;
  orderDisplayId: string;
  customerName: string;
  status: string;
  reason: string;
  refundPreference: 'wallet' | 'payment';
  amountMinor: number;
  createdAt: string;
}

interface ReturnsResponse {
  success: boolean;
  data: { returns: ReturnRequest[] };
}

type PanelMode = 'approve' | 'reject';

interface ActionPanel {
  returnRequest: ReturnRequest;
  mode: PanelMode;
}

function formatMajor(minorUnits: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minorUnits / 100);
}

export default function ReturnsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useUiStore();
  const { role } = useVendorAuthStore();

  const [panel, setPanel] = useState<ActionPanel | null>(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');

  const canManage = hasRole(role, 'manager');

  const { data, isLoading, error: queryError } = useQuery<ReturnRequest[]>({
    queryKey: ['vendorReturns'],
    queryFn: async () => {
      const res = await apiClient.get<ReturnsResponse>('/vendor/returns');
      return res.data.returns;
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      apiClient.post(`/vendor/returns/${id}/approve`, note ? { note } : {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorReturns'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/vendor/returns/${id}/reject`, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorReturns'] });
    },
  });

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault();
    if (!panel) return;
    try {
      const approveArgs: { id: string; note?: string } = { id: panel.returnRequest.id };
      if (note) approveArgs.note = note;
      await approveMutation.mutateAsync(approveArgs);
      addToast({ id: Date.now().toString(), message: 'Return approved.', variant: 'success' });
      setPanel(null);
    } catch {
      addToast({ id: Date.now().toString(), message: 'Failed to approve return.', variant: 'error' });
    }
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    if (!panel || !reason.trim()) return;
    try {
      await rejectMutation.mutateAsync({ id: panel.returnRequest.id, reason: reason.trim() });
      addToast({ id: Date.now().toString(), message: 'Return rejected.', variant: 'success' });
      setPanel(null);
    } catch {
      addToast({ id: Date.now().toString(), message: 'Failed to reject return.', variant: 'error' });
    }
  }

  function openPanel(returnRequest: ReturnRequest, mode: PanelMode) {
    setPanel({ returnRequest, mode });
    setNote('');
    setReason('');
  }

  const pending = data?.filter((r) => r.status === 'return_requested') ?? [];
  const resolved = data?.filter((r) => r.status !== 'return_requested') ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-grovio-text">Returns</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">
          Review and action return requests from customers.
        </p>
      </div>

      {!canManage && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          You have read-only access. Manager or owner role required to approve or reject returns.
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {queryError && (
        <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
          Failed to load returns:{' '}
          {queryError instanceof Error ? queryError.message : 'Unknown error'}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Pending section */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-grovio-text">
              Pending ({pending.length})
            </h2>
            <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
              {pending.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-grovio-text-muted">
                  No pending return requests.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-grovio-border text-left">
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Order</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Customer</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Amount</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Reason</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Refund via</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grovio-border">
                    {pending.map((ret) => (
                      <tr key={ret.id} className="hover:bg-grovio-surface/50">
                        <td className="px-4 py-3 font-mono text-xs text-grovio-text">
                          {ret.orderDisplayId}
                        </td>
                        <td className="px-4 py-3 text-grovio-text">{ret.customerName}</td>
                        <td className="px-4 py-3 text-grovio-text">
                          {formatMajor(ret.amountMinor)}
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="truncate text-grovio-text-muted" title={ret.reason}>
                            {ret.reason}
                          </p>
                        </td>
                        <td className="px-4 py-3 capitalize text-grovio-text-muted">
                          {ret.refundPreference}
                        </td>
                        <td className="px-4 py-3">
                          {canManage && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openPanel(ret, 'approve')}
                                className="rounded-md px-3 py-1 text-xs font-medium text-green-600 transition-colors hover:bg-green-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => openPanel(ret, 'reject')}
                                className="rounded-md px-3 py-1 text-xs font-medium text-grovio-error transition-colors hover:bg-grovio-error/10"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Resolved section */}
          {resolved.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-grovio-text">
                Resolved ({resolved.length})
              </h2>
              <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-grovio-border text-left">
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Order</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Status</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Amount</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grovio-border">
                    {resolved.map((ret) => (
                      <tr key={ret.id} className="hover:bg-grovio-surface/50">
                        <td className="px-4 py-3 font-mono text-xs text-grovio-text">
                          {ret.orderDisplayId}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={[
                              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                              ret.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-600',
                            ].join(' ')}
                          >
                            {ret.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-grovio-text">
                          {formatMajor(ret.amountMinor)}
                        </td>
                        <td className="px-4 py-3 text-grovio-text-muted">
                          {new Date(ret.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Approve / Reject slide-over */}
      <AnimatePresence>
        {panel && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPanel(null)}
            />
            <motion.div
              key="panel"
              className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-grovio-border bg-grovio-surface-raised shadow-xl"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-grovio-border px-6 py-4">
                  <h2 className="text-base font-semibold text-grovio-text capitalize">
                    {panel.mode === 'approve' ? 'Approve Return' : 'Reject Return'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setPanel(null)}
                    className="text-grovio-text-muted transition-colors hover:text-grovio-text"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="px-6 py-4 border-b border-grovio-border">
                  <p className="text-sm text-grovio-text-muted">
                    Order: <span className="font-mono font-medium text-grovio-text">{panel.returnRequest.orderDisplayId}</span>
                  </p>
                  <p className="mt-1 text-sm text-grovio-text-muted">
                    Amount: <span className="font-medium text-grovio-text">{formatMajor(panel.returnRequest.amountMinor)}</span>
                  </p>
                  <p className="mt-1 text-sm text-grovio-text-muted">
                    Customer reason: <span className="text-grovio-text">{panel.returnRequest.reason}</span>
                  </p>
                </div>

                {panel.mode === 'approve' ? (
                  <form
                    onSubmit={(e) => void handleApprove(e)}
                    className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-6"
                  >
                    <div>
                      <label
                        htmlFor="approve-note"
                        className="mb-1 block text-sm font-medium text-grovio-text"
                      >
                        Note{' '}
                        <span className="text-xs font-normal text-grovio-text-muted">
                          (optional)
                        </span>
                      </label>
                      <textarea
                        id="approve-note"
                        rows={3}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Add a note for the customer…"
                        className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:border-grovio-primary focus:outline-none"
                      />
                    </div>
                    <div className="mt-auto flex gap-3">
                      <button
                        type="button"
                        onClick={() => setPanel(null)}
                        className="flex-1 rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text transition-colors hover:bg-grovio-surface"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={approveMutation.isPending}
                        className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {approveMutation.isPending ? 'Approving…' : 'Approve Return'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form
                    onSubmit={(e) => void handleReject(e)}
                    className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-6"
                  >
                    <div>
                      <label
                        htmlFor="reject-reason"
                        className="mb-1 block text-sm font-medium text-grovio-text"
                      >
                        Rejection reason <span className="text-grovio-error">*</span>
                      </label>
                      <textarea
                        id="reject-reason"
                        rows={4}
                        required
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Explain why this return is being rejected…"
                        className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:border-grovio-primary focus:outline-none"
                      />
                    </div>
                    <div className="mt-auto flex gap-3">
                      <button
                        type="button"
                        onClick={() => setPanel(null)}
                        className="flex-1 rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text transition-colors hover:bg-grovio-surface"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={rejectMutation.isPending || !reason.trim()}
                        className="flex-1 rounded-lg bg-grovio-error px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {rejectMutation.isPending ? 'Rejecting…' : 'Reject Return'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
