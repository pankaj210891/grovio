/**
 * FeatureFlagsPage — feature flag management (Phase 11).
 *
 * Lists platform feature flags stored in the FeatureFlags table + Redis cache.
 * Toggle on/off per flag.
 */

import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../lib/apiClient.js';

interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
  updatedAt: string;
}

export function FeatureFlagsPage() {
  const queryClient = useQueryClient();

  const { data: flags = [], isLoading } = useQuery<FeatureFlag[]>({
    queryKey: ['admin', 'feature-flags'],
    queryFn: () => get<FeatureFlag[]>('/admin/feature-flags'),
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      post(`/admin/feature-flags/${id}`, { enabled }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'feature-flags'] }),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <div>
        <h1 className="text-2xl font-bold text-grovio-text">Feature Flags</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">
          Enable or disable platform features in real time. Changes are applied immediately via Redis cache flush.
        </p>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-grovio-text-muted">Loading flags…</p>
      ) : flags.length === 0 ? (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-8 text-center">
          <p className="text-sm text-grovio-text-muted">No feature flags configured.</p>
          <p className="mt-1 text-xs text-grovio-text-muted">
            Flags are seeded into the <code className="font-mono">feature_flags</code> table during platform setup.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-grovio-border bg-grovio-surface">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Flag</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Description</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Last Updated</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.id} className="border-b border-grovio-border/50 hover:bg-grovio-surface">
                  <td className="px-5 py-3">
                    <code className="font-mono text-xs font-medium text-grovio-text">{flag.key}</code>
                  </td>
                  <td className="px-5 py-3 text-grovio-text-muted">
                    {flag.description ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-grovio-text-muted">
                    {new Date(flag.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={flag.enabled}
                      onClick={() => toggleMutation.mutate({ id: flag.id, enabled: !flag.enabled })}
                      disabled={toggleMutation.isPending}
                      className={[
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50',
                        flag.enabled ? 'bg-grovio-primary' : 'bg-grovio-border',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                          flag.enabled ? 'translate-x-4' : 'translate-x-0.5',
                        ].join(' ')}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
