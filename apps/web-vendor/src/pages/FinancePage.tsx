/**
 * Vendor Finance Center (Plan 11-03, T5).
 *
 * Replaces EarningsPage with a 4-tab finance center:
 * Overview strip (6 tiles) + period selector
 * Tab 1: Transactions (sortable, CSV export)
 * Tab 2: Settlements (CSV export)
 * Tab 3: Tax Summary (monthly breakdown)
 *
 * Formula shown inline: Net Revenue = Gross Sales − Platform Fees − Reversed Commissions
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d';
type Tab = 'transactions' | 'settlements' | 'tax';

interface FinanceOverview {
  period: Period;
  grossSalesMinor: string;
  platformFeesMinor: string;
  netRevenueMinor: string;
  totalSettledMinor: string;
  pendingPayoutMinor: string;
  taxWithheldMinor: string;
  formula: string;
}

interface Transaction {
  vendorOrderId: string;
  orderDisplayId: string;
  createdAt: string;
  grossMinor: string;
  feeMinor: string;
  netMinor: string;
  commissionStatus: string | null;
}

interface Settlement {
  id: string;
  amountMinor: string;
  settlementReference: string;
  note: string | null;
  settledAt: string;
}

interface TaxMonth {
  month: string;
  grossSalesMinor: string;
  platformFeesMinor: string;
  taxWithheldMinor: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(minorStr: string | undefined, opts?: { compact?: boolean }): string {
  if (!minorStr) return '—';
  const minor = parseInt(minorStr, 10);
  if (isNaN(minor)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: opts?.compact ? 0 : 2,
    maximumFractionDigits: opts?.compact ? 0 : 2,
  }).format(minor / 100);
}

function triggerCsvDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = `${(import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3001'}${url}`;
  a.download = filename;
  a.click();
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface OverviewTileProps {
  label: string;
  value: string;
  accent?: boolean;
  warning?: boolean;
}

function OverviewTile({ label, value, accent, warning }: OverviewTileProps) {
  return (
    <div
      className={[
        'rounded-xl border p-4',
        accent
          ? 'border-grovio-primary/30 bg-grovio-primary/5'
          : warning
          ? 'border-amber-200 bg-amber-50 dark:border-amber-800/30 dark:bg-amber-900/10'
          : 'border-grovio-border bg-grovio-surface-raised',
      ].join(' ')}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-grovio-text-muted">
        {label}
      </p>
      <p
        className={[
          'mt-1.5 text-xl font-bold tabular-nums',
          accent
            ? 'text-grovio-primary'
            : warning
            ? 'text-amber-700 dark:text-amber-400'
            : 'text-grovio-text',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FinancePage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [tab, setTab] = useState<Tab>('transactions');

  const { data: overview, isLoading: overviewLoading } = useQuery<FinanceOverview>({
    queryKey: ['vendorFinanceOverview', period],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: FinanceOverview }>(
        `/vendor/finance/overview?period=${period}`,
      );
      return res.data;
    },
  });

  const { data: transactions, isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ['vendorFinanceTransactions', period],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: { transactions: Transaction[] } }>(
        `/vendor/finance/transactions?period=${period}`,
      );
      return res.data.transactions;
    },
    enabled: tab === 'transactions',
  });

  const { data: settlements, isLoading: settlementsLoading } = useQuery<Settlement[]>({
    queryKey: ['vendorFinanceSettlements'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: { settlements: Settlement[] } }>(
        '/vendor/finance/settlements',
      );
      return res.data.settlements;
    },
    enabled: tab === 'settlements',
  });

  const { data: taxMonths, isLoading: taxLoading } = useQuery<TaxMonth[]>({
    queryKey: ['vendorFinanceTax', period],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: { months: TaxMonth[] } }>(
        `/vendor/finance/tax-summary?period=${period}`,
      );
      return res.data.months;
    },
    enabled: tab === 'tax',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header + period selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grovio-text">Finance Center</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">
            Revenue breakdown, settlements, and tax summary.
          </p>
        </div>
        <div className="flex rounded-lg border border-grovio-border bg-grovio-surface p-1 gap-1">
          {(['7d', '30d', '90d'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={[
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                period === p
                  ? 'bg-grovio-primary text-white'
                  : 'text-grovio-text-muted hover:text-grovio-text',
              ].join(' ')}
            >
              {p === '7d' ? '7 days' : p === '30d' ? '30 days' : '90 days'}
            </button>
          ))}
        </div>
      </div>

      {/* Formula explanation */}
      {overview?.formula && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-700 dark:border-blue-800/30 dark:bg-blue-900/10 dark:text-blue-300">
          {overview.formula}
        </div>
      )}

      {/* Overview tiles */}
      {overviewLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <OverviewTile label="Gross Sales" value={fmt(overview?.grossSalesMinor, { compact: true })} accent />
          <OverviewTile label="Platform Fees" value={fmt(overview?.platformFeesMinor, { compact: true })} />
          <OverviewTile label="Net Revenue" value={fmt(overview?.netRevenueMinor, { compact: true })} accent />
          <OverviewTile label="Total Settled" value={fmt(overview?.totalSettledMinor, { compact: true })} />
          <OverviewTile label="Pending Payout" value={fmt(overview?.pendingPayoutMinor, { compact: true })} warning />
          <OverviewTile label="Tax Withheld" value={fmt(overview?.taxWithheldMinor, { compact: true })} />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-grovio-border">
        <div className="flex gap-1">
          {([
            { key: 'transactions', label: 'Transactions' },
            { key: 'settlements', label: 'Settlements' },
            { key: 'tax', label: 'Tax Summary' },
          ] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                'px-4 py-2.5 text-sm font-medium transition-colors',
                tab === key
                  ? 'border-b-2 border-grovio-primary text-grovio-primary'
                  : 'text-grovio-text-muted hover:text-grovio-text',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}

      {/* Transactions */}
      {tab === 'transactions' && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          <div className="flex items-center justify-between border-b border-grovio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-grovio-text">
              Transaction Breakdown
            </h2>
            <button
              type="button"
              onClick={() => triggerCsvDownload(`/vendor/finance/transactions/export?period=${period}`, `transactions-${period}.csv`)}
              className="rounded-md border border-grovio-border px-3 py-1 text-xs font-medium text-grovio-text hover:bg-grovio-surface"
            >
              Export CSV
            </button>
          </div>

          {txLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
            </div>
          ) : !transactions || transactions.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-grovio-text-muted">
              No transactions in this period.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grovio-border text-left">
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Date</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Order</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Gross</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Platform Fee</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grovio-border">
                {transactions.map((tx) => (
                  <tr key={tx.vendorOrderId} className="hover:bg-grovio-surface/50">
                    <td className="px-4 py-3 text-grovio-text-muted">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-grovio-text">
                      {tx.orderDisplayId || tx.vendorOrderId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-grovio-text">{fmt(tx.grossMinor)}</td>
                    <td className="px-4 py-3 text-grovio-error">{fmt(tx.feeMinor)}</td>
                    <td className="px-4 py-3 font-medium text-green-700 dark:text-green-400">
                      {fmt(tx.netMinor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Settlements */}
      {tab === 'settlements' && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          <div className="flex items-center justify-between border-b border-grovio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-grovio-text">
              Settlement Records
            </h2>
            <button
              type="button"
              onClick={() => triggerCsvDownload('/vendor/finance/settlements/export', 'settlements.csv')}
              className="rounded-md border border-grovio-border px-3 py-1 text-xs font-medium text-grovio-text hover:bg-grovio-surface"
            >
              Export CSV
            </button>
          </div>

          {settlementsLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
            </div>
          ) : !settlements || settlements.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-grovio-text-muted">
              No settlements recorded yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grovio-border text-left">
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Date</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Amount</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Reference</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grovio-border">
                {settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-grovio-surface/50">
                    <td className="px-4 py-3 text-grovio-text-muted">
                      {new Date(s.settledAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-green-700 dark:text-green-400">
                      {fmt(s.amountMinor)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-grovio-text">
                      {s.settlementReference}
                    </td>
                    <td className="px-4 py-3 text-grovio-text-muted">{s.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tax Summary */}
      {tab === 'tax' && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          <div className="border-b border-grovio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-grovio-text">
              Monthly Tax Summary
            </h2>
            <p className="mt-0.5 text-xs text-grovio-text-muted">
              Tax withheld is ₹0 in v1 — tax engine is planned for a future phase.
            </p>
          </div>

          {taxLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
            </div>
          ) : !taxMonths || taxMonths.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-grovio-text-muted">
              No data for this period.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grovio-border text-left">
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Month</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Gross Sales</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Platform Fees</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Tax Withheld</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grovio-border">
                {taxMonths.map((m) => (
                  <tr key={m.month} className="hover:bg-grovio-surface/50">
                    <td className="px-4 py-3 font-medium text-grovio-text">{m.month}</td>
                    <td className="px-4 py-3 text-grovio-text">{fmt(m.grossSalesMinor)}</td>
                    <td className="px-4 py-3 text-grovio-error">{fmt(m.platformFeesMinor)}</td>
                    <td className="px-4 py-3 text-grovio-text-muted">{fmt(m.taxWithheldMinor)}</td>
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
