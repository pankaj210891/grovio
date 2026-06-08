/**
 * SupportPage — support ticket queue (Phase 11, T10).
 *
 * Features:
 *   - Status tabs: Open / In Progress / Resolved / All
 *   - Search by subject/email
 *   - Assign ticket to self
 *   - Link to SupportTicketPage for conversation view
 */

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../lib/apiClient.js';
import { useAdminAuth } from '../hooks/useAdminAuth.js';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'all';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  submittedByType: string;
  submittedByEmail: string;
  assignedToAdminEmail: string | null;
  createdAt: string;
  lastReplyAt: string | null;
}

interface TicketListResponse {
  items: Ticket[];
  total: number;
}

const TABS: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

export function SupportPage() {
  const { admin } = useAdminAuth();
  const queryClient = useQueryClient();
  const [statusTab, setStatusTab] = useState<TicketStatus>('open');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<TicketListResponse>({
    queryKey: ['admin', 'support-tickets', statusTab, search, page],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (statusTab !== 'all') p.set('status', statusTab);
      if (search) p.set('q', search);
      return get<TicketListResponse>(`/admin/support-tickets?${p}`);
    },
    staleTime: 30_000,
  });

  const assignMutation = useMutation({
    mutationFn: (ticketId: string) =>
      post(`/admin/support-tickets/${ticketId}/assign`, {
        adminEmail: admin?.email ?? '',
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'support-tickets'] }),
  });

  const tickets = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-grovio-text">Support</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">{total} tickets in this view</p>
        </div>
        <input
          type="search"
          placeholder="Search tickets…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-48 rounded-lg border border-grovio-border bg-grovio-surface px-3 py-1.5 text-sm text-grovio-text placeholder-grovio-text-muted/60 focus:border-grovio-primary focus:outline-none"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-grovio-border">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => { setStatusTab(t.value); setPage(1); }}
            className={[
              'px-4 py-2 text-sm font-medium transition-colors border-b-2',
              statusTab === t.value
                ? 'border-grovio-primary text-grovio-primary'
                : 'border-transparent text-grovio-text-muted hover:text-grovio-text',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-grovio-text-muted">Loading…</p>
      ) : tickets.length === 0 ? (
        <p className="py-12 text-center text-sm text-grovio-text-muted">No tickets in this view.</p>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-grovio-border bg-grovio-surface-raised px-5 py-4"
            >
              {/* Status badge */}
              <span
                className={[
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize',
                  STATUS_COLORS[ticket.status] ?? 'bg-gray-100 text-gray-600',
                ].join(' ')}
              >
                {ticket.status?.replace(/_/g, ' ') ?? '—'}
              </span>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-grovio-text">{ticket.subject}</p>
                <p className="text-xs text-grovio-text-muted">
                  {ticket.submittedByEmail} ·{' '}
                  {ticket.lastReplyAt
                    ? `Last reply ${new Date(ticket.lastReplyAt).toLocaleDateString()}`
                    : `Opened ${new Date(ticket.createdAt).toLocaleDateString()}`}
                </p>
              </div>

              {/* Assigned to */}
              {ticket.assignedToAdminEmail ? (
                <span className="shrink-0 text-xs text-grovio-text-muted">
                  Assigned: {ticket.assignedToAdminEmail}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => assignMutation.mutate(ticket.id)}
                  disabled={assignMutation.isPending}
                  className="shrink-0 rounded-lg border border-grovio-border px-2.5 py-1 text-xs font-medium text-grovio-text-muted hover:bg-grovio-surface hover:text-grovio-text disabled:opacity-60"
                >
                  Assign to me
                </button>
              )}

              <Link
                to={`/support/${ticket.id}`}
                className="shrink-0 text-xs font-medium text-grovio-primary hover:underline"
              >
                View
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-grovio-text-muted">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-grovio-border px-3 py-1.5 text-xs font-medium text-grovio-text-muted hover:bg-grovio-surface disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-grovio-border px-3 py-1.5 text-xs font-medium text-grovio-text-muted hover:bg-grovio-surface disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
