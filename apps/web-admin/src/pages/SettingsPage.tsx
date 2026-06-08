/**
 * SettingsPage — admin settings + branding + admin user management (Phase 11, T11).
 *
 * Tabs:
 *   1. Branding    — platform name, logo URL, theme colors (read-only labels for now)
 *   2. Admin Users — list admin users, update role (super_admin only)
 *
 * Accessible to: super_admin only
 */

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../lib/apiClient.js';

type SettingsTab = 'branding' | 'admin-users';

const TABS: { value: SettingsTab; label: string }[] = [
  { value: 'branding', label: 'Branding' },
  { value: 'admin-users', label: 'Admin Users' },
];

interface AdminUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

const ROLE_OPTIONS = ['super_admin', 'moderator', 'finance_admin'] as const;
type AdminRole = typeof ROLE_OPTIONS[number];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<SettingsTab>('branding');

  const { data: adminUsers = [], isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: () => get<AdminUser[]>('/admin/users'),
    staleTime: 60_000,
    enabled: tab === 'admin-users',
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AdminRole }) =>
      post(`/admin/users/${userId}/role`, { role }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <div>
        <h1 className="text-2xl font-bold text-grovio-text">Settings & Branding</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">Platform configuration and admin users</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-grovio-border">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
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

      {/* Branding tab */}
      {tab === 'branding' && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-6">
          <p className="text-sm text-grovio-text-muted">
            Branding configuration is managed through the{' '}
            <code className="rounded bg-grovio-surface px-1.5 py-0.5 text-xs font-mono text-grovio-text">
              platform_config
            </code>{' '}
            table and feature flags. Changes made here will be reflected across all customer-facing
            surfaces after a cache flush.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { label: 'Platform Name', placeholder: 'Grovio', key: 'platform_name' },
              { label: 'Support Email', placeholder: 'support@example.com', key: 'support_email' },
              { label: 'Logo URL', placeholder: 'https://…', key: 'logo_url' },
              { label: 'Primary Brand Color', placeholder: '#6366f1', key: 'primary_color' },
            ].map(({ label, placeholder }) => (
              <div key={label}>
                <label className="mb-1 block text-xs font-medium text-grovio-text-muted">
                  {label}
                </label>
                <input
                  type="text"
                  placeholder={placeholder}
                  disabled
                  className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text-muted cursor-not-allowed opacity-60"
                />
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-grovio-text-muted">
            Branding editor coming in a future update.
          </p>
        </div>
      )}

      {/* Admin Users tab */}
      {tab === 'admin-users' && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised overflow-hidden">
          {usersLoading ? (
            <p className="py-8 text-center text-sm text-grovio-text-muted">Loading…</p>
          ) : adminUsers.length === 0 ? (
            <p className="py-8 text-center text-sm text-grovio-text-muted">No admin users found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-grovio-border bg-grovio-surface">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Role</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Created</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((user) => (
                  <tr key={user.id} className="border-b border-grovio-border/50 hover:bg-grovio-surface">
                    <td className="px-5 py-3 font-medium text-grovio-text">{user.email}</td>
                    <td className="px-5 py-3">
                      <select
                        defaultValue={user.role}
                        onChange={(e) =>
                          updateRoleMutation.mutate({
                            userId: user.id,
                            role: e.target.value as AdminRole,
                          })
                        }
                        disabled={updateRoleMutation.isPending}
                        className="rounded-lg border border-grovio-border bg-grovio-surface px-2 py-1 text-xs text-grovio-text focus:border-grovio-primary focus:outline-none"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3 text-grovio-text-muted">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={[
                        'rounded-full px-2 py-0.5 text-[10px] font-bold capitalize',
                        user.role === 'super_admin' ? 'bg-grovio-primary/10 text-grovio-primary'
                        : user.role === 'finance_admin' ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-600',
                      ].join(' ')}>
                        {user.role?.replace(/_/g, ' ') ?? '—'}
                      </span>
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
