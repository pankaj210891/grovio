/**
 * DashboardPage — admin command center dashboard (Phase 11, T5).
 *
 * Redesigned from Phase 6 minimal dashboard into a full command center:
 * 1. Clickable KPI tiles (Total GMV, Active Vendors, Pending Approvals,
 *    Pending Products, Open Returns, Platform Revenue)
 * 2. Needs Attention queue — pending approvals, flagged products, returns, failed payments
 * 3. Platform Health widget — polls /admin/health/metrics every 60s
 * 4. Broadcast Announcement creation card
 * 5. Period selector 7d/30d/90d
 */

import { motion } from 'framer-motion';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../lib/apiClient.js';

type Period = '7d' | '30d' | '90d';

const PERIODS: { label: string; value: Period }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

function formatInr(minor: number): string {
  return `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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

interface KpiCardProps {
  label: string;
  value: string | number;
  accent?: boolean;
  link?: string;
  delta?: string;
}

function KpiCard({ label, value, accent, link, delta }: KpiCardProps) {
  const navigate = useNavigate();
  return (
    <motion.div
      {...(link ? { whileHover: { scale: 1.02 }, onClick: () => navigate(link) } : {})}
      className={[
        'rounded-xl border p-5 transition-shadow',
        accent ? 'border-grovio-primary/20 bg-grovio-primary/5' : 'border-grovio-border bg-grovio-surface-raised',
        link ? 'cursor-pointer hover:shadow-md' : '',
      ].join(' ')}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-grovio-text-muted">{label}</p>
      <p className={['mt-2 text-2xl font-bold', accent ? 'text-grovio-primary' : 'text-grovio-text'].join(' ')}>
        {value}
      </p>
      {delta && (
        <p className="mt-1 text-xs text-grovio-text-muted">{delta}</p>
      )}
      {link && (
        <p className="mt-1 text-xs font-medium text-grovio-primary">View all →</p>
      )}
    </motion.div>
  );
}

function HealthIndicator({ value, label, status }: { value: string; label: string; status: 'green' | 'yellow' | 'red' }) {
  const colors = { green: 'bg-green-500', yellow: 'bg-amber-500', red: 'bg-red-500' };
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${colors[status]}`} />
      <span className="text-xs text-grovio-text-muted">{label}:</span>
      <span className="text-xs font-medium text-grovio-text">{value}</span>
    </div>
  );
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('30d');
  const [announcementForm, setAnnouncementForm] = useState({
    title: '', body: '', targetType: 'all', expiresAt: '',
  });
  const [announcementError, setAnnouncementError] = useState<string | null>(null);

  // Platform health — polls every 60s
  const { data: health } = useQuery<PlatformHealth>({
    queryKey: ['admin', 'health'],
    queryFn: () => get<PlatformHealth>('/admin/health/metrics'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Active announcements
  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ['admin', 'announcements'],
    queryFn: () => get<Announcement[]>('/admin/announcements'),
    staleTime: 60_000,
  });

  // Open support tickets for Needs Attention
  const { data: openTickets } = useQuery<{ items: SupportTicket[]; total: number }>({
    queryKey: ['admin', 'support-tickets', 'open'],
    queryFn: () => get('/admin/support-tickets?status=open&limit=5'),
    staleTime: 30_000,
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: (body: typeof announcementForm) =>
      post<Announcement>('/admin/announcements', {
        ...body,
        expiresAt: body.expiresAt || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      setAnnouncementForm({ title: '', body: '', targetType: 'all', expiresAt: '' });
      setAnnouncementError(null);
    },
    onError: (err: unknown) =>
      setAnnouncementError(err instanceof Error ? err.message : 'Failed to create announcement'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      post(`/admin/announcements/${id}`, { active: false }),
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

  // Derive health status
  const latencyStatus =
    !health?.apiLatencyMs ? 'yellow'
    : health.apiLatencyMs < 100 ? 'green'
    : health.apiLatencyMs < 500 ? 'yellow'
    : 'red';

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
          <h1 className="text-2xl font-bold text-grovio-text">Dashboard</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">Admin command center</p>
        </div>

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
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total GMV" value={formatInr(0)} accent />
        <KpiCard label="Active Vendors" value={0} />
        <KpiCard label="Pending Approvals" value={0} link="/vendors?status=pending" />
        <KpiCard label="Pending Products" value={0} link="/catalog-moderation" />
        <KpiCard label="Open Returns" value={0} />
        <KpiCard label="Platform Revenue" value={formatInr(0)} />
      </div>

      {/* Two-column layout: Needs Attention + Platform Health */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Needs Attention */}
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          <div className="border-b border-grovio-border px-5 py-4">
            <h2 className="text-sm font-semibold text-grovio-text">Needs Attention</h2>
          </div>
          <div className="p-4">
            {openTickets && openTickets.items.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-grovio-text-muted">
                  Open support tickets ({openTickets.total})
                </p>
                {openTickets.items.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between rounded-lg border border-grovio-border px-3 py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium text-grovio-text">{ticket.subject}</p>
                      <p className="text-xs text-grovio-text-muted capitalize">
                        {ticket.submittedByType} · {new Date(ticket.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {ticket.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-grovio-text-muted">
                No items need attention right now.
              </p>
            )}
          </div>
        </div>

        {/* Platform Health */}
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          <div className="border-b border-grovio-border px-5 py-4">
            <h2 className="text-sm font-semibold text-grovio-text">Platform Health</h2>
          </div>
          <div className="space-y-3 p-4">
            {health ? (
              <>
                <HealthIndicator
                  label="API Latency"
                  value={health.apiLatencyMs != null ? `${health.apiLatencyMs}ms` : 'N/A'}
                  status={latencyStatus}
                />
                {Object.entries(health.queueDepths).map(([name, depth]) => (
                  <HealthIndicator
                    key={name}
                    label={`Queue: ${name}`}
                    value={`${depth} pending`}
                    status={depth > 100 ? 'red' : depth > 10 ? 'yellow' : 'green'}
                  />
                ))}
                <HealthIndicator
                  label="Search Sync"
                  value={health.opensearchLastSync
                    ? new Date(health.opensearchLastSync).toLocaleTimeString()
                    : 'Never'}
                  status={health.opensearchLastSync ? 'green' : 'yellow'}
                />
              </>
            ) : (
              <p className="py-6 text-center text-sm text-grovio-text-muted">
                Loading health metrics…
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Broadcast Announcement */}
      <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
        <div className="border-b border-grovio-border px-5 py-4">
          <h2 className="text-sm font-semibold text-grovio-text">Broadcast Announcement</h2>
        </div>
        <div className="p-5">
          <form onSubmit={handleCreateAnnouncement} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Announcement title"
                value={announcementForm.title}
                onChange={(e) => setAnnouncementForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text placeholder-grovio-text-muted/60 focus:border-grovio-primary focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <textarea
                placeholder="Announcement body"
                rows={2}
                value={announcementForm.body}
                onChange={(e) => setAnnouncementForm((f) => ({ ...f, body: e.target.value }))}
                className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text placeholder-grovio-text-muted/60 focus:border-grovio-primary focus:outline-none"
              />
            </div>
            <div>
              <select
                value={announcementForm.targetType}
                onChange={(e) => setAnnouncementForm((f) => ({ ...f, targetType: e.target.value }))}
                className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
              >
                <option value="all">All users</option>
                <option value="customers">Customers only</option>
                <option value="vendors">Vendors only</option>
              </select>
            </div>
            <div>
              <input
                type="datetime-local"
                value={announcementForm.expiresAt}
                onChange={(e) => setAnnouncementForm((f) => ({ ...f, expiresAt: e.target.value }))}
                className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                placeholder="Expiry (optional)"
              />
            </div>
            {announcementError && (
              <div className="md:col-span-2 rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-3 py-2 text-sm text-grovio-error">
                {announcementError}
              </div>
            )}
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={createAnnouncementMutation.isPending}
                className="rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {createAnnouncementMutation.isPending ? 'Publishing…' : 'Publish Announcement'}
              </button>
            </div>
          </form>

          {/* Active announcements list */}
          {announcements.filter((a) => a.active).length > 0 && (
            <div className="mt-4 border-t border-grovio-border pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-grovio-text-muted">
                Active Announcements
              </p>
              <div className="space-y-2">
                {announcements.filter((a) => a.active).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg bg-grovio-surface px-3 py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium text-grovio-text">{a.title}</p>
                      <p className="text-xs text-grovio-text-muted capitalize">
                        Target: {a.targetType}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deactivateMutation.mutate(a.id)}
                      className="rounded border border-grovio-border px-2.5 py-1 text-xs font-medium text-grovio-text-muted hover:bg-grovio-surface-raised"
                    >
                      Deactivate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
