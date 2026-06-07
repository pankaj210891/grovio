/**
 * CatalogModerationPage — product moderation queue (Phase 11).
 *
 * Features:
 *   - Tabs: Pending Review / Flagged / Approved / Rejected
 *   - Product cards with thumbnail, name, vendor, price, flag reason
 *   - Approve / Reject / Flag actions per product
 *   - Bulk product CSV import link to /catalog-moderation/import
 */

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../lib/apiClient.js';

type ModerationStatus = 'pending' | 'flagged' | 'approved' | 'rejected';

interface Product {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  vendorName: string;
  priceMinorUnits: number;
  moderationStatus: string;
  flagReason: string | null;
  submittedAt: string;
}

interface ProductListResponse {
  items: Product[];
  total: number;
}

const TABS: { value: ModerationStatus; label: string }[] = [
  { value: 'pending', label: 'Pending Review' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function formatInr(minor: number): string {
  return `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

export function CatalogModerationPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ModerationStatus>('pending');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<ProductListResponse>({
    queryKey: ['admin', 'catalog', tab, page],
    queryFn: () =>
      get<ProductListResponse>(`/admin/catalog/products?moderationStatus=${tab}&page=${page}&pageSize=20`),
    staleTime: 30_000,
  });

  const moderateMutation = useMutation({
    mutationFn: ({
      productId,
      action,
      reason,
    }: {
      productId: string;
      action: 'approve' | 'reject' | 'flag';
      reason?: string;
    }) => post(`/admin/catalog/products/${productId}/moderate`, { action, reason }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] }),
  });

  const products = data?.items ?? [];
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
          <h1 className="text-2xl font-bold text-grovio-text">Catalog Moderation</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">{total} products in this view</p>
        </div>
        <Link
          to="/catalog-moderation/import"
          className="rounded-lg border border-grovio-border px-3 py-1.5 text-xs font-medium text-grovio-text hover:bg-grovio-surface"
        >
          Bulk CSV Import
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-grovio-border">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => { setTab(t.value); setPage(1); }}
            className={[
              'px-4 py-2 text-sm font-medium transition-colors border-b-2',
              tab === t.value
                ? 'border-grovio-primary text-grovio-primary'
                : 'border-transparent text-grovio-text-muted hover:text-grovio-text',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Product list */}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-grovio-text-muted">Loading…</p>
      ) : products.length === 0 ? (
        <p className="py-12 text-center text-sm text-grovio-text-muted">No products in this queue.</p>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-4 rounded-xl border border-grovio-border bg-grovio-surface-raised p-4"
            >
              {/* Thumbnail */}
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-grovio-border bg-grovio-surface">
                {product.thumbnailUrl ? (
                  <img
                    src={product.thumbnailUrl}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">📦</div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-grovio-text">{product.name}</p>
                <p className="text-xs text-grovio-text-muted">
                  by {product.vendorName} · {formatInr(product.priceMinorUnits)}
                </p>
                {product.flagReason && (
                  <p className="mt-1 text-xs text-grovio-error">Flag: {product.flagReason}</p>
                )}
              </div>

              {/* Date */}
              <span className="shrink-0 text-xs text-grovio-text-muted">
                {new Date(product.submittedAt).toLocaleDateString()}
              </span>

              {/* Actions */}
              {(tab === 'pending' || tab === 'flagged') && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => moderateMutation.mutate({ productId: product.id, action: 'approve' })}
                    disabled={moderateMutation.isPending}
                    className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => moderateMutation.mutate({ productId: product.id, action: 'reject' })}
                    disabled={moderateMutation.isPending}
                    className="rounded-lg border border-grovio-error px-2.5 py-1 text-xs font-medium text-grovio-error hover:bg-grovio-error/5 disabled:opacity-60"
                  >
                    Reject
                  </button>
                  {tab === 'pending' && (
                    <button
                      type="button"
                      onClick={() => moderateMutation.mutate({ productId: product.id, action: 'flag', reason: 'Requires review' })}
                      disabled={moderateMutation.isPending}
                      className="rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                    >
                      Flag
                    </button>
                  )}
                </div>
              )}
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
