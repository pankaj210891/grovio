/**
 * AuditLogPage — audit trail for admin actions (Phase 11).
 *
 * Displays a paginated log of admin actions (status changes, role updates, etc.)
 * sourced from /admin/audit-log endpoint.
 */

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../lib/apiClient.js';

interface AuditEntry {
  id: string;
  adminEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown> | null;
  performedAt: string;
}

interface AuditLogResponse {
  items: AuditEntry[];
  total: number;
}

export function AuditLogPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<AuditLogResponse>({
    queryKey: ['admin', 'audit-log', page],
    queryFn: () => get<AuditLogResponse>(`/admin/audit-log?page=${page}&pageSize=50`),
    staleTime: 30_000,
  });

  const entries = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <div>
        <h1 className="text-2xl font-bold text-grovio-text">Audit & Security</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">
          Log of admin actions performed on this platform. {total} entries total.
        </p>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-grovio-text-muted">Loading audit log…</p>
      ) : entries.length === 0 ? (
        <p className="py-12 text-center text-sm text-grovio-text-muted">No audit entries found.</p>
      ) : (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-grovio-border bg-grovio-surface">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Time</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Admin</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Action</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Resource</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-grovio-border/50 hover:bg-grovio-surface">
                  <td className="px-5 py-3 text-xs text-grovio-text-muted whitespace-nowrap">
                    {new Date(entry.performedAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-xs text-grovio-text">{entry.adminEmail}</td>
                  <td className="px-5 py-3">
                    <code className="rounded bg-grovio-surface px-1.5 py-0.5 text-[10px] font-mono text-grovio-text">
                      {entry.action}
                    </code>
                  </td>
                  <td className="px-5 py-3 text-xs text-grovio-text-muted">
                    <span className="capitalize">{entry.resourceType.replace('_', ' ')}</span>
                    <span className="ml-1 font-mono text-[10px]">{entry.resourceId.slice(0, 8)}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-grovio-text-muted">
                    {entry.metadata ? JSON.stringify(entry.metadata).slice(0, 60) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
