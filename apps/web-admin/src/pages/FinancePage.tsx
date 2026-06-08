/**
 * FinancePage — unified finance center (Phase 11, T8).
 *
 * Replaces the old /commission-rules and /payout-management routes.
 *
 * 4 tabs:
 *   1. Overview     — revenue summary cards
 *   2. Payouts      — payout queue + approve/reject bulk actions
 *   3. Commissions  — platform commission rule listing (read-only for finance_admin)
 *   4. Refunds      — refund requests queue
 *
 * Accessible to: super_admin, finance_admin
 */

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../lib/apiClient.js';

type FinanceTab = 'overview' | 'payouts' | 'commissions' | 'refunds';

const TABS: { value: FinanceTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'payouts', label: 'Payouts' },
  { value: 'commissions', label: 'Commissions' },
  { value: 'refunds', label: 'Refunds' },
];

function formatInr(minor: number): string {
  return `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

interface PayoutRow {
  id: string;
  vendorName: string;
  amount: number;
  status: string;
  method: string;
  requestedAt: string;
}

interface CommissionRule {
  id: string;
  categoryName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  ratePercent: number;
  effectiveFrom: string;
}

interface RefundRow {
  id: string;
  orderId: string;
  customerEmail: string;
  amount: number;
  reason: string;
  status: string;
  requestedAt: string;
}

interface OverviewData {
  totalPlatformRevenue: number;
  pendingPayoutsTotal: number;
  pendingRefundsTotal: number;
  totalCommissionsCollected: number;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-grovio-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-grovio-text">{value}</p>
    </div>
  );
}

export function FinancePage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<FinanceTab>('overview');
  const [payoutPage, setPayoutPage] = useState(1);
  const [refundPage, setRefundPage] = useState(1);
  const [selectedPayouts, setSelectedPayouts] = useState<Set<string>>(new Set());

  const { data: overview } = useQuery<OverviewData>({
    queryKey: ['admin', 'finance', 'overview'],
    queryFn: () => get<OverviewData>('/admin/finance/overview'),
    staleTime: 60_000,
    enabled: tab === 'overview',
  });

  const { data: payoutsData } = useQuery<{ items: PayoutRow[]; total: number }>({
    queryKey: ['admin', 'finance', 'payouts', payoutPage],
    queryFn: () => get(`/admin/payouts?status=pending&page=${payoutPage}&pageSize=20`),
    staleTime: 30_000,
    enabled: tab === 'payouts',
  });

  const { data: commissions = [] } = useQuery<CommissionRule[]>({
    queryKey: ['admin', 'commission-rules'],
    queryFn: () => get<CommissionRule[]>('/admin/commission-rules'),
    staleTime: 300_000,
    enabled: tab === 'commissions',
  });

  const { data: refundsData } = useQuery<{ items: RefundRow[]; total: number }>({
    queryKey: ['admin', 'finance', 'refunds', refundPage],
    queryFn: () => get(`/admin/refunds?status=pending&page=${refundPage}&pageSize=20`),
    staleTime: 30_000,
    enabled: tab === 'refunds',
  });

  const bulkPayoutMutation = useMutation({
    mutationFn: ({ action, ids }: { action: 'approve' | 'reject'; ids: string[] }) =>
      post('/admin/payouts/bulk-action', { action, payoutIds: ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'payouts'] });
      setSelectedPayouts(new Set());
    },
  });

  const refundMutation = useMutation({
    mutationFn: ({ refundId, action }: { refundId: string; action: 'approve' | 'reject' }) =>
      post(`/admin/refunds/${refundId}/${action}`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'refunds'] }),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <div>
        <h1 className="text-2xl font-bold text-grovio-text">Finance</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">Payouts, commissions, and refunds</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-grovio-border">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={[
              'px-4 py-2 text-sm font-medium transition-colors border-b-2',
              tab === t.value
                ? 'border-grovio-primary text-grovio-primary'
                : 'border-transparent text-grovio-text-muted hover:text-grovio-text',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Platform Revenue (30d)" value={overview ? formatInr(overview.totalPlatformRevenue) : '—'} />
          <StatCard label="Commissions Collected" value={overview ? formatInr(overview.totalCommissionsCollected) : '—'} />
          <StatCard label="Pending Payouts" value={overview ? formatInr(overview.pendingPayoutsTotal) : '—'} />
          <StatCard label="Pending Refunds" value={overview ? formatInr(overview.pendingRefundsTotal) : '—'} />
        </div>
      )}

      {/* Payouts tab */}
      {tab === 'payouts' && (
        <div className="space-y-4">
          {selectedPayouts.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-grovio-text-muted">{selectedPayouts.size} selected</span>
              <button
                type="button"
                onClick={() => bulkPayoutMutation.mutate({ action: 'approve', ids: [...selectedPayouts] })}
                disabled={bulkPayoutMutation.isPending}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                Approve Selected
              </button>
              <button
                type="button"
                onClick={() => bulkPayoutMutation.mutate({ action: 'reject', ids: [...selectedPayouts] })}
                disabled={bulkPayoutMutation.isPending}
                className="rounded-lg border border-grovio-error px-3 py-1.5 text-xs font-medium text-grovio-error hover:bg-grovio-error/5 disabled:opacity-60"
              >
                Reject Selected
              </button>
            </div>
          )}
          <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised overflow-hidden">
            {!payoutsData ? (
              <p className="py-8 text-center text-sm text-grovio-text-muted">Loading…</p>
            ) : payoutsData.items.length === 0 ? (
              <p className="py-8 text-center text-sm text-grovio-text-muted">No pending payouts.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-grovio-border bg-grovio-surface">
                  <tr>
                    <th className="w-10 px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={payoutsData.items.every((p) => selectedPayouts.has(p.id))}
                        onChange={() => {
                          const allSel = payoutsData.items.every((p) => selectedPayouts.has(p.id));
                          setSelectedPayouts(allSel ? new Set() : new Set(payoutsData.items.map((p) => p.id)));
                        }}
                        className="accent-grovio-primary"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Vendor</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Method</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutsData.items.map((payout) => (
                    <tr key={payout.id} className="border-b border-grovio-border/50 hover:bg-grovio-surface">
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedPayouts.has(payout.id)}
                          onChange={() => setSelectedPayouts((s) => {
                            const n = new Set(s);
                            n.has(payout.id) ? n.delete(payout.id) : n.add(payout.id);
                            return n;
                          })}
                          className="accent-grovio-primary"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-grovio-text">{payout.vendorName}</td>
                      <td className="px-4 py-3 text-right font-medium text-grovio-text">{formatInr(payout.amount)}</td>
                      <td className="px-4 py-3 capitalize text-grovio-text-muted">{payout.method}</td>
                      <td className="px-4 py-3 text-grovio-text-muted">
                        {new Date(payout.requestedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Commissions tab */}
      {tab === 'commissions' && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised overflow-hidden">
          {commissions.length === 0 ? (
            <p className="py-8 text-center text-sm text-grovio-text-muted">No commission rules defined.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-grovio-border bg-grovio-surface">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Scope</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Rate</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Effective From</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((rule) => (
                  <tr key={rule.id} className="border-b border-grovio-border/50 hover:bg-grovio-surface">
                    <td className="px-5 py-3 text-grovio-text">
                      {rule.categoryName ?? rule.vendorName ?? 'Platform Default'}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-grovio-text">
                      {rule.ratePercent != null ? rule.ratePercent.toFixed(1) : '—'}%
                    </td>
                    <td className="px-5 py-3 text-grovio-text-muted">
                      {new Date(rule.effectiveFrom).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Refunds tab */}
      {tab === 'refunds' && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised overflow-hidden">
          {!refundsData ? (
            <p className="py-8 text-center text-sm text-grovio-text-muted">Loading…</p>
          ) : refundsData.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-grovio-text-muted">No pending refund requests.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-grovio-border bg-grovio-surface">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Customer</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Order</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Amount</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Reason</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Requested</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {refundsData.items.map((refund) => (
                  <tr key={refund.id} className="border-b border-grovio-border/50 hover:bg-grovio-surface">
                    <td className="px-5 py-3 text-grovio-text">{refund.customerEmail}</td>
                    <td className="px-5 py-3 font-mono text-xs text-grovio-text-muted">{refund.orderId?.slice(0, 8) ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-medium text-grovio-text">{formatInr(refund.amount)}</td>
                    <td className="px-5 py-3 text-grovio-text-muted">{refund.reason}</td>
                    <td className="px-5 py-3 text-grovio-text-muted">
                      {new Date(refund.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => refundMutation.mutate({ refundId: refund.id, action: 'approve' })}
                          disabled={refundMutation.isPending}
                          className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => refundMutation.mutate({ refundId: refund.id, action: 'reject' })}
                          disabled={refundMutation.isPending}
                          className="rounded border border-grovio-error px-2.5 py-1 text-xs font-medium text-grovio-error hover:bg-grovio-error/5 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </motion.div>
  );
}
