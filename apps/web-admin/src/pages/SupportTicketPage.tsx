/**
 * SupportTicketPage — conversation view for a single support ticket (Phase 11, T10).
 *
 * Features:
 *   - Ticket subject + metadata header
 *   - Threaded reply timeline (customer ↔ admin)
 *   - Reply textarea + submit
 *   - Status update buttons (In Progress, Resolved, Closed)
 */

import { motion } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../lib/apiClient.js';
import { useAdminAuth } from '../hooks/useAdminAuth.js';

interface TicketDetail {
  id: string;
  subject: string;
  status: string;
  submittedByType: string;
  submittedByEmail: string;
  assignedToAdminEmail: string | null;
  createdAt: string;
}

interface TicketReply {
  id: string;
  body: string;
  authorType: 'customer' | 'vendor' | 'admin';
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

export function SupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { admin } = useAdminAuth();
  const [replyBody, setReplyBody] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: ticket, isLoading: ticketLoading } = useQuery<TicketDetail>({
    queryKey: ['admin', 'support-ticket', id],
    queryFn: () => get<TicketDetail>(`/admin/support-tickets/${id}`),
    enabled: Boolean(id),
  });

  const { data: replies = [], isLoading: repliesLoading } = useQuery<TicketReply[]>({
    queryKey: ['admin', 'support-ticket', id, 'replies'],
    queryFn: () => get<TicketReply[]>(`/admin/support-tickets/${id}/replies`),
    enabled: Boolean(id),
    refetchInterval: 30_000,
  });

  const replyMutation = useMutation({
    mutationFn: (body: string) =>
      post(`/admin/support-tickets/${id}/replies`, { body, authorType: 'admin' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'support-ticket', id, 'replies'] });
      setReplyBody('');
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      post(`/admin/support-tickets/${id}/status`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'support-ticket', id] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'support-tickets'] });
    },
  });

  // Scroll to bottom when replies load
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies.length]);

  if (ticketLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-grovio-text-muted">Loading ticket…</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-grovio-text-muted">Ticket not found.</p>
        <button
          type="button"
          onClick={() => navigate('/support')}
          className="text-xs font-medium text-grovio-primary hover:underline"
        >
          Back to Support
        </button>
      </div>
    );
  }

  function handleReplySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!replyBody.trim()) return;
    replyMutation.mutate(replyBody.trim());
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex h-full flex-col space-y-5"
    >
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate('/support')}
        className="w-fit text-xs font-medium text-grovio-text-muted hover:text-grovio-text"
      >
        ← Back to Support
      </button>

      {/* Ticket header */}
      <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-grovio-text">{ticket.subject}</h1>
            <p className="mt-0.5 text-sm text-grovio-text-muted">
              From: {ticket.submittedByEmail} · Opened {new Date(ticket.createdAt).toLocaleDateString()}
            </p>
            {ticket.assignedToAdminEmail && (
              <p className="mt-0.5 text-xs text-grovio-text-muted">
                Assigned to: {ticket.assignedToAdminEmail}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={[
                'rounded-full px-2.5 py-1 text-xs font-bold capitalize',
                STATUS_COLORS[ticket.status] ?? 'bg-gray-100 text-gray-600',
              ].join(' ')}
            >
              {ticket.status.replace('_', ' ')}
            </span>
            {ticket.status !== 'in_progress' && (
              <button
                type="button"
                onClick={() => statusMutation.mutate('in_progress')}
                disabled={statusMutation.isPending}
                className="rounded-lg border border-grovio-border px-2.5 py-1 text-xs font-medium text-grovio-text hover:bg-grovio-surface disabled:opacity-60"
              >
                Mark In Progress
              </button>
            )}
            {ticket.status !== 'resolved' && (
              <button
                type="button"
                onClick={() => statusMutation.mutate('resolved')}
                disabled={statusMutation.isPending}
                className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                Resolve
              </button>
            )}
            {ticket.status !== 'closed' && (
              <button
                type="button"
                onClick={() => statusMutation.mutate('closed')}
                disabled={statusMutation.isPending}
                className="rounded-lg border border-grovio-border px-2.5 py-1 text-xs font-medium text-grovio-text-muted hover:bg-grovio-surface disabled:opacity-60"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Conversation thread */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-grovio-border bg-grovio-surface-raised p-5">
        {repliesLoading ? (
          <p className="py-8 text-center text-sm text-grovio-text-muted">Loading messages…</p>
        ) : replies.length === 0 ? (
          <p className="py-8 text-center text-sm text-grovio-text-muted">No messages yet.</p>
        ) : (
          <div className="space-y-4">
            {replies.map((reply) => {
              const isAdmin = reply.authorType === 'admin';
              return (
                <div
                  key={reply.id}
                  className={['flex', isAdmin ? 'justify-end' : 'justify-start'].join(' ')}
                >
                  <div
                    className={[
                      'max-w-[70%] rounded-xl px-4 py-3',
                      isAdmin
                        ? 'bg-grovio-primary/10 text-grovio-text'
                        : 'border border-grovio-border bg-grovio-surface text-grovio-text',
                    ].join(' ')}
                  >
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-grovio-text-muted">
                      {isAdmin ? `Admin (${admin?.email ?? 'you'})` : `${reply.authorType}`}
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{reply.body}</p>
                    <p className="mt-1 text-[10px] text-grovio-text-muted text-right">
                      {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Reply form */}
      {ticket.status !== 'closed' && (
        <form onSubmit={handleReplySubmit} className="flex gap-3">
          <textarea
            rows={3}
            placeholder="Type your reply…"
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            className="flex-1 rounded-xl border border-grovio-border bg-grovio-surface-raised px-4 py-3 text-sm text-grovio-text placeholder-grovio-text-muted/60 focus:border-grovio-primary focus:outline-none resize-none"
          />
          <button
            type="submit"
            disabled={replyMutation.isPending || !replyBody.trim()}
            className="self-end rounded-xl bg-grovio-primary px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {replyMutation.isPending ? 'Sending…' : 'Reply'}
          </button>
        </form>
      )}
    </motion.div>
  );
}
