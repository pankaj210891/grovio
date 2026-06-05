/**
 * Vendor Coupons page (VEN-06, D-14).
 *
 * GET /vendor/coupons  → list vendor coupons (scoped to their store)
 * POST /vendor/coupons → create coupon (code, type flat/percent, value, min order, expiry, max redemptions)
 *
 * Nav item is hidden when COUPONS_ENABLED is off (Sidebar handles this).
 * If backend returns 404/403 (flag disabled), shows a graceful message.
 *
 * Discount value and min order displayed in major units.
 */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../lib/apiClient.js';
import { useUiStore } from '../stores/uiStore.js';

interface Coupon {
  id: string;
  code: string;
  discountType: 'flat' | 'percent';
  discountValue: number;
  // CR-05: field name matches backend DB column and Zod schema (minOrderMinor)
  minOrderMinor: number;
  expiresAt: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  isActive: boolean;
}

interface CouponsResponse {
  success: boolean;
  data: { coupons: Coupon[] };
}

interface CreateCouponInput {
  code: string;
  discountType: 'flat' | 'percent';
  discountValue: number;
  // CR-05: field name matches backend CreateCouponInputSchema (minOrderMinor)
  minOrderMinor: number;
  expiresAt?: string;
  maxRedemptions?: number;
}

function formatMajor(minorUnits: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minorUnits / 100);
}

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useUiStore();

  const [showPanel, setShowPanel] = useState(false);
  const [featureUnavailable, setFeatureUnavailable] = useState(false);

  // Form state
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrder, setMinOrder] = useState('0');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const { data, isLoading, error: queryError } = useQuery<Coupon[]>({
    queryKey: ['vendorCoupons'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<CouponsResponse>('/vendor/coupons');
        return res.data.coupons;
      } catch (err: unknown) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
          setFeatureUnavailable(true);
          return [];
        }
        throw err;
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateCouponInput) =>
      apiClient.post<{ success: boolean }>('/vendor/coupons', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorCoupons'] });
      setShowPanel(false);
      setCode('');
      setDiscountValue('');
      setMinOrder('0');
      setExpiresAt('');
      setMaxRedemptions('');
      setCreateError(null);
      addToast({ id: Date.now().toString(), message: 'Coupon created.', variant: 'success' });
    },
    onError: (err: unknown) => {
      setCreateError(err instanceof Error ? err.message : 'Failed to create coupon.');
    },
  });

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !discountValue) return;
    const body: CreateCouponInput = {
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: discountType === 'flat'
        ? Math.round(parseFloat(discountValue) * 100) // convert to minor if flat
        : parseFloat(discountValue),
      // CR-05: use minOrderMinor to match backend CreateCouponInputSchema
      minOrderMinor: Math.round(parseFloat(minOrder) * 100),
    };
    if (expiresAt) body.expiresAt = expiresAt;
    if (maxRedemptions) body.maxRedemptions = parseInt(maxRedemptions, 10);
    createMutation.mutate(body);
  }

  if (featureUnavailable) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center justify-center py-24 text-center"
      >
        <p className="text-lg font-semibold text-grovio-text">Coupons Unavailable</p>
        <p className="mt-2 text-sm text-grovio-text-muted">
          The coupons feature is currently disabled by the admin.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grovio-text">Coupons</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">
            Create and manage promotional coupons for your store.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPanel(true)}
          className="rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          New Coupon
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {queryError && (
        <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
          Failed to load coupons:{' '}
          {queryError instanceof Error ? queryError.message : 'Unknown error'}
        </div>
      )}

      {data && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          {data.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-grovio-text-muted">
              No coupons yet.{' '}
              <button
                type="button"
                onClick={() => setShowPanel(true)}
                className="text-grovio-primary underline underline-offset-2"
              >
                Create your first coupon.
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grovio-border text-left">
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Code</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Discount</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Min Order</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Used</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Expires</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grovio-border">
                {data.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-grovio-surface/50">
                    <td className="px-4 py-3 font-mono font-medium text-grovio-text">
                      {coupon.code}
                    </td>
                    <td className="px-4 py-3 text-grovio-text">
                      {coupon.discountType === 'percent'
                        ? `${coupon.discountValue}%`
                        : formatMajor(coupon.discountValue)}
                    </td>
                    <td className="px-4 py-3 text-grovio-text">
                      {formatMajor(coupon.minOrderMinor)}
                    </td>
                    <td className="px-4 py-3 text-grovio-text-muted">
                      {coupon.redemptionCount}
                      {coupon.maxRedemptions != null && ` / ${coupon.maxRedemptions}`}
                    </td>
                    <td className="px-4 py-3 text-grovio-text-muted">
                      {coupon.expiresAt
                        ? new Date(coupon.expiresAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          coupon.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600',
                        ].join(' ')}
                      >
                        {coupon.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create slide-over */}
      <AnimatePresence>
        {showPanel && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPanel(false)}
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
                  <h2 className="text-base font-semibold text-grovio-text">New Coupon</h2>
                  <button
                    type="button"
                    onClick={() => setShowPanel(false)}
                    className="text-grovio-text-muted transition-colors hover:text-grovio-text"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <form
                  onSubmit={handleCreateSubmit}
                  className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-6"
                >
                  <div>
                    <label htmlFor="coupon-code" className="mb-1 block text-sm font-medium text-grovio-text">
                      Code <span className="text-grovio-error">*</span>
                    </label>
                    <input
                      id="coupon-code"
                      type="text"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="SUMMER20"
                      className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm font-mono text-grovio-text placeholder:text-grovio-text-muted focus:border-grovio-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-grovio-text">
                      Discount type <span className="text-grovio-error">*</span>
                    </label>
                    <div className="flex gap-3">
                      {(['percent', 'flat'] as const).map((t) => (
                        <label key={t} className="flex cursor-pointer items-center gap-2 text-sm text-grovio-text">
                          <input
                            type="radio"
                            name="discount-type"
                            value={t}
                            checked={discountType === t}
                            onChange={() => setDiscountType(t)}
                          />
                          {t === 'percent' ? 'Percentage (%)' : 'Flat amount'}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="discount-value" className="mb-1 block text-sm font-medium text-grovio-text">
                      Discount value <span className="text-grovio-error">*</span>
                    </label>
                    <input
                      id="discount-value"
                      type="number"
                      min={0}
                      step={discountType === 'percent' ? 0.01 : 0.01}
                      required
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === 'percent' ? 'e.g. 10 for 10%' : 'e.g. 50.00'}
                      className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:border-grovio-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="min-order" className="mb-1 block text-sm font-medium text-grovio-text">
                      Minimum order amount
                    </label>
                    <input
                      id="min-order"
                      type="number"
                      min={0}
                      step={0.01}
                      value={minOrder}
                      onChange={(e) => setMinOrder(e.target.value)}
                      className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="expires-at" className="mb-1 block text-sm font-medium text-grovio-text">
                      Expiry date{' '}
                      <span className="text-xs font-normal text-grovio-text-muted">(optional)</span>
                    </label>
                    <input
                      id="expires-at"
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="max-redemptions" className="mb-1 block text-sm font-medium text-grovio-text">
                      Max redemptions{' '}
                      <span className="text-xs font-normal text-grovio-text-muted">(optional)</span>
                    </label>
                    <input
                      id="max-redemptions"
                      type="number"
                      min={1}
                      value={maxRedemptions}
                      onChange={(e) => setMaxRedemptions(e.target.value)}
                      placeholder="Unlimited"
                      className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:border-grovio-primary focus:outline-none"
                    />
                  </div>
                  {createError && (
                    <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-3 py-2 text-sm text-grovio-error">
                      {createError}
                    </div>
                  )}
                  <div className="mt-auto flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowPanel(false)}
                      className="flex-1 rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text transition-colors hover:bg-grovio-surface"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="flex-1 rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {createMutation.isPending ? 'Creating…' : 'Create'}
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
