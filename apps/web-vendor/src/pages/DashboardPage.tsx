/**
 * Vendor Dashboard page (VEN-02).
 *
 * Period toggle (7d/30d/90d) → GET /vendor/dashboard?period=...
 * KPI cards: Total Orders, Gross Sales, Net Earnings, Outstanding Balance.
 * Low-stock alerts list with links to /inventory.
 *
 * Money displayed in major units (divide minor by 100).
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/apiClient.js';
import type { VendorDashboardSummary, VendorDashboardPeriod } from '@grovio/contracts';

interface DashboardResponse {
  success: boolean;
  data: VendorDashboardSummary;
}

const PERIODS: { label: string; value: VendorDashboardPeriod }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

function formatMajor(minorUnits: number, currency = 'INR'): string {
  const major = minorUnits / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(major);
}

interface KpiCardProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function KpiCard({ label, value, highlight }: KpiCardProps) {
  return (
    <div
      className={[
        'rounded-xl border p-5',
        highlight
          ? 'border-grovio-primary/30 bg-grovio-primary/5'
          : 'border-grovio-border bg-grovio-surface-raised',
      ].join(' ')}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-grovio-text-muted">
        {label}
      </p>
      <p
        className={[
          'mt-2 text-2xl font-bold',
          highlight ? 'text-grovio-primary' : 'text-grovio-text',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<VendorDashboardPeriod>('30d');

  const { data, isLoading, error: queryError } = useQuery<VendorDashboardSummary>({
    queryKey: ['vendorDashboard', period],
    queryFn: async () => {
      const res = await apiClient.get<DashboardResponse>(
        `/vendor/dashboard?period=${period}`,
      );
      return res.data;
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grovio-text">Dashboard</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">
            Overview of your store performance.
          </p>
        </div>

        {/* Period toggle */}
        <div className="flex rounded-lg border border-grovio-border bg-grovio-surface p-1 gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={[
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                period === p.value
                  ? 'bg-grovio-primary text-white'
                  : 'text-grovio-text-muted hover:text-grovio-text',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {/* Error */}
      {queryError && (
        <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
          Failed to load dashboard:{' '}
          {queryError instanceof Error ? queryError.message : 'Unknown error'}
        </div>
      )}

      {data && (
        <>
          {/* KPI Cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total Orders"
              value={data.ordersCount.toLocaleString()}
            />
            <KpiCard
              label="Gross Sales"
              value={formatMajor(data.grossSalesMinor)}
            />
            <KpiCard
              label="Net Earnings"
              value={formatMajor(data.netEarningsMinor)}
            />
            <KpiCard
              label="Outstanding Balance"
              value={formatMajor(data.outstandingBalanceMinor)}
              highlight
            />
          </div>

          {/* Low-stock alerts */}
          <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
            <div className="flex items-center justify-between border-b border-grovio-border px-5 py-3">
              <h2 className="text-sm font-semibold text-grovio-text">
                Low Stock Alerts
                {data.lowStockCount > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {data.lowStockCount}
                  </span>
                )}
              </h2>
              <Link
                to="/inventory"
                className="text-xs font-medium text-grovio-primary hover:underline"
              >
                View all inventory
              </Link>
            </div>

            {data.lowStockProducts.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-grovio-text-muted">
                All products are well-stocked.
              </div>
            ) : (
              <ul className="divide-y divide-grovio-border">
                {data.lowStockProducts.map((p) => (
                  <li
                    key={p.productId}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <span className="text-sm text-grovio-text">{p.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-amber-600">
                        {p.quantityAvailable} left
                      </span>
                      <Link
                        to="/inventory"
                        className="text-xs text-grovio-primary hover:underline"
                      >
                        Update
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
