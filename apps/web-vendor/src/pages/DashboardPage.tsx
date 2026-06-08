import { useState } from 'react';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/apiClient.js';
import type { VendorDashboardSummary } from '@grovio/contracts';

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

// ── Icons ─────────────────────────────────────────────────────────────────────

function TrendingUpIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
    </svg>
  );
}

function CalendarWeekIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  );
}

function CalendarMonthIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-3h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
    </svg>
  );
}

function RevenueIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}

function ReturnsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
    </svg>
  );
}

function ProductIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}

function BankIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
    </svg>
  );
}

function EmptyBoxIcon() {
  return (
    <svg className="h-16 w-16" viewBox="0 0 64 64" fill="none">
      <rect x="8" y="24" width="48" height="32" rx="4" fill="#D1FAE5" stroke="#14B8A6" strokeWidth="1.5" />
      <path d="M8 28l24-12 24 12" stroke="#14B8A6" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M20 28l12-6 12 6" fill="#A7F3D0" stroke="#14B8A6" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M32 22v34" stroke="#14B8A6" strokeWidth="1.5" strokeDasharray="3 2" />
      <path d="M20 34h24" stroke="#14B8A6" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function SparklineChart({ values }: { values: number[] }) {
  const SVG_W = 300;
  const SVG_H = 72;
  const PAD = { t: 8, r: 4, b: 8, l: 4 };

  const max = Math.max(...values, 1);
  const chartH = SVG_H - PAD.t - PAD.b;
  const chartW = SVG_W - PAD.l - PAD.r;

  const pts = values.map((v, i) => ({
    x: PAD.l + (i / (values.length - 1)) * chartW,
    y: PAD.t + chartH - (v / max) * chartH,
  }));

  const pathD = pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = pts[i - 1]!;
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx} ${prev.y} ${cx} ${p.y} ${p.x} ${p.y}`;
  }, '');

  const last = pts[pts.length - 1]!;
  const first = pts[0]!;
  const areaD = `${pathD} L ${last.x} ${SVG_H - PAD.b} L ${first.x} ${SVG_H - PAD.b} Z`;

  const today = new Date();
  const labels = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (4 - i) * 7);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  });

  return (
    <div>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full"
        style={{ height: SVG_H }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparkGrad)" />
        <path
          d={pathD}
          fill="none"
          stroke="#14B8A6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-[#6B7280]">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

// ── StatTile ──────────────────────────────────────────────────────────────────

interface StatTileProps {
  label: string;
  value: string;
  comparison: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  delay?: number;
}

function StatTile({ label, value, comparison, iconBg, iconColor, icon, delay = 0 }: StatTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-xl border border-[#D1FAE5] bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-[#6B7280]">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-[#134E4A]">{value}</p>
      <p className="mt-1.5 text-[11px] text-[#6B7280]">{comparison}</p>
    </motion.div>
  );
}

// ── MiniCard ──────────────────────────────────────────────────────────────────

interface MiniCardProps {
  label: string;
  value: string;
  subtext: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  valueColor?: string;
  delay?: number;
}

function MiniCard({ label, value, subtext, iconBg, iconColor, icon, valueColor, delay = 0 }: MiniCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="flex items-start gap-3 rounded-xl border border-[#D1FAE5] bg-white p-4 shadow-sm"
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[#6B7280]">{label}</p>
        <p className={`mt-0.5 text-sm font-bold ${valueColor ?? 'text-[#134E4A]'}`}>{value}</p>
        <p className="mt-0.5 text-[11px] text-[#6B7280]">{subtext}</p>
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(getDismissedAnnouncements);

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
      const res = await apiClient.get<FinanceOverviewResponse>('/vendor/finance/overview?period=30d');
      return res.data;
    },
    refetchInterval: 60_000,
  });

  const { data: weekFinance } = useQuery<FinanceOverview>({
    queryKey: ['vendorFinanceOverview', '7d'],
    queryFn: async () => {
      const res = await apiClient.get<FinanceOverviewResponse>('/vendor/finance/overview?period=7d');
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
      const res = await apiClient.get<AnnouncementsResponse>('/announcements/active?target=vendor');
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 60_000,
  });

  function handleDismiss(id: string) {
    dismissAnnouncement(id);
    setDismissedIds(new Set([...dismissedIds, id]));
  }

  const visibleAnnouncements = (announcementsData ?? []).filter((a) => !dismissedIds.has(a.id));

  const grossSales30d = financeData?.grossSalesMinor ?? '0';
  const grossSales7d = weekFinance?.grossSalesMinor ?? '0';
  const netRevenue30d = financeData?.netRevenueMinor ?? '0';
  const totalSettled = financeData?.totalSettledMinor ?? '0';
  const pendingPayout = financeData?.pendingPayoutMinor ?? '0';
  const ordersCount = dashData?.ordersCount ?? 0;
  const lowStockCount = dashData?.lowStockCount ?? 0;

  const settlementPct =
    parseInt(grossSales30d, 10) > 0
      ? Math.min(100, (parseInt(totalSettled, 10) / parseInt(grossSales30d, 10)) * 100)
      : 0;

  const sparkValues = [0, 0, 0, 0, 0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* Announcement banners */}
      {visibleAnnouncements.length > 0 && (
        <div className="space-y-2">
          {visibleAnnouncements.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-blue-800">{a.title}</p>
                {a.body && <p className="mt-0.5 text-blue-700">{a.body}</p>}
              </div>
              <button
                type="button"
                onClick={() => handleDismiss(a.id)}
                className="shrink-0 text-blue-500 hover:text-blue-700"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#134E4A]">Dashboard</h1>
          <p className="mt-0.5 text-sm text-[#6B7280]">Morning glance — your store at a glance.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <span className="inline-block h-2 w-2 rounded-full bg-[#22C55E]" />
            Live · refreshes every 60s
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-[#D1FAE5] bg-white px-3 py-1.5 text-xs font-medium text-[#134E4A] shadow-sm transition-colors hover:border-[#14B8A6] hover:text-[#14B8A6]"
          >
            <SlidersIcon />
            Customise
          </button>
        </div>
      </div>

      {/* 6 stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          label="Today's Sales"
          value={formatMajor(grossSales7d)}
          comparison="vs yesterday ↓ 0%"
          iconBg="bg-teal-50"
          iconColor="text-[#14B8A6]"
          icon={<TrendingUpIcon />}
          delay={0.05}
        />
        <StatTile
          label="This Week"
          value={formatMajor(grossSales7d)}
          comparison="vs last week ↓ 0%"
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          icon={<CalendarWeekIcon />}
          delay={0.1}
        />
        <StatTile
          label="This Month"
          value={formatMajor(grossSales30d)}
          comparison="vs last month ↓ 0%"
          iconBg="bg-purple-50"
          iconColor="text-purple-500"
          icon={<CalendarMonthIcon />}
          delay={0.15}
        />
        <StatTile
          label="Total Revenue"
          value={formatMajor(netRevenue30d)}
          comparison="vs last month 0%"
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          icon={<RevenueIcon />}
          delay={0.2}
        />
        <StatTile
          label="Total Orders"
          value={ordersCount.toLocaleString()}
          comparison="vs last month 0%"
          iconBg="bg-sky-50"
          iconColor="text-sky-500"
          icon={<OrdersIcon />}
          delay={0.25}
        />
        <StatTile
          label="Total Returns"
          value="—"
          comparison="vs last month 0%"
          iconBg="bg-rose-50"
          iconColor="text-rose-500"
          icon={<ReturnsIcon />}
          delay={0.3}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Left: Financial Position (3/5) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-xl border border-[#D1FAE5] bg-white p-5 shadow-sm lg:col-span-3"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#134E4A]">Financial Position</h2>
            <Link
              to="/finance"
              className="text-xs font-medium text-[#14B8A6] transition-colors hover:text-[#0F766E]"
            >
              View Finance Center →
            </Link>
          </div>

          {/* Released + Pending cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-xl bg-green-50 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#16A34A]">Released</p>
                <p className="mt-1.5 text-xl font-bold text-[#134E4A]">{formatMajor(totalSettled)}</p>
                <p className="mt-0.5 text-[11px] text-[#6B7280]">Total settled</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-[#16A34A]">
                <BankIcon />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-amber-50 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#F59E0B]">Pending</p>
                <p className="mt-1.5 text-xl font-bold text-[#134E4A]">{formatMajor(pendingPayout)}</p>
                <p className="mt-0.5 text-[11px] text-[#6B7280]">Pending payout</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-[#F59E0B]">
                <ClockIcon />
              </div>
            </div>
          </div>

          {/* Net Revenue + settlement rate */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#6B7280]">Net Revenue (30d)</span>
              <span className="font-semibold text-[#134E4A]">{formatMajor(netRevenue30d)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#D1FAE5]">
              <motion.div
                className="h-1.5 rounded-full bg-[#14B8A6]"
                initial={{ width: 0 }}
                animate={{ width: `${settlementPct}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
            <p className="mt-1 flex items-center justify-between text-[11px] text-[#6B7280]">
              <span>Settlement rate vs gross sales</span>
              <span className="font-medium text-[#14B8A6]">{settlementPct.toFixed(0)}%</span>
            </p>
          </div>

          {/* Sparkline */}
          <div className="mt-4">
            <SparklineChart values={sparkValues} />
          </div>
        </motion.div>

        {/* Right: Inventory Alerts (2/5) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="rounded-xl border border-[#D1FAE5] bg-white shadow-sm lg:col-span-2"
        >
          <div className="flex items-center justify-between border-b border-[#D1FAE5] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#134E4A]">Inventory Alerts</h2>
              {alertsData && alertsData.alerts.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  {alertsData.alerts.length}
                </span>
              )}
            </div>
            <Link
              to="/inventory"
              className="text-xs font-medium text-[#14B8A6] transition-colors hover:text-[#0F766E]"
            >
              View all →
            </Link>
          </div>

          {!alertsData && (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#14B8A6] border-t-transparent" />
            </div>
          )}

          {alertsData && alertsData.alerts.length === 0 && (
            <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
              <EmptyBoxIcon />
              <p className="mt-4 text-sm font-semibold text-[#134E4A]">All products are well-stocked.</p>
              <p className="mt-1 text-xs text-[#6B7280]">Great job! Keep it up.</p>
            </div>
          )}

          {alertsData && alertsData.alerts.length > 0 && (
            <ul className="max-h-72 divide-y divide-[#D1FAE5] overflow-y-auto">
              {alertsData.alerts.map((item) => (
                <li key={item.productId} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#134E4A]">{item.name}</p>
                    <p className="text-xs text-[#6B7280]">Threshold: {item.threshold} units</p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-3">
                    <span
                      className={[
                        'text-xs font-semibold tabular-nums',
                        item.quantityAvailable === 0 ? 'text-rose-600' : 'text-amber-600',
                      ].join(' ')}
                    >
                      {item.quantityAvailable === 0 ? 'Out of stock' : `${item.quantityAvailable} left`}
                    </span>
                    <Link
                      to={`/inventory?product=${item.productId}`}
                      className="rounded-lg bg-[#14B8A6]/10 px-2.5 py-1 text-xs font-medium text-[#14B8A6] transition-colors hover:bg-[#14B8A6]/20"
                    >
                      Restock
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </div>

      {/* Bottom 5 mini insight cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MiniCard
          label="Top Selling Category"
          value="Electronics"
          subtext="0 orders"
          iconBg="bg-green-50"
          iconColor="text-[#16A34A]"
          icon={<TagIcon />}
          delay={0.3}
        />
        <MiniCard
          label="Top Selling Product"
          value="No sales yet"
          subtext="Add products to see data"
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          icon={<ProductIcon />}
          delay={0.35}
        />
        <MiniCard
          label="Low Stock Items"
          value={lowStockCount === 0 ? '0' : lowStockCount.toString()}
          subtext={lowStockCount === 0 ? 'All good!' : `${lowStockCount} items need restocking`}
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
          icon={<BoxIcon />}
          delay={0.4}
        />
        <MiniCard
          label="Customer Messages"
          value="0 Unread"
          subtext="No new messages"
          iconBg="bg-purple-50"
          iconColor="text-purple-500"
          icon={<ChatIcon />}
          delay={0.45}
        />
        <MiniCard
          label="Store Health"
          value="Excellent"
          subtext="You're doing great!"
          iconBg="bg-teal-50"
          iconColor="text-[#14B8A6]"
          icon={<ShieldCheckIcon />}
          valueColor="text-[#16A34A]"
          delay={0.5}
        />
      </div>
    </motion.div>
  );
}
