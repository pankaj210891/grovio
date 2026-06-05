/**
 * CatalogModerationPage — admin catalog moderation (ADM-07).
 *
 * Lists pending vendor products via GET /admin/products (with status filter).
 * Admin can approve or reject products via POST endpoints.
 * Cookie-guarded Phase 6 backend endpoints.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { get, post } from '../lib/apiClient.js';

interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  status: string;
  vendorName: string;
  vendorId: string;
  createdAt: string;
  basePriceMinor?: number;
}

interface AdminProductsResponse {
  items: AdminProduct[];
  total: number;
  limit: number;
  offset: number;
}

function formatInr(minor: number): string {
  return `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

const STATUS_BADGE: Record<string, string> = {
  pending_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  archived: 'bg-gray-100 text-gray-700',
};

export function CatalogModerationPage() {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('pending_review');
  const [actionError, setActionError] = useState<string | null>(null);
  const LIMIT = 20;

  const { data, isLoading, error } = useQuery<AdminProductsResponse>({
    queryKey: ['admin', 'products', statusFilter, offset],
    queryFn: () =>
      get<AdminProductsResponse>(
        `/admin/products?status=${statusFilter}&limit=${LIMIT}&offset=${offset}`,
      ),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
  }

  const approveMutation = useMutation({
    mutationFn: (productId: string) => post<void>(`/admin/products/${productId}/approve`, {}),
    onSuccess: invalidate,
    onError: (err: unknown) =>
      setActionError(err instanceof Error ? err.message : 'Failed to approve product'),
  });

  const rejectMutation = useMutation({
    mutationFn: (productId: string) => post<void>(`/admin/products/${productId}/reject`, {}),
    onSuccess: invalidate,
    onError: (err: unknown) =>
      setActionError(err instanceof Error ? err.message : 'Failed to reject product'),
  });

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0;
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-grovio-text">Catalog Moderation</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">
            Review and approve or reject vendor product submissions.
          </p>
        </div>

        {/* Status filter */}
        <div className="flex rounded-lg border border-grovio-border bg-grovio-surface-raised p-0.5">
          {['pending_review', 'approved', 'rejected'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatusFilter(s);
                setOffset(0);
              }}
              className={[
                'rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                statusFilter === s
                  ? 'bg-grovio-primary text-white shadow-sm'
                  : 'text-grovio-text-muted hover:text-grovio-text',
              ].join(' ')}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {actionError && (
        <div className="mb-4 rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-4 py-3 text-sm text-grovio-error">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="ml-2 text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {/* Fetch error */}
      {error && (
        <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
          Failed to load products: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {/* Table */}
      {data && (
        <>
          <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
            {data.items.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-grovio-text-muted">
                No {statusFilter.replace('_', ' ')} products.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-grovio-border text-left">
                      {['Product', 'Vendor', 'Price', 'Status', 'Submitted', 'Actions'].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-grovio-text-muted"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grovio-border">
                    {data.items.map((product) => (
                      <tr key={product.id} className="hover:bg-grovio-surface/40">
                        <td className="px-5 py-3">
                          <p className="font-medium text-grovio-text">{product.name}</p>
                          <p className="text-xs text-grovio-text-muted">{product.slug}</p>
                        </td>
                        <td className="px-5 py-3 text-grovio-text-muted">{product.vendorName}</td>
                        <td className="px-5 py-3 text-grovio-text">
                          {product.basePriceMinor != null ? formatInr(product.basePriceMinor) : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={[
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                              STATUS_BADGE[product.status] ?? 'bg-gray-100 text-gray-800',
                            ].join(' ')}
                          >
                            {product.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-grovio-text-muted">
                          {new Date(product.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2">
                            {product.status === 'pending_review' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => approveMutation.mutate(product.id)}
                                  disabled={approveMutation.isPending}
                                  className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => rejectMutation.mutate(product.id)}
                                  disabled={rejectMutation.isPending}
                                  className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {product.status !== 'pending_review' && (
                              <span className="text-xs text-grovio-text-muted">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
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
                Page {currentPage} of {totalPages} ({data.total} total)
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
