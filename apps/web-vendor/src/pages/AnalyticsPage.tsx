/**
 * Vendor Analytics page (Plan 11-03, T6).
 *
 * 4 sections:
 * 1. Product performance table (views, cart, orders, revenue, return rate, wishlist)
 * 2. Inventory forecast table (stock, avg daily sales, days remaining)
 * 3. Conversion funnel chart (impressions → views → cart → orders)
 * 4. Customer behavior (new/returning donut, AOV trend, peak hours)
 *
 * Graceful empty state if Wave 5a tables not yet present.
 */

import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductPerformance {
  productId: string;
  name: string;
  viewCount: number;
  cartCount: number;
  orderCount: number;
  revenueMinor: string;
  returnRate: number;
  wishlistCount: number;
}

interface InventoryForecast {
  productId: string;
  name: string;
  quantityAvailable: number;
  avgDailySales30d: number;
  estimatedDaysRemaining: number | null;
}

interface FunnelStage {
  stage: string;
  count: number;
  dropOffPct: number;
}

interface CustomerBehavior {
  newCustomers: number;
  returningCustomers: number;
  aovTrend: Array<{ date: string; avgOrderValueMinor: string }>;
  peakHours: Array<{ hour: number; orderCount: number }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(minorStr: string | undefined): string {
  if (!minorStr) return '—';
  const v = parseInt(minorStr, 10);
  if (isNaN(v)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v / 100);
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 h-10 w-10 rounded-full border-2 border-grovio-border bg-grovio-surface flex items-center justify-center text-grovio-text-muted text-lg">
        📊
      </div>
      <p className="text-sm font-medium text-grovio-text">No data yet</p>
      <p className="mt-1 max-w-xs text-xs text-grovio-text-muted">{message}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: performance, isLoading: perfLoading } = useQuery<ProductPerformance[]>({
    queryKey: ['vendorAnalyticsPerformance'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ProductPerformance[] }>(
        '/vendor/analytics/product-performance',
      );
      return res.data;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes (matches Redis cache)
  });

