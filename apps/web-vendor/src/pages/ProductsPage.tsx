/**
 * Vendor Products page (Plan 11-03, T3).
 *
 * Product list table with "Create Product" button linking to wizard.
 * Bulk Archive action for selected products.
 * Filter by status.
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/apiClient.js';
import { useUiStore } from '../stores/uiStore.js';

interface Product {
  id: string;
  name: string;
  slug: string;
  status: string;
  basePriceMinor: number;
  category?: string;
  stock?: number;
  createdAt: string;
  updatedAt?: string;
}

interface ProductsResponse {
  success: boolean;
  data: { products: Product[] };
}

type StatusFilter = 'all' | 'active' | 'draft' | 'archived' | 'pending_review';

function formatMajor(minorUnits: number, currency = 'INR'): string {
  const major = minorUnits / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(major);
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-600',
  archived: 'bg-red-100 text-red-600',
  pending_review: 'bg-amber-100 text-amber-700',
};

const STATUS_LABELS: Record<string, string> = {
  all: 'All',
  active: 'Active',
  draft: 'Draft',
  archived: 'Archived',
  pending_review: 'Pending Review',
};

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useUiStore();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, error: queryError } = useQuery<Product[]>({
    queryKey: ['vendorProducts'],
    queryFn: async () => {
      const res = await apiClient.get<ProductsResponse>('/vendor/products');
      return res.data.products;
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => apiClient.patch(`/vendor/products/${id}`, { status: 'archived' }))),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorProducts'] });
      setSelectedIds(new Set());
      addToast({ id: Date.now().toString(), message: 'Products archived.', variant: 'success' });
    },
    onError: () => {
      addToast({ id: Date.now().toString(), message: 'Failed to archive products.', variant: 'error' });
    },
  });

  const filteredProducts = (data ?? []).filter(
    (p) => statusFilter === 'all' || p.status === statusFilter,
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grovio-text">Products</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">
            Manage your product catalog.
          </p>
        </div>
        <div className="flex gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text hover:bg-grovio-surface">
            <span>CSV Upload</span>
            <input type="file" accept=".csv" className="hidden" onChange={() => {
              addToast({ id: Date.now().toString(), message: 'CSV import coming soon.', variant: 'info' });
            }} />
          </label>
          <Link
            to="/products/new"
            className="rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            + Create Product
          </Link>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-grovio-border pb-px">
        {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={[
              'shrink-0 rounded-t-lg px-3 py-1.5 text-sm font-medium transition-colors',
              statusFilter === s
                ? 'border-b-2 border-grovio-primary text-grovio-primary'
                : 'text-grovio-text-muted hover:text-grovio-text',
            ].join(' ')}
          >
            {STATUS_LABELS[s]}
            {s !== 'all' && data && (
              <span className="ml-1.5 rounded-full bg-grovio-surface px-1.5 py-0.5 text-xs">
                {data.filter((p) => p.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center justify-between rounded-lg border border-grovio-border bg-grovio-surface-raised px-4 py-2.5"
        >
          <span className="text-sm font-medium text-grovio-text">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            disabled={archiveMutation.isPending}
            onClick={() => archiveMutation.mutate([...selectedIds])}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-grovio-error hover:bg-grovio-error/10 disabled:opacity-50"
          >
            Archive Selected
          </button>
        </motion.div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {/* Error */}
      {queryError && (
        <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
          Failed to load products:{' '}
          {queryError instanceof Error ? queryError.message : 'Unknown error'}
        </div>
      )}

      {/* Products table */}
      {data && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          {filteredProducts.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-grovio-text-muted">
                {statusFilter === 'all'
                  ? 'No products yet.'
                  : `No ${STATUS_LABELS[statusFilter].toLowerCase()} products.`}
              </p>
              {statusFilter === 'all' && (
                <Link
                  to="/products/new"
                  className="mt-3 inline-block text-sm font-medium text-grovio-primary hover:underline"
                >
                  Create your first product
                </Link>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grovio-border text-left">
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-grovio-border"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Name</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Status</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Price</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Updated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-grovio-border">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-grovio-surface/50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        className="rounded border-grovio-border"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-grovio-text">{product.name}</p>
                        <p className="text-xs text-grovio-text-muted">{product.slug}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          STATUS_COLORS[product.status] ?? 'bg-gray-100 text-gray-600',
                        ].join(' ')}
                      >
                        {product.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-grovio-text">
                      {formatMajor(product.basePriceMinor)}
                    </td>
                    <td className="px-4 py-3 text-grovio-text-muted">
                      {new Date(product.updatedAt ?? product.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/products/${product.id}`}
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-grovio-primary hover:bg-grovio-primary/10"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </motion.div>
  );
}
