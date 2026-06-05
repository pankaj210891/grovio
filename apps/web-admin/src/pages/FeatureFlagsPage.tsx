/**
 * FeatureFlagsPage — admin feature flag management (ADM-06, D-12).
 *
 * Simple toggle list. GET /admin/feature-flags → all flags.
 * Toggle → PATCH /admin/feature-flags/:key { enabled: boolean }.
 * FeatureFlagService invalidates Redis cache on update.
 * Pure on/off in v1 — no rollout percentages.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { get, patch } from '../lib/apiClient.js';

interface FeatureFlag {
  id: string;
  key: string;
  isEnabled: boolean;
  description: string;
  updatedAt: string;
}

interface FeatureFlagsResponse {
  flags: FeatureFlag[];
}

export function FeatureFlagsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<FeatureFlagsResponse>({
    queryKey: ['admin', 'feature-flags'],
    queryFn: () => get<FeatureFlagsResponse>('/admin/feature-flags'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      patch<void>(`/admin/feature-flags/${key}`, { enabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'feature-flags'] });
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-grovio-text">Feature Flags</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">
          Enable or disable marketplace features. Changes take effect immediately (Redis cache invalidated).
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
          Failed to load feature flags: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {data && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          {data.flags.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-grovio-text-muted">No feature flags found.</p>
          ) : (
            <ul className="divide-y divide-grovio-border">
              {data.flags.map((flag) => (
                <li
                  key={flag.key}
                  className="flex items-center justify-between gap-6 px-6 py-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-medium text-grovio-text">{flag.key}</p>
                    {flag.description && (
                      <p className="mt-0.5 text-xs text-grovio-text-muted">{flag.description}</p>
                    )}
                    <p className="mt-1 text-[10px] text-grovio-text-muted">
                      Last updated: {new Date(flag.updatedAt).toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className={[
                        'text-xs font-medium',
                        flag.isEnabled ? 'text-green-700' : 'text-grovio-text-muted',
                      ].join(' ')}
                    >
                      {flag.isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={flag.isEnabled}
                      onClick={() =>
                        toggleMutation.mutate({ key: flag.key, enabled: !flag.isEnabled })
                      }
                      disabled={toggleMutation.isPending}
                      className={[
                        'relative h-6 w-11 rounded-full transition-colors focus:outline-none disabled:opacity-60',
                        flag.isEnabled ? 'bg-grovio-primary' : 'bg-gray-300',
                      ].join(' ')}
                      aria-label={`Toggle ${flag.key}`}
                    >
                      <span
                        className={[
                          'absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform',
                          flag.isEnabled ? 'translate-x-6' : 'translate-x-1',
                        ].join(' ')}
                      />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </motion.div>
  );
}