  const { data: forecast, isLoading: forecastLoading } = useQuery<InventoryForecast[]>({
    queryKey: ['vendorAnalyticsForecast'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: InventoryForecast[] }>(
        '/vendor/analytics/inventory-forecast',
      );
      return res.data;
    },
    staleTime: 15 * 60 * 1000,
  });

  const { data: funnel, isLoading: funnelLoading } = useQuery<FunnelStage[]>({
    queryKey: ['vendorAnalyticsFunnel'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: FunnelStage[] }>(
        '/vendor/analytics/conversion-funnel',
      );
      return res.data;
    },
    staleTime: 15 * 60 * 1000,
  });

  const { data: behavior, isLoading: behaviorLoading } = useQuery<CustomerBehavior>({
    queryKey: ['vendorAnalyticsBehavior'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: CustomerBehavior }>(
        '/vendor/analytics/customer-behavior',
      );
      return res.data;
    },
    staleTime: 15 * 60 * 1000,
  });

  const maxFunnelCount = Math.max(...(funnel ?? []).map((f) => f.count), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-grovio-text">Analytics</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">
          Product performance, inventory forecasting, and customer insights.
        </p>
      </div>

      {/* ── Section 1: Product Performance ────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-grovio-text">
          Product Performance
        </h2>
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          {perfLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
            </div>
          ) : !performance || performance.length === 0 ? (
            <EmptyState message="No product data yet. Data populates as customers view and order your products." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-grovio-border text-left">
                    <th className="px-4 py-3 font-medium text-grovio-text-muted">Product</th>
                    <th className="px-4 py-3 font-medium text-grovio-text-muted text-right">Views</th>
                    <th className="px-4 py-3 font-medium text-grovio-text-muted text-right">Add to Cart</th>
                    <th className="px-4 py-3 font-medium text-grovio-text-muted text-right">Orders</th>
                    <th className="px-4 py-3 font-medium text-grovio-text-muted text-right">Revenue</th>
                    <th className="px-4 py-3 font-medium text-grovio-text-muted text-right">Return Rate</th>
                    <th className="px-4 py-3 font-medium text-grovio-text-muted text-right">Wishlisted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grovio-border">
                  {performance.map((p, idx) => {
                    const isTop3 = idx < 3;
                    const isBottom3 = idx >= performance.length - 3 && performance.length > 3;
                    return (
                      <tr
                        key={p.productId}
                        className={[
                          'hover:bg-grovio-surface/50',
                          isTop3 ? 'bg-green-50/50 dark:bg-green-900/5' : '',
                          isBottom3 ? 'bg-red-50/50 dark:bg-red-900/5' : '',
                        ].join(' ')}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isTop3 && (
                              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
                                TOP
                              </span>
                            )}
                            {isBottom3 && (
                              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                LOW
                              </span>
                            )}
                            <span className="font-medium text-grovio-text truncate max-w-[160px]">
                              {p.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-grovio-text tabular-nums">
                          {p.viewCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-grovio-text tabular-nums">
                          {p.cartCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-grovio-text tabular-nums">
                          {p.orderCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-grovio-text tabular-nums">
                          {fmt(p.revenueMinor)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={p.returnRate > 0.1 ? 'text-grovio-error' : 'text-grovio-text'}>
                            {(p.returnRate * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-grovio-text-muted tabular-nums">
                          {p.wishlistCount.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── Section 2: Inventory Forecast ─────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-grovio-text">
          Inventory Forecast
        </h2>
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          {forecastLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
            </div>
          ) : !forecast || forecast.length === 0 ? (
            <EmptyState message="No inventory data yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-grovio-border text-left">
                    <th className="px-4 py-3 font-medium text-grovio-text-muted">Product</th>
                    <th className="px-4 py-3 font-medium text-grovio-text-muted text-right">Stock</th>
                    <th className="px-4 py-3 font-medium text-grovio-text-muted text-right">Avg Daily Sales</th>
                    <th className="px-4 py-3 font-medium text-grovio-text-muted text-right">Days Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grovio-border">
                  {forecast.map((f) => {
                    const isLow = f.estimatedDaysRemaining !== null && f.estimatedDaysRemaining < 7;
                    return (
                      <tr key={f.productId} className="hover:bg-grovio-surface/50">
                        <td className="px-4 py-3 font-medium text-grovio-text">
                          {f.name}
                        </td>
                        <td className="px-4 py-3 text-right text-grovio-text tabular-nums">
                          {f.quantityAvailable.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-grovio-text-muted tabular-nums">
                          {f.avgDailySales30d.toFixed(1)}/day
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={[
                              'inline-flex items-center gap-1 tabular-nums',
                              isLow ? 'font-semibold text-grovio-error' : 'text-grovio-text',
                            ].join(' ')}
                          >
                            {isLow && <span>⚠</span>}
                            {f.estimatedDaysRemaining !== null
                              ? `${f.estimatedDaysRemaining} days`
                              : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── Section 3: Conversion Funnel ──────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-grovio-text">
          Conversion Funnel
        </h2>
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-6">
          {funnelLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
            </div>
          ) : !funnel || funnel.every((f) => f.count === 0) ? (
            <EmptyState message="Funnel data will appear as customers discover your products." />
          ) : (
            <div className="space-y-3">
              {funnel.map((stage, idx) => (
                <div key={stage.stage} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-grovio-text">{stage.stage}</span>
                    <div className="flex items-center gap-4">
                      <span className="tabular-nums text-grovio-text">
                        {stage.count.toLocaleString()}
                      </span>
                      {idx > 0 && stage.dropOffPct > 0 && (
                        <span className="text-xs text-grovio-error">
                          -{stage.dropOffPct}% drop
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-6 rounded-lg bg-grovio-border overflow-hidden">
                    <motion.div
                      className="h-full rounded-lg bg-grovio-primary/70"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round((stage.count / maxFunnelCount) * 100)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: idx * 0.1 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 4: Customer Behavior ──────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-grovio-text">
          Customer Behavior
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* New vs returning */}
          <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-5">
            <h3 className="mb-3 text-sm font-semibold text-grovio-text">
              New vs Returning
            </h3>
            {behaviorLoading ? (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
              </div>
            ) : !behavior || (behavior.newCustomers === 0 && behavior.returningCustomers === 0) ? (
              <p className="text-xs text-grovio-text-muted">No customer data yet.</p>
            ) : (
              <div className="space-y-2">
                {[
                  { label: 'New', count: behavior.newCustomers, color: 'bg-grovio-primary' },
                  { label: 'Returning', count: behavior.returningCustomers, color: 'bg-green-500' },
                ].map((item) => {
                  const total = behavior.newCustomers + behavior.returningCustomers;
                  const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="font-medium text-grovio-text">{item.label}</span>
                        <span className="text-grovio-text-muted">{item.count} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-grovio-border">
                        <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AOV Trend */}
          <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-5">
            <h3 className="mb-3 text-sm font-semibold text-grovio-text">
              Avg Order Value (30d)
            </h3>
            {behaviorLoading ? (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
              </div>
            ) : !behavior?.aovTrend.length ? (
              <p className="text-xs text-grovio-text-muted">No AOV data yet.</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {behavior.aovTrend.slice(-7).map((d) => (
                  <div key={d.date} className="flex items-center justify-between text-xs">
                    <span className="text-grovio-text-muted">
                      {new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="font-medium text-grovio-text tabular-nums">
                      {fmt(d.avgOrderValueMinor)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Peak Hours */}
          <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-5">
            <h3 className="mb-3 text-sm font-semibold text-grovio-text">
              Peak Purchase Hours
            </h3>
            {behaviorLoading ? (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
              </div>
            ) : !behavior?.peakHours.length ? (
              <p className="text-xs text-grovio-text-muted">No hour data yet.</p>
            ) : (
              <div className="space-y-0.5">
                {(() => {
                  const maxOrders = Math.max(...behavior.peakHours.map((h) => h.orderCount), 1);
                  const topHours = [...behavior.peakHours]
                    .sort((a, b) => b.orderCount - a.orderCount)
                    .slice(0, 6);
                  return topHours.map((h) => (
                    <div key={h.hour} className="flex items-center gap-2 text-xs">
                      <span className="w-12 shrink-0 text-grovio-text-muted text-right">
                        {h.hour}:00
                      </span>
                      <div className="flex-1 h-3 rounded bg-grovio-border overflow-hidden">
                        <div
                          className="h-3 rounded bg-grovio-primary/60"
                          style={{ width: `${Math.round((h.orderCount / maxOrders) * 100)}%` }}
                        />
                      </div>
                      <span className="w-6 text-grovio-text tabular-nums">{h.orderCount}</span>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      </section>
    </motion.div>
  );
}
