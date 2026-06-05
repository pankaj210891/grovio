/**
 * AuditLogPage — filterable admin audit log (ADM-07, D-13).
 *
 * Filters: actor type, action (text), entity type (text), date range.
 * GET /admin/audit-log with query params.
 * Offset pagination. Shows before/after diffs in expandable rows.
 *
 * audit_log table is append-only — no mutations from this page.
 */

import type { AuditActorType, AuditLogEntry, AuditLogResponse } from '@grovio/contracts';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { get } from '../lib/apiClient.js';

const ACTOR_TYPES: Array<AuditActorType | ''> = ['', 'admin', 'vendor', 'system'];

interface Filters {
  actorType: AuditActorType | '';
  action: string;
  entityType: string;
  from: string;
  to: string;
}

function buildQueryString(filters: Filters, offset: number, limit: number): string {
  const params = new URLSearchParams();
  if (filters.actorType) params.set('actorType', filters.actorType);
  if (filters.action) params.set('action', filters.action);
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.from) params.set('from', new Date(filters.from).toISOString());
  if (filters.to) params.set('to', new Date(filters.to).toISOString());
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return params.toString();
}

function DiffView({ label, data }: { label: string; data: unknown }) {
  if (data == null) return null;
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-grovio-text-muted">
        {label}
      </p>
      <pre className="overflow-x-auto rounded bg-grovio-surface px-3 py-2 text-[11px] text-grovio-text-muted">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = entry.before != null || entry.after != null;

  return (
    <>
      <tr
        className={['hover:bg-grovio-surface/40', hasDiff ? 'cursor-pointer' : ''].join(' ')}
        onClick={() => hasDiff && setExpanded((v) => !v)}
      >
        <td className="px-5 py-3 text-xs text-grovio-text-muted">
          {new Date(entry.createdAt).toLocaleString('en-IN')}
        </td>
        <td className="px-5 py-3">
          <span
            className={[
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
              entry.actorType === 'admin'
                ? 'bg-blue-100 text-blue-800'
                : entry.actorType === 'vendor'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-gray-100 text-gray-700',
            ].join(' ')}
          >
            {entry.actorType}
          </span>
        </td>
        <td className="px-5 py-3 text-xs text-grovio-text-muted">{entry.actorEmail}</td>
        <td className="px-5 py-3">
          <span className="font-mono text-xs text-grovio-text">{entry.action}</span>
        </td>
        <td className="px-5 py-3 text-xs text-grovio-text-muted">{entry.entityType}</td>
        <td className="px-5 py-3 font-mono text-[10px] text-grovio-text-muted">
          {entry.entityId.slice(0, 12)}…
        </td>
        <td className="px-5 py-3 text-xs text-grovio-text-muted">
          {hasDiff && (
            <span className="text-grovio-primary">{expanded ? '▲ less' : '▼ diff'}</span>
          )}
        </td>
      </tr>
      {expanded && hasDiff && (
        <tr>
          <td colSpan={7} className="px-5 pb-4 pt-0">
            <div className="rounded-lg border border-grovio-border bg-grovio-surface p-4 space-y-3">
              <DiffView label="Before" data={entry.before} />
              <DiffView label="After" data={entry.after} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function AuditLogPage() {
  const [filters, setFilters] = useState<Filters>({
    actorType: '',
    action: '',
    entityType: '',
    from: '',
    to: '',
  });
  const [appliedFilters, setAppliedFilters] = useState<Filters>(filters);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const { data, isLoading, error } = useQuery<AuditLogResponse>({
    queryKey: ['admin', 'audit-log', appliedFilters, offset],
    queryFn: () =>
      get<AuditLogResponse>(`/admin/audit-log?${buildQueryString(appliedFilters, offset, LIMIT)}`),
  });

  function handleApply() {
    setOffset(0);
    setAppliedFilters({ ...filters });
  }

  function handleReset() {
    const empty: Filters = { actorType: '', action: '', entityType: '', from: '', to: '' };
    setFilters(empty);
    setAppliedFilters(empty);
    setOffset(0);
  }

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0;
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-grovio-text">Audit Log</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">
          Filterable event history — append-only. Click a row with a diff to expand before/after state.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-5 rounded-xl border border-grovio-border bg-grovio-surface-raised p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {/* Actor type */}
          <div>
            <label className="mb-1 block text-xs font-medium text-grovio-text-muted">Actor Type</label>
            <select
              value={filters.actorType}
              onChange={(e) =>
                setFilters((f) => ({ ...f, actorType: e.target.value as AuditActorType | '' }))
              }
              className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
            >
              {ACTOR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === '' ? 'All types' : t}
                </option>
              ))}
            </select>
          </div>

          {/* Action */}
          <div>
            <label className="mb-1 block text-xs font-medium text-grovio-text-muted">Action</label>
            <input
              type="text"
              value={filters.action}
              onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
              placeholder="e.g. vendor.approved"
              className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
            />
          </div>

          {/* Entity type */}
          <div>
            <label className="mb-1 block text-xs font-medium text-grovio-text-muted">Entity Type</label>
            <input
              type="text"
              value={filters.entityType}
              onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}
              placeholder="e.g. vendor"
              className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
            />
          </div>

          {/* Date from */}
          <div>
            <label className="mb-1 block text-xs font-medium text-grovio-text-muted">From</label>
            <input
              type="datetime-local"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="mb-1 block text-xs font-medium text-grovio-text-muted">To</label>
            <input
              type="datetime-local"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={handleApply}
            className="rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text hover:bg-grovio-surface"
          >
            Reset
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
          Failed to load audit log: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {data && (
        <>
          <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
            {data.items.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-grovio-text-muted">
                No events match the current filters.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-grovio-border text-left">
                      {['Timestamp', 'Actor', 'Email', 'Action', 'Entity Type', 'Entity ID', 'Diff'].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-grovio-text-muted"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grovio-border">
                    {data.items.map((entry) => (
                      <AuditRow key={entry.id} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-grovio-text-muted">
              <span>
                Page {currentPage} of {totalPages} ({data.total} total events)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                  disabled={offset === 0}
                  className="rounded border border-grovio-border px-3 py-1 hover:bg-grovio-surface disabled:opacity-50"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  onClick={() => setOffset(offset + LIMIT)}
                  disabled={offset + LIMIT >= data.total}
                  className="rounded border border-grovio-border px-3 py-1 hover:bg-grovio-surface disabled:opacity-50"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
