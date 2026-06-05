/**
 * PayoutManagementPage — per-vendor payout ledger + settlement recording (MKT-04, D-08).
 *
 * Flow:
 * 1. Select vendor from dropdown → GET /admin/vendors (for selector list)
 * 2. Load payout data → GET /admin/vendors/:vendorId/payouts
 * 3. Summary strip: earned / reversed / net / settled / outstanding (highlighted)
 * 4. Commission ledger table
 * 5. Settlements table (append-only)
 * 6. Vendor bank details (read-only)
 * 7. Record Settlement form: amount as DECIMAL STRING (not minor units — T-06-34/Pitfall 5)
 *
 * All money displayed in major units (minor / 100).
 */

import type {
  AdminVendorListItem,
  AdminVendorListResponse,
  AdminVendorPayoutResponse,
  RecordSettlementInput,
} from '@grovio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useState } from 'react';
import { get, post } from '../lib/apiClient.js';

function formatInr(minor: number): string {
  return `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PayoutManagementPage() {
  const queryClient = useQueryClient();
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [showSettlePanel, setShowSettlePanel] = useState(false);
  const [settleForm, setSettleForm] = useState<RecordSettlementInput>({
    amount: '',
    settlementReference: '',
    note: '',
  });
  const [settleError, setSettleError] = useState<string | null>(null);

  // Load vendor list for selector
  const { data: vendorList } = useQuery<AdminVendorListResponse>({
    queryKey: ['admin', 'vendors', 'all'],
    queryFn: () => get<AdminVendorListResponse>('/admin/vendors?limit=200&offset=0'),
  });

  // Load payout data for selected vendor
  const {
    data: payoutData,
    isLoading: payoutLoading,
    error: payoutError,
  } = useQuery<AdminVendorPayoutResponse>({
    queryKey: ['admin', 'payouts', selectedVendorId],
    // CR-04: correct path is /admin/payouts/:vendorId (not /admin/vendors/:id/payouts)
    queryFn: () => get<AdminVendorPayoutResponse>(`/admin/payouts/${selectedVendorId}`),
    enabled: !!selectedVendorId,
  });

  const settleMutation = useMutation({
    mutationFn: (body: RecordSettlementInput) =>
      // CR-04: correct path is /admin/payouts/:vendorId/settlements
      post<void>(`/admin/payouts/${selectedVendorId}/settlements`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'payouts', selectedVendorId] });
      setShowSettlePanel(false);
      setSettleForm({ amount: '', settlementReference: '', note: '' });
      setSettleError(null);
    },
    onError: (err: unknown) =>
      setSettleError(err instanceof Error ? err.message : 'Failed to record settlement'),
  });

  function handleSettle(e: React.FormEvent) {
    e.preventDefault();
    if (!settleForm.amount || !settleForm.settlementReference) {
      setSettleError('Amount and reference are required');
      return;
    }
    settleMutation.mutate(settleForm);
  }

  const s = payoutData?.summary;
  const selectedVendor: AdminVendorListItem | undefined = vendorList?.items.find(
    (v) => v.id === selectedVendorId,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-grovio-text">Payout Management</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">
          View per-vendor commission ledger and record manual settlements.
        </p>
      </div>

      {/* Vendor selector */}
      <div className="mb-6 flex items-center gap-4">
        <label className="text-sm font-medium text-grovio-text" htmlFor="vendor-select">
          Select Vendor
        </label>
        <select
          id="vendor-select"
          value={selectedVendorId}
          onChange={(e) => setSelectedVendorId(e.target.value)}
          className="rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
        >
          <option value="">— Choose vendor —</option>
          {vendorList?.items.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.storeName ?? vendor.name} ({vendor.ownerEmail})
            </option>
          ))}
        </select>
      </div>

      {/* No vendor selected */}
      {!selectedVendorId && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised px-6 py-16 text-center text-sm text-grovio-text-muted">
          Select a vendor above to view their payout ledger.
        </div>
      )}

      {/* Loading */}
      {payoutLoading && selectedVendorId && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {/* Error */}
      {payoutError && (
        <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
          Failed to load payout data: {payoutError instanceof Error ? payoutError.message : 'Unknown error'}
        </div>
      )}

      {/* Payout data */}
      {payoutData && s && (
        <div className="space-y-6">
          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
            {[
              { label: 'Total Earned', value: formatInr(s.totalEarnedMinor) },
              { label: 'Total Reversed', value: formatInr(s.totalReversedMinor) },
              { label: 'Net Commission', value: formatInr(s.netCommissionMinor) },
              { label: 'Total Settled', value: formatInr(s.totalSettledMinor) },
              { label: 'Outstanding Balance', value: formatInr(s.outstandingBalanceMinor), highlight: true },
            ].map((item) => (
              <div
                key={item.label}
                className={[
                  'rounded-xl border p-4',
                  item.highlight
                    ? 'border-grovio-primary/20 bg-grovio-primary/5'
                    : 'border-grovio-border bg-grovio-surface-raised',
                ].join(' ')}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-grovio-text-muted">
                  {item.label}
                </p>
                <p
                  className={[
                    'mt-1 text-xl font-bold',
                    item.highlight ? 'text-grovio-primary' : 'text-grovio-text',
                  ].join(' ')}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Record settlement button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setShowSettlePanel(true);
                setSettleError(null);
              }}
              className="rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              + Record Settlement
            </button>
          </div>

          {/* Vendor bank info (read-only) */}
          {payoutData.payoutInfo && (
            <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-5">
              <h2 className="mb-3 text-sm font-semibold text-grovio-text">
                Bank Details (Read-only Reference)
              </h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {[
                  ['Account Holder', payoutData.payoutInfo.accountHolderName],
                  ['Bank Name', payoutData.payoutInfo.bankName],
                  ['Account Number', payoutData.payoutInfo.bankAccountNumber],
                  ['IFSC / Routing', payoutData.payoutInfo.ifscOrRoutingCode],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-grovio-text-muted">{label}</dt>
                    <dd className="font-medium text-grovio-text">{value ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Commission ledger */}
          <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
            <div className="border-b border-grovio-border px-6 py-4">
              <h2 className="text-sm font-semibold text-grovio-text">Commission Ledger</h2>
            </div>
            {payoutData.commissionEntries.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-grovio-text-muted">
                No commission entries yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-grovio-border text-left">
                      {['Date', 'Order', 'Status', 'Rate', 'Subtotal', 'Commission'].map((h) => (
                        <th key={h} className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-grovio-text-muted">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grovio-border">
                    {payoutData.commissionEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-grovio-surface/40">
                        <td className="px-5 py-3 text-xs text-grovio-text-muted">
                          {formatDate(entry.createdAt)}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-grovio-text-muted">
                          {entry.orderDisplayId}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={[
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                              entry.status === 'earned'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800',
                            ].join(' ')}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-grovio-text">{entry.ratePercent}%</td>
                        <td className="px-5 py-3 text-grovio-text">
                          {formatInr(entry.subtotalMinor)}
                        </td>
                        <td className="px-5 py-3 font-medium text-grovio-text">
                          {formatInr(entry.commissionAmountMinor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Settlements table */}
          <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
            <div className="border-b border-grovio-border px-6 py-4">
              <h2 className="text-sm font-semibold text-grovio-text">Settlement Records</h2>
              <p className="mt-0.5 text-xs text-grovio-text-muted">Append-only — past records cannot be modified.</p>
            </div>
            {payoutData.settlements.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-grovio-text-muted">
                No settlements recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-grovio-border text-left">
                      {['Date', 'Amount', 'Reference', 'Note', 'Recorded By'].map((h) => (
                        <th key={h} className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-grovio-text-muted">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grovio-border">
                    {payoutData.settlements.map((s) => (
                      <tr key={s.id} className="hover:bg-grovio-surface/40">
                        <td className="px-5 py-3 text-xs text-grovio-text-muted">
                          {formatDate(s.settledAt)}
                        </td>
                        <td className="px-5 py-3 font-medium text-grovio-text">
                          {formatInr(s.amountMinor)}
                        </td>
                        <td className="px-5 py-3 text-xs font-mono text-grovio-text-muted">
                          {s.settlementReference}
                        </td>
                        <td className="px-5 py-3 text-xs text-grovio-text-muted">{s.note ?? '—'}</td>
                        <td className="px-5 py-3 text-xs text-grovio-text-muted">
                          Admin
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Record settlement slide-over */}
      <AnimatePresence>
        {showSettlePanel && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettlePanel(false)}
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
                  <h2 className="text-base font-semibold text-grovio-text">Record Settlement</h2>
                  <button
                    type="button"
                    onClick={() => setShowSettlePanel(false)}
                    className="text-grovio-text-muted hover:text-grovio-text"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <form
                  onSubmit={handleSettle}
                  className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6"
                >
                  <div>
                    <p className="mb-3 text-xs text-grovio-text-muted">
                      Vendor: <span className="font-medium text-grovio-text">{selectedVendor?.storeName ?? selectedVendor?.name}</span>
                    </p>
                    {s && (
                      <div className="rounded-lg bg-grovio-primary/5 border border-grovio-primary/20 px-3 py-2 text-sm">
                        Outstanding: <span className="font-bold text-grovio-primary">{formatInr(s.outstandingBalanceMinor)}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-grovio-text">
                      Amount (₹) <span className="text-grovio-error">*</span>
                      <span className="ml-1 text-xs font-normal text-grovio-text-muted">
                        — enter as decimal, e.g. 1000.00
                      </span>
                    </label>
                    <input
                      type="text"
                      value={settleForm.amount}
                      onChange={(e) => setSettleForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="1000.00"
                      required
                      pattern="^\d+(\.\d{1,2})?$"
                      className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-grovio-text-muted">
                      Server converts to minor units. Do not enter paise directly.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-grovio-text">
                      Settlement Reference <span className="text-grovio-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={settleForm.settlementReference}
                      onChange={(e) =>
                        setSettleForm((f) => ({ ...f, settlementReference: e.target.value }))
                      }
                      placeholder="NEFT/IMPS/Bank transfer ID"
                      required
                      className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-grovio-text">
                      Note
                      <span className="ml-1 text-xs font-normal text-grovio-text-muted">(optional)</span>
                    </label>
                    <textarea
                      value={settleForm.note ?? ''}
                      onChange={(e) => setSettleForm((f) => ({ ...f, note: e.target.value || '' }))}
                      rows={3}
                      placeholder="Any additional context…"
                      className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                    />
                  </div>

                  {settleError && (
                    <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-3 py-2 text-sm text-grovio-error">
                      {settleError}
                    </div>
                  )}

                  <div className="mt-auto flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSettlePanel(false)}
                      className="flex-1 rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text hover:bg-grovio-surface"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={settleMutation.isPending}
                      className="flex-1 rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {settleMutation.isPending ? 'Recording…' : 'Record Settlement'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
