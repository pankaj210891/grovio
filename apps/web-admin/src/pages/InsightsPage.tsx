/**
 * InsightsPage — analytics insights panel (Phase 11, T6).
 *
 * Panels:
 *   1. Period selector 7d/30d/90d
 *   2. Revenue sparkline tiles (GMV, platform revenue, avg order value)
 *   3. Vendor performance table (sorted by GMV)
 *   4. Product velocity table (top-selling products)
 *   5. Retention rate tile (cohort)
 *   6. Anomaly flags from the backend
 *
 * Accessible to: super_admin, finance_admin
 */

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../lib/apiClient.js';

type Period = '7d' | '30d' | '90d';

const PERIODS: { label: string; value: Period }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

function formatInr(minor: number): string {
  return `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

interface RevenueData {
  totalGmv: number;
  platformRevenue: number;
  avgOrderValue: number;
  sparkline: number[];
}

interface VendorPerfRow {
  vendorId: string;
  vendorName: string;
  gmv: number;
  orderCount: number;
  avgRating: number;
}

interface ProductVelocityRow {
  productId: string;
  productName: string;
  unitsSold: number;
  revenue: number;
}

interface RetentionData {
  period: string;
  retentionRate: number;
}

interface AnomalyFlag {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  detectedAt: string;
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const W = 80;
  const H = 28;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-20 opacity-70" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

const severityColor: Record<string, string> = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

export function InsightsPage() {
  const [period, setPeriod] = useState<Period>('30d');

  const { data: revenue, isLoading: revLoading } = useQuery<RevenueData>({
    queryKey: ['admin', 'insights', 'revenue', period],
    queryFn: () => get<RevenueData>(`/admin/insights/revenue?period=${period}`),
    staleTime: 300_000,
  });

  const { data: vendorPerf = [], isLoading: vendorLoading } = useQuery<VendorPerfRow[]>({
    queryKey: ['admin', 'insights', 'vendor-performance', period],
    queryFn: () => get<VendorPerfRow[]>(`/admin/insights/vendor-performance?period=${period}`),
    staleTime: 300_000,
  });

  const { data: productVelocity = [], isLoading: pvLoading } = useQuery<ProductVelocityRow[]>({
    queryKey: ['admin', 'insights', 'product-velocity', period],
    queryFn: () => get<ProductVelocityRow[]>(`/admin/insights/product-velocity?period=${period}`),
    staleTime: 300_000,
  });

  const { data: retention } = useQuery<RetentionData>({
    queryKey: ['admin', 'insights', 'retention', period],
    queryFn: () => get<RetentionData>(`/admin/insights/retention-rate?period=${period}`),
    staleTime: 300_000,
  });

  const { data: anomalies = [] } = useQuery<AnomalyFlag[]>({
    queryKey: ['admin', 'insights', 'anomalies'],
    queryFn: () => get<AnomalyFlag[]>('/admin/insights/anomaly-flags'),
    staleTime: 120_000,
    refetchInterval: 120_000,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-grovio-text">Insights</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">Platform analytics overview</p>
        </div>
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
      </div>

      {/* Revenue sparkline tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Total GMV',
            value: revLoading ? '—' : formatInr(revenue?.totalGmv ?? 0),
            sparkline: revenue?.sparkline ?? [],
          },
          {
            label: 'Platform Revenue',
            value: revLoading ? '—' : formatInr(revenue?.platformRevenue ?? 0),
            sparkline: [],
          },
          {
            label: 'Avg Order Value',
            value: revLoading ? '—' : formatInr(revenue?.avgOrderValue ?? 0),
            sparkline: [],
          },
          {
            label: 'Retention Rate',
            value: retention ? `${retention.retentionRate.toFixed(1)}%` : '—',
            sparkline: [],
          },
        ].map(({ label, value, sparkline }) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-xl border border-grovio-border bg-grovio-surface-raised p-5"
          >
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-grovio-text-muted">
                {label}
              </p>
              <p className="mt-2 text-2xl font-bold text-grovio-text">{value}</p>
            </div>
            {sparkline.length > 1 && (
              <div className="text-grovio-primary">
                <Sparkline values={sparkline} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Anomaly flags */}
      {anomalies.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700">
            Anomaly Flags ({anomalies.length})
          </p>
          <div className="space-y-2">
            {anomalies.map((flag, i) => (
              <div key={i} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${severityColor[flag.severity] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {flag.severity}
                </span>
                <div>
                  <p className="text-xs font-medium text-grovio-text">{flag.type}</p>
                  <p className="text-xs text-grovio-text-muted">{flag.description}</p>
                </div>
                <span className="ml-auto shrink-0 text-[10px] text-grovio-text-muted">
                  {new Date(flag.detectedAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-column: Vendor Performance + Product Velocity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Vendor Performance */}
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          <div className="border-b border-grovio-border px-5 py-4">
            <h2 className="text-sm font-semibold text-grovio-text">Vendor Performance</h2>
          </div>
          <div className="overflow-x-auto">
            {vendorLoading ? (
              <p className="py-8 text-center text-sm text-grovio-text-muted">Loading…</p>
            ) : vendorPerf.length === 0 ? (
              <p className="py-8 text-center text-sm text-grovio-text-muted">No data for this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-grovio-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">
                      Vendor
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">
                      GMV
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">
                      Orders
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">
                      Rating
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vendorPerf.map((row) => (
                    <tr key={row.vendorId} className="border-b border-grovio-border/50 hover:bg-grovio-surface">
                      <td className="px-4 py-3 font-medium text-grovio-text">{row.vendorName}</td>
                      <td className="px-4 py-3 text-right text-grovio-text">{formatInr(row.gmv)}</td>
                      <td className="px-4 py-3 text-right text-grovio-text-muted">{row.orderCount}</td>
                      <td className="px-4 py-3 text-right text-grovio-text-muted">{row.avgRating != null ? row.avgRating.toFixed(1) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Product Velocity */}
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          <div className="border-b border-grovio-border px-5 py-4">
            <h2 className="text-sm font-semibold text-grovio-text">Product Velocity</h2>
          </div>
          <div className="overflow-x-auto">
            {pvLoading ? (
              <p className="py-8 text-center text-sm text-grovio-text-muted">Loading…</p>
            ) : productVelocity.length === 0 ? (
              <p className="py-8 text-center text-sm text-grovio-text-muted">No data for this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-grovio-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">
                      Product
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">
                      Units
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productVelocity.map((row) => (
                    <tr key={row.productId} className="border-b border-grovio-border/50 hover:bg-grovio-surface">
                      <td className="px-4 py-3 font-medium text-grovio-text">{row.productName}</td>
                      <td className="px-4 py-3 text-right text-grovio-text-muted">{row.unitsSold}</td>
                      <td className="px-4 py-3 text-right text-grovio-text">{formatInr(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
