/**
 * DashboardPage — admin KPI dashboard (ADM-01, D-10).
 *
 * 7d/30d/90d period toggle → GET /admin/analytics/summary?period=X.
 * KPI cards: GMV, Orders, Active Vendors, New Customers, Commission Earned, Pending Payouts.
 * Charts: orders-by-day line (MiniLineChart), GMV-by-category bar (MiniBarChart).
 * Top 5 vendors by GMV table.
 * Manual refresh — no polling.
 *
 * All money displayed in major units (minor / 100).
 */

import type { AdminAnalyticsResponse, AnalyticsPeriod } from '@grovio/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { MiniBarChart, MiniLineChart } from '../components/charts/MiniChart.js';
import { get } from '../lib/apiClient.js';

const PERIODS: { label: string; value: AnalyticsPeriod }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

function formatInr(minor: number): string {
  return `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface KpiCardProps {
  label: string;
  value: string;
  accent?: boolean;
}

function KpiCard({ label, value, accent }: KpiCardProps) {
  return (
    <div
      className={[
        'rounded-xl border p-5',
        accent
          ? 'border-grovio-primary/20 bg-grovio-primary/5'
          : 'border-grovio-border bg-grovio-surface-raised',
      ].join(' ')}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-grovio-text-muted">{label}</p>
      <p className={['mt-2 text-2xl font-bold', accent ? 'text-grovio-primary' : 'text-grovio-text'].join(' ')}>
        {value}
      </p>
    </div>
  );
}

export function DashboardPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const queryClient = useQueryClient();

  const { data, isLoading, error, isFetching } = useQuery<AdminAnalyticsResponse>({
    queryKey: ['admin', 'analytics', period],
    queryFn: () => get<AdminAnalyticsResponse>(`/admin/analytics/summary?period=${period}`),
    staleTime: 1000 * 60 * 5,
  });

  function handleRefresh() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'analytics', period] });
  }

  const s = data?.summary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-grovio-text">Dashboard</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">
            Marketplace performance overview
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period toggle */}
          <div className="flex rounded-lg border border-grovio-border bg-grovio-surface-raised p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={[
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  period === p.value
                    ? 'bg-grovio-primary text-white shadow-sm'
                    : 'text-grovio-text-muted hover:text-grovio-text',
                ].join(' ')}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Manual refresh */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isFetching}
            className="rounded-lg border border-grovio-border bg-grovio-surface-raised px-3 py-1.5 text-xs font-medium text-grovio-text-muted transition-colors hover:text-grovio-text disabled:opacity-50"
          >
            {isFetching ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
          Failed to load analytics: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {/* KPI cards */}
      {s && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="Total GMV" value={formatInr(s.gmvMinor)} accent />
            <KpiCard label="Orders" value={s.ordersCount.toLocaleString()} />
            <KpiCard label="Active Vendors" value={s.activeVendors.toLocaleString()} />
            <KpiCard label="New Customers" value={s.newCustomers.toLocaleString()} />
            <KpiCard label="Commission Earned" value={formatInr(s.commissionEarnedMinor)} />
            <KpiCard label="Pending Payouts" value={formatInr(s.pendingPayoutsMinor)} />
          </div>

          {/* Charts row */}
          <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* Orders by day */}
            <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-5">
              <h2 className="mb-4 text-sm font-semibold text-grovio-text">Orders by Day</h2>
              {data.ordersByDay.length > 0 ? (
                <MiniLineChart data={data.ordersByDay} metric="ordersCount" />
              ) : (
                <p className="py-12 text-center text-sm text-grovio-text-muted">No order data for this period.</p>
              )}
            </div>

            {/* GMV by category */}
            <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-5">
              <h2 className="mb-4 text-sm font-semibold text-grovio-text">GMV by Category</h2>
              {data.gmvByCategory.length > 0 ? (
                <MiniBarChart data={data.gmvByCategory} />
              ) : (
                <p className="py-12 text-center text-sm text-grovio-text-muted">No category data for this period.</p>
              )}
            </div>
          </div>

          {/* Top vendors table */}
          <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
            <div className="border-b border-grovio-border px-6 py-4">
              <h2 className="text-sm font-semibold text-grovio-text">Top 5 Vendors by GMV</h2>
            </div>
            {data.topVendorsByGmv.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-grovio-text-muted">
                No vendor activity in this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-grovio-border text-left">
                      <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-grovio-text-muted">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-grovio-text-muted">
                        Vendor
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-grovio-text-muted">
                        GMV ({period})
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grovio-border">
                    {data.topVendorsByGmv.map((vendor, i) => (
                      <tr key={vendor.vendorId} className="hover:bg-grovio-surface/50">
                        <td className="px-6 py-3 font-medium text-grovio-text-muted">
                          #{i + 1}
                        </td>
                        <td className="px-6 py-3 font-medium text-grovio-text">{vendor.name}</td>
                        <td className="px-6 py-3 text-right font-medium text-grovio-text">
                          {formatInr(vendor.gmvMinor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
