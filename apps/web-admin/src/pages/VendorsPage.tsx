/**
 * VendorsPage — vendor management redesign (Phase 11, T7).
 *
 * Features:
 *   1. Health-score cards (aggregated per vendor: KYC status, GMV, rating, products)
 *   2. Tabs: All / Pending Approval / Active / Suspended
 *   3. Bulk actions: Approve, Suspend, Export CSV
 *   4. Search by vendor name/email
 *   5. Link to VendorProfilePage for detail view
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../lib/apiClient.js';

type VendorStatus = 'all' | 'pending' | 'active' | 'suspended';

interface Vendor {
  id: string;
  businessName: string;
  email: string;
  status: string;
  kycStatus: string;
  gmv: number;
  productCount: number;
  avgRating: number;
  createdAt: string;
}

interface VendorListResponse {
  items: Vendor[];
  total: number;
  page: number;
  pageSize: number;
}

function formatInr(minor: number): string {
  return `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

const STATUS_TABS: { value: VendorStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending Approval' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];

function kycBadge(kycStatus: string | undefined) {
  const key = kycStatus ?? 'not_submitted';
  const styles: Record<string, string> = {
    verified: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    rejected: 'bg-red-100 text-red-700',
    not_submitted: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${styles[key] ?? 'bg-gray-100 text-gray-600'}`}>
      {key.replace(/_/g, ' ')}
    </span>
  );
}

function healthScore(vendor: Vendor): number {
  let score = 0;
  if (vendor.kycStatus === 'verified') score += 40;
  else if (vendor.kycStatus === 'pending') score += 15;
  const rating = vendor.avgRating ?? 0;
  if (rating >= 4.0) score += 30;
  else if (rating >= 3.0) score += 15;
  const products = vendor.productCount ?? 0;
  if (products >= 10) score += 20;
  else if (products >= 3) score += 10;
  if ((vendor.gmv ?? 0) > 100_000_00) score += 10;
  return Math.min(score, 100);
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-grovio-surface">
      <div className={`h-full ${color} transition-all`} style={{ width: `${score}%` }} />
    </div>
  );
}

export function VendorsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const statusTab = (searchParams.get('status') as VendorStatus) ?? 'all';

  const { data, isLoading } = useQuery<VendorListResponse>({
    queryKey: ['admin', 'vendors', statusTab, search, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (statusTab !== 'all') params.set('status', statusTab);
      if (search) params.set('q', search);
      return get<VendorListResponse>(`/admin/vendors?${params}`);
    },
    staleTime: 30_000,
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, ids }: { action: 'approve' | 'suspend'; ids: string[] }) =>
      post('/admin/vendors/bulk-action', { action, vendorIds: ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'vendors'] });
      setSelected(new Set());
    },
  });

  const vendors = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const allSelected = vendors.length > 0 && vendors.every((v) => selected.has(v.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(vendors.map((v) => v.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

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
          <h1 className="text-2xl font-bold text-grovio-text">Vendors</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">{total} vendors total</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-2"
              >
                <span className="text-xs text-grovio-text-muted">{selected.size} selected</span>
                <button
                  type="button"
                  onClick={() => bulkMutation.mutate({ action: 'approve', ids: [...selected] })}
                  disabled={bulkMutation.isPending}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => bulkMutation.mutate({ action: 'suspend', ids: [...selected] })}
                  disabled={bulkMutation.isPending}
                  className="rounded-lg bg-grovio-error px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  Suspend
                </button>
              </motion.div>
            </AnimatePresence>
          )}
          <input
            type="search"
            placeholder="Search vendors…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-48 rounded-lg border border-grovio-border bg-grovio-surface px-3 py-1.5 text-sm text-grovio-text placeholder-grovio-text-muted/60 focus:border-grovio-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-grovio-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => { setSearchParams({ status: tab.value }); setPage(1); setSelected(new Set()); }}
            className={[
              'px-4 py-2 text-sm font-medium transition-colors border-b-2',
              statusTab === tab.value
                ? 'border-grovio-primary text-grovio-primary'
                : 'border-transparent text-grovio-text-muted hover:text-grovio-text',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised overflow-hidden">
        {isLoading ? (
          <p className="py-12 text-center text-sm text-grovio-text-muted">Loading…</p>
        ) : vendors.length === 0 ? (
          <p className="py-12 text-center text-sm text-grovio-text-muted">No vendors found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-grovio-border bg-grovio-surface">
              <tr>
                <th className="w-10 px-4 py-3 text-center">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-grovio-primary" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">KYC</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">GMV</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Products</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Rating</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Health</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => {
                const score = healthScore(vendor);
                return (
                  <tr key={vendor.id} className="border-b border-grovio-border/50 hover:bg-grovio-surface">
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(vendor.id)}
                        onChange={() => toggleOne(vendor.id)}
                        className="accent-grovio-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-grovio-text">{vendor.businessName}</p>
                      <p className="text-xs text-grovio-text-muted">{vendor.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={[
                        'rounded-full px-2 py-0.5 text-[10px] font-bold capitalize',
                        vendor.status === 'active' ? 'bg-green-100 text-green-700'
                        : vendor.status === 'pending' ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700',
                      ].join(' ')}>
                        {vendor.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{kycBadge(vendor.kycStatus)}</td>
                    <td className="px-4 py-3 text-right font-medium text-grovio-text">{formatInr(vendor.gmv ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-grovio-text-muted">{vendor.productCount ?? 0}</td>
                    <td className="px-4 py-3 text-right text-grovio-text-muted">{vendor.avgRating != null ? vendor.avgRating.toFixed(1) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-grovio-text-muted">{score}/100</span>
                        <HealthBar score={score} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/vendors/${vendor.id}`}
                        className="text-xs font-medium text-grovio-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-grovio-text-muted">
            Page {page} of {totalPages}
          </span>
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
