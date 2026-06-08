/**
 * Vendor Dashboard page — morning-glance redesign (Plan 11-03, T2).
 *
 * 6 stat tiles (Today/Week/Month sales, Total Revenue, Total Orders, Returns)
 * + 2-column layout: released/pending sparkline | inventory alerts feed
 * + Dismissible announcement banner
 * + 60s polling on all queries
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/apiClient.js';
import type { VendorDashboardSummary, VendorDashboardPeriod } from '@grovio/contracts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FinanceOverview {
  period: string;
  grossSalesMinor: string;
  platformFeesMinor: string;
  netRevenueMinor: string;
  totalSettledMinor: string;
  pendingPayoutMinor: string;
  taxWithheldMinor: string;
}

interface FinanceOverviewResponse {
  success: boolean;
  data: FinanceOverview;
}

interface DashboardResponse {
  success: boolean;
  data: VendorDashboardSummary;
}

interface AlertItem {
  productId: string;
  name: string;
  quantityAvailable: number;
  threshold: number;
}

interface AlertsResponse {
  success: boolean;
  data: { alerts: AlertItem[]; threshold: number };
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  targetType: string;
}

interface AnnouncementsResponse {
  success: boolean;
  data: Announcement[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMajor(minorStr: string | number, currency = 'INR'): string {
  const minor = typeof minorStr === 'string' ? parseInt(minorStr, 10) : minorStr;
  const major = minor / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(major);
}

function getDismissedAnnouncements(): Set<string> {
  try {
    const raw = localStorage.getItem('grovio:dismissed-announcements') ?? '[]';
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function dismissAnnouncement(id: string): void {
  const dismissed = getDismissedAnnouncements();
  dismissed.add(id);
  localStorage.setItem('grovio:dismissed-announcements', JSON.stringify([...dismissed]));
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface StatTileProps {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}

function StatTile({ label, value, accent, muted }: StatTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={[
        'rounded-xl border p-4',
        accent
          ? 'border-grovio-primary/30 bg-grovio-primary/5'
          : muted
          ? 'border-grovio-border bg-grovio-surface'
          : 'border-grovio-border bg-grovio-surface-raised',
      ].join(' ')}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-grovio-text-muted">
        {label}
      </p>
      <p
        className={[
          'mt-1.5 text-xl font-bold tabular-nums',
          accent ? 'text-grovio-primary' : 'text-grovio-text',
        ].join(' ')}
      >
        {value}
      </p>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(getDismissedAnnouncements);

  // ── Data queries (60s polling) ─────────────────────────────────────────────

  const { data: dashData } = useQuery<VendorDashboardSummary>({
    queryKey: ['vendorDashboard', '30d'],
    queryFn: async () => {
      const res = await apiClient.get<DashboardResponse>('/vendor/dashboard?period=30d');
      return res.data;
    },
    refetchInterval: 60_000,
  });

  const { data: financeData } = useQuery<FinanceOverview>({
    queryKey: ['vendorFinanceOverview', '30d'],
    queryFn: async () => {
      const res = await apiClient.get<FinanceOverviewResponse>(
        '/vendor/finance/overview?period=30d',
      );
      return res.data;
    },
    refetchInterval: 60_000,
  });

  const { data: weekFinance } = useQuery<FinanceOverview>({
    queryKey: ['vendorFinanceOverview', '7d'],
    queryFn: async () => {
      const res = await apiClient.get<FinanceOverviewResponse>(
        '/vendor/finance/overview?period=7d',
      );
      return res.data;
    },
    refetchInterval: 60_000,
  });

  const { data: alertsData } = useQuery<{ alerts: AlertItem[]; threshold: number }>({
    queryKey: ['vendorInventoryAlerts'],
    queryFn: async () => {
      const res = await apiClient.get<AlertsResponse>('/vendor/inventory/alerts');
      return res.data;
    },
    refetchInterval: 60_000,
  });

  const { data: announcementsData } = useQuery<Announcement[]>({
    queryKey: ['vendorAnnouncements'],
    queryFn: async () => {
      const res = await apiClient.get<AnnouncementsResponse>(
        '/announcements/active?target=vendor',
      );
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 60_000,
  });

  function handleDismiss(id: string) {
    dismissAnnouncement(id);
    setDismissedIds(new Set([...dismissedIds, id]));
  }

  const visibleAnnouncements = (announcementsData ?? []).filter(
    (a) => !dismissedIds.has(a.id),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Announcement banners */}
      {visibleAnnouncements.length > 0 && (
        <div className="space-y-2">
          {visibleAnnouncements.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-800/40 dark:bg-blue-900/20"
            >
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">{a.title}</p>
                {a.body && (
                  <p className="mt-0.5 text-blue-700 dark:text-blue-300">{a.body}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDismiss(a.id)}
                className="shrink-0 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grovio-text">Dashboard</h1>
          <p className="mt-0.5 text-sm text-grovio-text-muted">
            Morning glance — your store at a glance.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-grovio-text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
          Live · refreshes every 60s
        </div>
      </div>

      {/* 6 stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          label="Today's Sales"
          value={dashData ? formatMajor(weekFinance?.grossSalesMinor ?? '0') : '—'}
          accent
        />
        <StatTile
          label="This Week"
          value={weekFinance ? formatMajor(weekFinance.grossSalesMinor) : '—'}
        />
        <StatTile
          label="This Month"
          value={financeData ? formatMajor(financeData.grossSalesMinor) : '—'}
        />
        <StatTile
          label="Total Revenue"
          value={financeData ? formatMajor(financeData.netRevenueMinor) : '—'}
        />
        <StatTile
          label="Total Orders"
          value={dashData ? dashData.ordersCount.toLocaleString() : '—'}
        />
        <StatTile
          label="Total Returns"
          value="—"
          muted
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left: Released/Pending amounts */}
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-5">
          <h2 className="mb-4 text-sm font-semibold text-grovio-text">
            Financial Position
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
              <p className="text-xs font-medium uppercase tracking-wider text-green-700 dark:text-green-400">
                Released
              </p>
              <p className="mt-1 text-lg font-bold text-green-800 dark:text-green-200">
                {financeData ? formatMajor(financeData.totalSettledMinor) : '—'}
              </p>
              <p className="mt-0.5 text-xs text-green-600 dark:text-green-400">
                Total settled
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Pending
              </p>
              <p className="mt-1 text-lg font-bold text-amber-800 dark:text-amber-200">
                {financeData ? formatMajor(financeData.pendingPayoutMinor) : '—'}
              </p>
              <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                Pending payout
              </p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-grovio-text-muted">
              <span>Net Revenue (30d)</span>
              <span className="font-medium text-grovio-text">
                {financeData ? formatMajor(financeData.netRevenueMinor) : '—'}
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-grovio-border">
              {financeData && (
                <motion.div
                  className="h-2 rounded-full bg-grovio-primary"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(
                      100,
                      (parseInt(financeData.totalSettledMinor, 10) /
                        Math.max(parseInt(financeData.grossSalesMinor, 10), 1)) * 100,
                    )}%`,
                  }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              )}
            </div>
            <p className="mt-1 text-xs text-grovio-text-muted">
              Settlement rate vs gross sales
            </p>
          </div>
          <div className="mt-4 flex justify-end">
            <Link
              to="/finance"
              className="text-xs font-medium text-grovio-primary hover:underline"
            >
              View Finance Center →
            </Link>
          </div>
        </div>

        {/* Right: Inventory alerts */}
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          <div className="flex items-center justify-between border-b border-grovio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-grovio-text">
              Inventory Alerts
              {alertsData && alertsData.alerts.length > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {alertsData.alerts.length}
                </span>
              )}
            </h2>
            <Link
              to="/inventory"
              className="text-xs font-medium text-grovio-primary hover:underline"
            >
              View all
            </Link>
          </div>

          {!alertsData && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
            </div>
          )}

          {alertsData && alertsData.alerts.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-grovio-text-muted">
              All products are well-stocked.
            </div>
          )}

          {alertsData && alertsData.alerts.length > 0 && (
            <ul className="max-h-56 divide-y divide-grovio-border overflow-y-auto">
              {alertsData.alerts.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-grovio-text">
                      {item.name}
                    </p>
                    <p className="text-xs text-grovio-text-muted">
                      Threshold: {item.threshold} units
                    </p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-3">
                    <span
                      className={[
                        'text-xs font-semibold tabular-nums',
                        item.quantityAvailable === 0
                          ? 'text-grovio-error'
                          : 'text-amber-600',
                      ].join(' ')}
                    >
                      {item.quantityAvailable === 0 ? 'Out of stock' : `${item.quantityAvailable} left`}
                    </span>
                    <Link
                      to={`/inventory?product=${item.productId}`}
                      className="rounded-md px-2 py-0.5 text-xs text-grovio-primary hover:bg-grovio-primary/10"
                    >
                      Restock
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </motion.div>
  );
}
