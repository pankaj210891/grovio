/**
 * Vendor Settings page (VEN-01) — owner only.
 *
 * Return Policy section (Phase 5 D-22 completing the setup):
 *   return_window_days (int) + returns_enabled (bool)
 *   → PATCH /vendor/profile/return-policy
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import { useUiStore } from '../stores/uiStore.js';

// WR-06: local type matching the actual backend UpdateReturnPolicyInputSchema / GET response
// (backend uses isReturnable, the @grovio/contracts VendorReturnPolicy uses returnsEnabled — diverged)
interface VendorReturnPolicyActual {
  returnWindowDays: number;
  isReturnable: boolean;
}

interface ReturnPolicyResponse {
  success: boolean;
  data: VendorReturnPolicyActual | null;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useUiStore();

  const [returnWindowDays, setReturnWindowDays] = useState('14');
  // WR-06: renamed from returnsEnabled to isReturnable to match backend field name
  const [isReturnable, setIsReturnable] = useState(true);

  const { data, isLoading } = useQuery<VendorReturnPolicyActual | null>({
    queryKey: ['vendorReturnPolicy'],
    queryFn: async () => {
      const res = await apiClient.get<ReturnPolicyResponse>('/vendor/profile/return-policy');
      return res.data;
    },
  });

  useEffect(() => {
    if (data) {
      setReturnWindowDays(String(data.returnWindowDays));
      // WR-06: read isReturnable (not returnsEnabled) from backend response
      setIsReturnable(data.isReturnable);
    }
  }, [data]);

  const saveMutation = useMutation({
    // WR-06: send isReturnable to match backend UpdateReturnPolicyInputSchema
    mutationFn: (body: { returnWindowDays: number; isReturnable: boolean }) =>
      apiClient.patch('/vendor/profile/return-policy', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorReturnPolicy'] });
      addToast({ id: Date.now().toString(), message: 'Return policy saved.', variant: 'success' });
    },
    onError: () => {
      addToast({ id: Date.now().toString(), message: 'Failed to save return policy.', variant: 'error' });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveMutation.mutate({
      returnWindowDays: parseInt(returnWindowDays, 10),
      isReturnable,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-grovio-text">Settings</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">
          Configure your store preferences.
        </p>
      </div>

      {/* Return Policy Section */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-grovio-text">
          Return Policy
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-6"
          >
            <div className="space-y-5">
              {/* Returns enabled toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-grovio-text">
                    Accept returns
                  </p>
                  <p className="text-xs text-grovio-text-muted">
                    Allow customers to submit return requests for orders.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isReturnable}
                  onClick={() => setIsReturnable(!isReturnable)}
                  className={[
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
                    isReturnable ? 'bg-grovio-primary' : 'bg-grovio-border',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      isReturnable ? 'translate-x-6' : 'translate-x-1',
                    ].join(' ')}
                  />
                </button>
              </div>

              {/* Return window */}
              {isReturnable && (
                <div>
                  <label
                    htmlFor="return-window"
                    className="mb-1 block text-sm font-medium text-grovio-text"
                  >
                    Return window (days){' '}
                    <span className="text-grovio-error">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="return-window"
                      type="number"
                      min={0}
                      max={365}
                      required
                      value={returnWindowDays}
                      onChange={(e) => setReturnWindowDays(e.target.value)}
                      className="w-32 rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                    />
                    <span className="text-sm text-grovio-text-muted">
                      days after delivery
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-grovio-text-muted">
                    Customers can submit return requests within this window.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="rounded-lg bg-grovio-primary px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </form>
        )}
      </section>
    </motion.div>
  );
}
