import { motion } from 'framer-motion';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../lib/apiClient.js';

type Period = '7d' | '30d' | '90d';

const PERIODS: { label: string; value: Period }[] = [
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
];

function formatInr(minor: number): string {
  return `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function useCountUp(end: number, duration = 900) {
  const [count, setCount] = useState(0);
  const frameRef = useRef<number>(0);
  useEffect(() => {
    if (end === 0) { setCount(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(eased * end));
      if (p < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [end, duration]);
  return count;
}

interface PlatformHealth {
  apiLatencyMs: number | null;
  queueDepths: Record<string, number>;
  opensearchLastSync: string | null;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  targetType: string;
  active: boolean;
  expiresAt: string | null;
  createdByAdminEmail: string;
  createdAt: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  submittedByType: string;
  createdAt: string;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  displayValue: string;
  rawValue: number;
  accentColor: string;
  link?: string;
  index: number;
}

function KpiCard({ label, displayValue, rawValue, accentColor, link, index }: KpiCardProps) {
  const navigate = useNavigate();
  const count = useCountUp(rawValue);
  const isMonetary = displayValue.startsWith('₹');
  const animatedDisplay = isMonetary
    ? `₹${count.toLocaleString('en-IN')}`
    : String(count);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      onClick={link ? () => navigate(link) : undefined}
      className={[
        'group relative overflow-hidden rounded-2xl border border-[#141c33] bg-[#0c1120] p-5',
        'transition-all duration-300',
        link ? 'cursor-pointer hover:border-[#1e2847] hover:bg-[#0f1629]' : '',
      ].join(' ')}
    >
      {/* Corner accent glow */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-20"
        style={{ backgroundColor: accentColor }}
      />

      <p className="font-['Syne'] text-[10px] font-semibold uppercase tracking-[0.18em] text-[#3a4a6a]">
        {label}
      </p>

      <p
        className="mt-2.5 font-['DM_Mono'] text-2xl font-medium tabular-nums"
        style={{ color: accentColor }}
      >
        {animatedDisplay}
      </p>

      {link && (
        <div className="mt-2.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="font-['Syne'] text-[10px] font-semibold uppercase tracking-widest" style={{ color: accentColor }}>
            View
          </span>
          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: accentColor }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </div>
      )}
    </motion.div>
  );
}

// ── Pulsing Status Dot ────────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'green' | 'yellow' | 'red' }) {
  const cfg = {
    green:  { bg: '#34d399', ring: 'rgba(52,211,153,0.35)' },
    yellow: { bg: '#fbbf24', ring: 'rgba(251,191,36,0.35)' },
    red:    { bg: '#f87171', ring: 'rgba(248,113,113,0.35)' },
  }[status];

  return (
    <span className="relative inline-flex h-2 w-2 flex-shrink-0">
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
        style={{ backgroundColor: cfg.ring }}
      />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: cfg.bg }} />
    </span>
  );
}

// ── Target Badge ──────────────────────────────────────────────────────────────

function TargetBadge({ target }: { target: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    all:       { label: 'All users',  color: '#7aa4fb', bg: 'rgba(79,126,248,0.12)' },
    customers: { label: 'Customers',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
    vendors:   { label: 'Vendors',    color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  };
  const { label, color, bg } = map[target] ?? { label: target, color: '#6a7fa8', bg: 'rgba(106,127,168,0.12)' };
  return (
    <span
      className="rounded-full px-2 py-0.5 font-['Syne'] text-[9px] font-semibold uppercase tracking-widest"
      style={{ color, backgroundColor: bg }}
    >
      {label}
    </span>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, aside }: { icon: React.ReactNode; title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-[#141c33] px-5 py-3.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#141c33]">
          {icon}
        </span>
        <h2 className="font-['Syne'] text-xs font-semibold uppercase tracking-widest text-[#5b6b9a]">
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('30d');
  const [announcementForm, setAnnouncementForm] = useState({
    title: '', body: '', targetType: 'all', expiresAt: '',
  });
  const [announcementError, setAnnouncementError] = useState<string | null>(null);

  const { data: health } = useQuery<PlatformHealth>({
    queryKey: ['admin', 'health'],
    queryFn: () => get<PlatformHealth>('/admin/health/metrics'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ['admin', 'announcements'],
    queryFn: () => get<Announcement[]>('/admin/announcements'),
    staleTime: 60_000,
  });

  const { data: openTickets } = useQuery<{ items: SupportTicket[]; total: number }>({
    queryKey: ['admin', 'support-tickets', 'open'],
    queryFn: () => get('/admin/support-tickets?status=open&limit=5'),
    staleTime: 30_000,
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: (body: typeof announcementForm) =>
      post<Announcement>('/admin/announcements', { ...body, expiresAt: body.expiresAt || null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      setAnnouncementForm({ title: '', body: '', targetType: 'all', expiresAt: '' });
      setAnnouncementError(null);
    },
    onError: (err: unknown) =>
      setAnnouncementError(err instanceof Error ? err.message : 'Failed to create announcement'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => post(`/admin/announcements/${id}`, { active: false }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] }),
  });

  function handleCreateAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!announcementForm.title || !announcementForm.body) {
      setAnnouncementError('Title and body are required.');
      return;
    }
    createAnnouncementMutation.mutate(announcementForm);
  }

  const latencyStatus: 'green' | 'yellow' | 'red' =
    !health?.apiLatencyMs   ? 'yellow'
    : health.apiLatencyMs < 100 ? 'green'
    : health.apiLatencyMs < 500 ? 'yellow'
    : 'red';

  const activeAnnouncements = announcements.filter((a) => a.active);

  return (
    <div className="min-h-full space-y-5 pb-8">
      {/* ── Page header ── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-start justify-between gap-4"
      >
        <div>
          <h1 className="font-['Syne'] text-2xl font-bold tracking-tight text-white">
            Command Center
          </h1>
          <p className="mt-0.5 font-['Syne'] text-xs text-[#3a4a6a]">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>

        {/* Period selector */}
        <div className="flex rounded-xl border border-[#141c33] bg-[#080c17] p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={[
                'rounded-[10px] px-4 py-1.5 font-["Syne"] text-xs font-semibold tracking-widest transition-all duration-200',
                period === p.value
                  ? 'bg-[#4f7ef8] text-white shadow-[0_0_18px_rgba(79,126,248,0.25)]'
                  : 'text-[#2a3a5a] hover:text-[#5b6b9a]',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard index={0} label="Total GMV"          displayValue={formatInr(0)} rawValue={0} accentColor="#7aa4fb" />
        <KpiCard index={1} label="Active Vendors"     displayValue="0"            rawValue={0} accentColor="#e8edff" />
        <KpiCard index={2} label="Pending Approvals"  displayValue="0"            rawValue={0} accentColor="#fbbf24" link="/vendors?status=pending" />
        <KpiCard index={3} label="Pending Products"   displayValue="0"            rawValue={0} accentColor="#a78bfa" link="/catalog-moderation" />
        <KpiCard index={4} label="Open Returns"       displayValue="0"            rawValue={0} accentColor="#f87171" />
        <KpiCard index={5} label="Platform Revenue"   displayValue={formatInr(0)} rawValue={0} accentColor="#34d399" />
      </div>

      {/* ── Middle Row ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Needs Attention */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden rounded-2xl border border-[#141c33] bg-[#0c1120]"
        >
          <SectionHeader
            icon={
              <svg className="h-3.5 w-3.5 text-[#fbbf24]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            }
            title="Needs Attention"
            aside={
              openTickets && openTickets.total > 0 ? (
                <span className="rounded-full bg-[#fbbf24]/10 px-2 py-0.5 font-['DM_Mono'] text-[10px] font-medium text-[#fbbf24]">
                  {openTickets.total}
                </span>
              ) : null
            }
          />
          <div className="p-4">
            {openTickets && openTickets.items.length > 0 ? (
              <div className="space-y-2">
                {openTickets.items.map((ticket, i) => (
                  <motion.div
                    key={ticket.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.32 + i * 0.05 }}
                    className="flex items-center justify-between rounded-xl border border-[#141c33] bg-[#080c17] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#c8d4f5]">{ticket.subject}</p>
                      <p className="mt-0.5 font-['DM_Mono'] text-[10px] capitalize text-[#2a3a5a]">
                        {ticket.submittedByType} · {new Date(ticket.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="ml-3 flex-shrink-0 rounded-full bg-[#fbbf24]/10 px-2.5 py-0.5 font-['Syne'] text-[9px] font-semibold uppercase tracking-widest text-[#fbbf24]">
                      {ticket.status}
                    </span>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#141c33] bg-[#0f1629]">
                  <svg className="h-5 w-5 text-[#34d399]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="mt-3 font-['Syne'] text-xs text-[#2a3a5a]">All clear — nothing needs attention</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Platform Health */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden rounded-2xl border border-[#141c33] bg-[#0c1120]"
        >
          <SectionHeader
            icon={
              <svg className="h-3.5 w-3.5 text-[#34d399]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 10.5h.375c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H21M4.5 10.5H18V15H4.5v-4.5zM3.75 18h15A2.25 2.25 0 0021 15.75v-6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 001.5 9.75v6A2.25 2.25 0 003.75 18z" />
              </svg>
            }
            title="Platform Health"
            aside={
              <span className="font-['DM_Mono'] text-[9px] text-[#1e2847]">60s refresh</span>
            }
          />
          <div className="space-y-2 p-4">
            {health ? (
              <>
                <div className="flex items-center justify-between rounded-xl border border-[#141c33] bg-[#080c17] px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <StatusDot status={latencyStatus} />
                    <span className="font-['Syne'] text-xs text-[#5b6b9a]">API Latency</span>
                  </div>
                  <span className="font-['DM_Mono'] text-xs text-[#c8d4f5]">
                    {health.apiLatencyMs != null ? `${health.apiLatencyMs}ms` : 'N/A'}
                  </span>
                </div>
                {Object.entries(health.queueDepths).map(([name, depth]) => (
                  <div key={name} className="flex items-center justify-between rounded-xl border border-[#141c33] bg-[#080c17] px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <StatusDot status={depth > 100 ? 'red' : depth > 10 ? 'yellow' : 'green'} />
                      <span className="font-['Syne'] text-xs capitalize text-[#5b6b9a]">{name} queue</span>
                    </div>
                    <span className="font-['DM_Mono'] text-xs text-[#c8d4f5]">{depth} jobs</span>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-xl border border-[#141c33] bg-[#080c17] px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <StatusDot status={health.opensearchLastSync ? 'green' : 'yellow'} />
                    <span className="font-['Syne'] text-xs text-[#5b6b9a]">Search sync</span>
                  </div>
                  <span className="font-['DM_Mono'] text-xs text-[#c8d4f5]">
                    {health.opensearchLastSync
                      ? new Date(health.opensearchLastSync).toLocaleTimeString()
                      : 'Never'}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#141c33] border-t-[#4f7ef8]" />
                <p className="mt-3 font-['Syne'] text-xs text-[#2a3a5a]">Fetching metrics…</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Broadcast Announcement ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="overflow-hidden rounded-2xl border border-[#141c33] bg-[#0c1120]"
      >
        <SectionHeader
          icon={
            <svg className="h-3.5 w-3.5 text-[#7aa4fb]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
            </svg>
          }
          title="Broadcast Announcement"
          aside={
            activeAnnouncements.length > 0 ? (
              <span className="rounded-full bg-[#7aa4fb]/10 px-2 py-0.5 font-['DM_Mono'] text-[10px] font-medium text-[#7aa4fb]">
                {activeAnnouncements.length} live
              </span>
            ) : null
          }
        />

        <div className="p-5">
          <form onSubmit={handleCreateAnnouncement} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Announcement title…"
                value={announcementForm.title}
                onChange={(e) => setAnnouncementForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-xl border border-[#141c33] bg-[#080c17] px-4 py-2.5 font-['Syne'] text-sm text-[#c8d4f5] placeholder-[#1e2847] outline-none transition-colors focus:border-[#4f7ef8]/50"
              />
            </div>
            <div className="md:col-span-2">
              <textarea
                placeholder="Message body…"
                rows={2}
                value={announcementForm.body}
                onChange={(e) => setAnnouncementForm((f) => ({ ...f, body: e.target.value }))}
                className="w-full resize-none rounded-xl border border-[#141c33] bg-[#080c17] px-4 py-2.5 font-['Syne'] text-sm text-[#c8d4f5] placeholder-[#1e2847] outline-none transition-colors focus:border-[#4f7ef8]/50"
              />
            </div>
            <select
              value={announcementForm.targetType}
              onChange={(e) => setAnnouncementForm((f) => ({ ...f, targetType: e.target.value }))}
              className="w-full rounded-xl border border-[#141c33] bg-[#080c17] px-4 py-2.5 font-['Syne'] text-sm text-[#8a9bbf] outline-none focus:border-[#4f7ef8]/50"
            >
              <option value="all">All users</option>
              <option value="customers">Customers only</option>
              <option value="vendors">Vendors only</option>
            </select>
            <input
              type="datetime-local"
              value={announcementForm.expiresAt}
              onChange={(e) => setAnnouncementForm((f) => ({ ...f, expiresAt: e.target.value }))}
              className="w-full rounded-xl border border-[#141c33] bg-[#080c17] px-4 py-2.5 font-['Syne'] text-sm text-[#8a9bbf] outline-none focus:border-[#4f7ef8]/50"
            />
            {announcementError && (
              <div className="md:col-span-2 rounded-xl border border-[#f87171]/20 bg-[#f87171]/8 px-4 py-2.5 font-['Syne'] text-xs text-[#f87171]">
                {announcementError}
              </div>
            )}
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={createAnnouncementMutation.isPending}
                className="rounded-xl bg-[#4f7ef8] px-5 py-2.5 font-['Syne'] text-xs font-semibold uppercase tracking-widest text-white shadow-[0_0_20px_rgba(79,126,248,0.2)] transition-all hover:bg-[#3f6de8] hover:shadow-[0_0_28px_rgba(79,126,248,0.35)] disabled:opacity-50"
              >
                {createAnnouncementMutation.isPending ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </form>

          {/* Active announcements */}
          {activeAnnouncements.length > 0 && (
            <div className="mt-5 border-t border-[#141c33] pt-5">
              <p className="mb-3 font-['Syne'] text-[9px] font-semibold uppercase tracking-[0.2em] text-[#2a3a5a]">
                Live Announcements
              </p>
              <div className="space-y-2">
                {activeAnnouncements.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-xl border border-[#141c33] bg-[#080c17] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-['Syne'] text-sm font-medium text-[#c8d4f5]">{a.title}</p>
                      <div className="mt-1.5">
                        <TargetBadge target={a.targetType} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deactivateMutation.mutate(a.id)}
                      className="ml-4 flex-shrink-0 rounded-lg border border-[#141c33] px-3 py-1 font-['Syne'] text-[10px] font-medium text-[#2a3a5a] transition-colors hover:border-[#f87171]/30 hover:text-[#f87171]"
                    >
                      Deactivate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
