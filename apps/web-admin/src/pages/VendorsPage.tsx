/**
 * VendorsPage — admin vendor management (ADM-02, D-17).
 *
 * Paginated table of all vendors with colored onboarding_status badges.
 * Row actions: Approve (pending), Suspend (approved), Reinstate (suspended).
 * Configure slide-over: category restrictions + per-vendor commission override.
 *
 * Status badge colors per D-17:
 *   pending  → amber
 *   approved → green
 *   suspended → red
 *   archived  → gray
 */

import type {
  AdminVendorListItem,
  AdminVendorListResponse,
  ConfigureVendorInput,
} from '@grovio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useState } from 'react';
import { get, patch, post } from '../lib/apiClient.js';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  suspended: 'bg-red-100 text-red-800',
  archived: 'bg-grovio-surface text-grovio-text-muted',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={['inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-800'].join(' ')}>
      {status}
    </span>
  );
}

function formatInr(minor: number): string {
  const major = minor / 100;
  return `₹${major.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

interface ConfigureForm {
  categoryRestrictionIds: string;
  commissionOverridePercent: string;
}

export function VendorsPage() {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const [configVendor, setConfigVendor] = useState<AdminVendorListItem | null>(null);
  const [configForm, setConfigForm] = useState<ConfigureForm>({
    categoryRestrictionIds: '',
    commissionOverridePercent: '',
  });
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<AdminVendorListResponse>({
    queryKey: ['admin', 'vendors', offset],
    queryFn: () => get<AdminVendorListResponse>(`/admin/vendors?limit=${LIMIT}&offset=${offset}`),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'vendors'] });
  }

  const approveMutation = useMutation({
    mutationFn: (vendorId: string) => post<void>(`/admin/vendors/${vendorId}/approve`, {}),
    onSuccess: invalidate,
    onError: (err: unknown) => setActionError(err instanceof Error ? err.message : 'Failed to approve vendor'),
  });

  const suspendMutation = useMutation({
    mutationFn: (vendorId: string) => post<void>(`/admin/vendors/${vendorId}/suspend`, {}),
    onSuccess: invalidate,
    onError: (err: unknown) => setActionError(err instanceof Error ? err.message : 'Failed to suspend vendor'),
  });

  const reinstateMutation = useMutation({
    mutationFn: (vendorId: string) => post<void>(`/admin/vendors/${vendorId}/reinstate`, {}),
    onSuccess: invalidate,
    onError: (err: unknown) => setActionError(err instanceof Error ? err.message : 'Failed to reinstate vendor'),
  });

  const configureMutation = useMutation({
    mutationFn: ({ vendorId, body }: { vendorId: string; body: ConfigureVendorInput }) =>
      patch<void>(`/admin/vendors/${vendorId}/configure`, body),
    onSuccess: () => {
      invalidate();
      setConfigVendor(null);
    },
    onError: (err: unknown) => setActionError(err instanceof Error ? err.message : 'Failed to configure vendor'),
  });

  function openConfigure(vendor: AdminVendorListItem) {
    setConfigVendor(vendor);
    setConfigForm({ categoryRestrictionIds: '', commissionOverridePercent: '' });
    setActionError(null);
  }

  function handleConfigureSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!configVendor) return;
    const ids = configForm.categoryRestrictionIds
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const overrideRaw = configForm.commissionOverridePercent.trim();
    const override = overrideRaw === '' ? null : parseFloat(overrideRaw);
    configureMutation.mutate({
      vendorId: configVendor.id,
      body: {
        categoryRestrictionIds: ids,
        commissionOverridePercent: override,
      },
    });
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
        <h1 className="text-2xl font-bold text-grovio-text">Vendors</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">
          Manage vendor onboarding status, restrictions, and commission overrides.
        </p>
      </div>

      {/* Global action error */}
      {actionError && (
        <div className="mb-4 rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-4 py-3 text-sm text-grovio-error">
          {actionError}
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="ml-2 text-xs underline"
          >
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

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
          Failed to load vendors: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {/* Table */}
      {data && (
        <>
          <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
            {data.items.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-grovio-text-muted">No vendors found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-grovio-border text-left">
                      {['Vendor', 'Status', 'GMV (30d)', 'Products', 'Actions'].map((h) => (
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
                    {data.items.map((vendor) => (
                      <tr key={vendor.id} className="hover:bg-grovio-surface/40">
                        <td className="px-5 py-3">
                          <p className="font-medium text-grovio-text">{vendor.storeName ?? vendor.name}</p>
                          <p className="text-xs text-grovio-text-muted">{vendor.ownerEmail}</p>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={vendor.onboardingStatus} />
                        </td>
                        <td className="px-5 py-3 text-grovio-text">
                          {formatInr(vendor.gmvLast30dMinor)}
                        </td>
                        <td className="px-5 py-3 text-grovio-text">{vendor.productCount}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-2">
                            {vendor.onboardingStatus === 'pending' && (
                              <button
                                type="button"
                                onClick={() => approveMutation.mutate(vendor.id)}
                                disabled={approveMutation.isPending}
                                className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
                              >
                                Approve
                              </button>
                            )}
                            {vendor.onboardingStatus === 'approved' && (
                              <button
                                type="button"
                                onClick={() => suspendMutation.mutate(vendor.id)}
                                disabled={suspendMutation.isPending}
                                className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                              >
                                Suspend
                              </button>
                            )}
                            {vendor.onboardingStatus === 'suspended' && (
                              <button
                                type="button"
                                onClick={() => reinstateMutation.mutate(vendor.id)}
                                disabled={reinstateMutation.isPending}
                                className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                              >
                                Reinstate
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openConfigure(vendor)}
                              className="rounded border border-grovio-border px-2.5 py-1 text-xs font-medium text-grovio-text hover:bg-grovio-surface"
                            >
                              Configure
                            </button>
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

      {/* Configure slide-over */}
      <AnimatePresence>
        {configVendor && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfigVendor(null)}
            />
            <motion.div
              key="panel"
              className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-grovio-border bg-grovio-surface-raised shadow-xl"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-grovio-border px-6 py-4">
                  <h2 className="text-base font-semibold text-grovio-text">
                    Configure: {configVendor.storeName ?? configVendor.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setConfigVendor(null)}
                    className="text-grovio-text-muted hover:text-grovio-text"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <form
                  onSubmit={handleConfigureSubmit}
                  className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6"
                >
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-grovio-text">
                      Category Restrictions
                      <span className="ml-1 text-xs font-normal text-grovio-text-muted">
                        (UUIDs — one per line; empty = unrestricted)
                      </span>
                    </label>
                    <textarea
                      value={configForm.categoryRestrictionIds}
                      onChange={(e) =>
                        setConfigForm((f) => ({ ...f, categoryRestrictionIds: e.target.value }))
                      }
                      rows={4}
                      placeholder="550e8400-e29b-41d4-a716-446655440000&#10;..."
                      className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 font-mono text-xs text-grovio-text focus:border-grovio-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-grovio-text">
                      Commission Override %
                      <span className="ml-1 text-xs font-normal text-grovio-text-muted">
                        (empty = use global/category rate)
                      </span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={configForm.commissionOverridePercent}
                      onChange={(e) =>
                        setConfigForm((f) => ({ ...f, commissionOverridePercent: e.target.value }))
                      }
                      placeholder="e.g. 12.5"
                      className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                    />
                  </div>

                  {actionError && (
                    <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-3 py-2 text-sm text-grovio-error">
                      {actionError}
                    </div>
                  )}

                  <div className="mt-auto flex gap-3">
                    <button
                      type="button"
                      onClick={() => setConfigVendor(null)}
                      className="flex-1 rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text hover:bg-grovio-surface"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={configureMutation.isPending}
                      className="flex-1 rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {configureMutation.isPending ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
