/**
 * VendorRestrictionsPage — manage vendor access restrictions for a category.
 *
 * Per CAT-06 / D-10: Admin can toggle is_restricted on the category and manage
 * the approved vendor allowlist. Enforcement at product creation is deferred to
 * Phase 3 (D-11) — the UI communicates this clearly.
 *
 * Routes called:
 *   GET    /categories/:id                              → read is_restricted flag
 *   PATCH  /admin/categories/:id                        → toggle is_restricted
 *   GET    /categories/:id/restrictions                 → list approved vendor IDs
 *   POST   /admin/categories/:id/restrictions/vendors   → add vendor to allowlist
 *   DELETE /admin/categories/:id/restrictions/vendors/:vendorId → remove vendor
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { del, get, patch, post } from '../../lib/apiClient.js';

interface CategoryRestrictionState {
  id: string;
  isRestricted: boolean;
}

interface VendorRestrictionsPageProps {
  categoryId: string;
  /** Initial isRestricted value from the category detail query (avoids a second round-trip) */
  isRestricted: boolean;
}

export default function VendorRestrictionsPage({ categoryId, isRestricted: initialIsRestricted }: VendorRestrictionsPageProps) {
  const queryClient = useQueryClient();
  const [newVendorId, setNewVendorId] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // API returns { isRestricted, approvedVendorIds: string[] } — we surface just the IDs
  const { data: approvedVendorIds, isLoading: restrictionsLoading } = useQuery<string[]>({
    queryKey: ['categories', categoryId, 'restrictions'],
    queryFn: async () => {
      const data = await get<{ isRestricted: boolean; approvedVendorIds: string[] }>(
        `/categories/${categoryId}/restrictions`,
      );
      return data.approvedVendorIds;
    },
    enabled: Boolean(categoryId),
  });

  // Read is_restricted from the category detail cache — avoids double fetch
  const categoryDetail = queryClient.getQueryData<{ isRestricted: boolean }>(['categories', categoryId]);
  const isRestricted = categoryDetail?.isRestricted ?? initialIsRestricted;

  const toggleMutation = useMutation({
    mutationFn: (value: boolean) =>
      patch<{ id: string; isRestricted: boolean }>(`/admin/categories/${categoryId}`, { isRestricted: value }),
    onSuccess: (updated) => {
      // Merge the updated flag back into the category cache
      queryClient.setQueryData<{ isRestricted: boolean }>(
        ['categories', categoryId],
        (old) => old ? { ...old, isRestricted: updated.isRestricted } : { isRestricted: updated.isRestricted },
      );
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      setToggleError(null);
    },
    onError: (err: unknown) => {
      setToggleError(err instanceof Error ? err.message : 'Failed to toggle restriction.');
    },
  });

  const addVendorMutation = useMutation({
    mutationFn: (vendorId: string) =>
      post<unknown>(`/admin/categories/${categoryId}/restrictions/vendors`, { vendorId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories', categoryId, 'restrictions'] });
      setNewVendorId('');
      setAddError(null);
    },
    onError: (err: unknown) => {
      setAddError(err instanceof Error ? err.message : 'Failed to add vendor.');
    },
  });

  const removeVendorMutation = useMutation({
    mutationFn: (vendorId: string) =>
      del<unknown>(`/admin/categories/${categoryId}/restrictions/vendors/${vendorId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories', categoryId, 'restrictions'] });
    },
  });

  function handleAddVendor(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);

    const trimmed = newVendorId.trim();
    if (!trimmed) {
      setAddError('Please enter a vendor ID.');
      return;
    }

    // Basic UUID format check
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(trimmed)) {
      setAddError('Vendor ID must be a valid UUID (e.g. 550e8400-e29b-41d4-a716-446655440000).');
      return;
    }

    // Check for duplicate
    if (approvedVendorIds?.includes(trimmed)) {
      setAddError('This vendor is already on the allowlist.');
      return;
    }

    addVendorMutation.mutate(trimmed);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-grovio-text">Vendor Restrictions</h2>
        <p className="mt-0.5 text-sm text-grovio-text-muted">
          Control which vendors may sell products in this category.
        </p>
      </div>

      {/* Phase 3 enforcement notice */}
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Note:</strong> Restriction enforcement at product creation is implemented in Phase 3 (D-11).
        Changes made here configure the allowlist — enforcement will activate automatically when Phase 3 deploys.
      </div>

      {/* is_restricted toggle */}
      <div className="mb-6 rounded-lg border border-grovio-border bg-grovio-surface-raised p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-grovio-text">Restrict category to approved vendors</p>
            <p className="mt-0.5 text-xs text-grovio-text-muted">
              When enabled, only vendors on the allowlist below can sell products in this category.
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggleMutation.mutate(!isRestricted)}
            disabled={toggleMutation.isPending}
            className={[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60',
              isRestricted ? 'bg-grovio-primary' : 'bg-grovio-border',
            ].join(' ')}
            role="switch"
            aria-checked={isRestricted}
          >
            <span
              className={[
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                isRestricted ? 'translate-x-6' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
        </div>

        {toggleError && (
          <p className="mt-2 text-xs text-grovio-error">{toggleError}</p>
        )}
      </div>

      {/* Approved vendor allowlist */}
      <div className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-4">
        <h3 className="mb-3 text-sm font-medium text-grovio-text">Approved Vendor Allowlist</h3>

        {restrictionsLoading && (
          <div className="flex items-center justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
          </div>
        )}

        {!restrictionsLoading && (approvedVendorIds ?? []).length === 0 && (
          <p className="mb-4 text-sm text-grovio-text-muted">
            No vendors on the allowlist yet.
            {isRestricted
              ? ' Until vendors are added, no vendor can sell in this category once Phase 3 enforcement is active.'
              : ' (Restriction is currently off — all vendors can sell in this category.)'}
          </p>
        )}

        {!restrictionsLoading && (approvedVendorIds ?? []).length > 0 && (
          <ul className="mb-4 flex flex-col gap-2">
            {(approvedVendorIds ?? []).map((vendorId) => (
              <li
                key={vendorId}
                className="flex items-center gap-3 rounded border border-grovio-border bg-grovio-surface px-3 py-2"
              >
                <code className="flex-1 text-xs font-mono text-grovio-text">{vendorId}</code>
                <button
                  type="button"
                  onClick={() => removeVendorMutation.mutate(vendorId)}
                  disabled={removeVendorMutation.isPending && removeVendorMutation.variables === vendorId}
                  className="text-xs text-grovio-error hover:underline disabled:opacity-40"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add vendor form */}
        <form onSubmit={handleAddVendor} className="flex items-start gap-2">
          <div className="flex-1">
            <input
              type="text"
              value={newVendorId}
              onChange={(e) => setNewVendorId(e.target.value)}
              placeholder="Vendor UUID (e.g. 550e8400-e29b-41d4-a716-446655440000)"
              className="w-full rounded border border-grovio-border bg-grovio-surface px-3 py-1.5 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
            />
            {addError && (
              <p className="mt-1 text-xs text-grovio-error">{addError}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={addVendorMutation.isPending}
            className="rounded-lg bg-grovio-primary px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {addVendorMutation.isPending ? 'Adding…' : 'Add vendor'}
          </button>
        </form>
      </div>
    </motion.div>
  );
}
