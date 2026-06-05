/**
 * Vendor Team page (VEN-05) — owner only.
 *
 * GET /vendor/team → list staff members
 * POST /vendor/team/invite { email, role } → invite (role: manager | staff only)
 * DELETE /vendor/team/:id → remove (soft-delete)
 *
 * Invite role select offers only manager and staff (not owner — D-05, T-06-02).
 */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import { useUiStore } from '../stores/uiStore.js';
import type { VendorStaffMember } from '@grovio/contracts';

interface TeamResponse {
  success: boolean;
  data: { members: VendorStaffMember[] };
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-grovio-primary/10 text-grovio-primary',
  manager: 'bg-blue-100 text-blue-700',
  staff: 'bg-gray-100 text-gray-600',
};

export default function TeamPage() {
  const queryClient = useQueryClient();
  const { addToast } = useUiStore();

  const [showPanel, setShowPanel] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'staff'>('staff');
  const [inviteError, setInviteError] = useState<string | null>(null);

  const { data, isLoading, error: queryError } = useQuery<VendorStaffMember[]>({
    queryKey: ['vendorTeam'],
    queryFn: async () => {
      const res = await apiClient.get<TeamResponse>('/vendor/team');
      return res.data.members;
    },
  });

  const inviteMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: 'manager' | 'staff' }) =>
      apiClient.post('/vendor/team/invite', { email, role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorTeam'] });
      setShowPanel(false);
      setInviteEmail('');
      setInviteRole('staff');
      setInviteError(null);
      addToast({ id: Date.now().toString(), message: 'Invitation sent.', variant: 'success' });
    },
    onError: (err: unknown) => {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite.');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) =>
      apiClient.delete(`/vendor/team/${memberId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorTeam'] });
      addToast({ id: Date.now().toString(), message: 'Member removed.', variant: 'success' });
    },
    onError: () => {
      addToast({ id: Date.now().toString(), message: 'Failed to remove member.', variant: 'error' });
    },
  });

  function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteError(null);
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  }

  function handleRemove(member: VendorStaffMember) {
    if (member.role === 'owner') return; // cannot remove owner
    if (!confirm(`Remove ${member.email} from the team?`)) return;
    removeMutation.mutate(member.id);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grovio-text">Team</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">
            Manage your store team members.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPanel(true)}
          className="rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Invite Member
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {queryError && (
        <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
          Failed to load team:{' '}
          {queryError instanceof Error ? queryError.message : 'Unknown error'}
        </div>
      )}

      {data && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          {data.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-grovio-text-muted">
              No team members yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grovio-border text-left">
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Email</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Role</th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-grovio-border">
                {data.map((member) => (
                  <tr key={member.id} className="hover:bg-grovio-surface/50">
                    <td className="px-4 py-3 text-grovio-text">{member.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          ROLE_COLORS[member.role] ?? 'bg-gray-100 text-gray-600',
                        ].join(' ')}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-grovio-text-muted">
                      {member.acceptedAt
                        ? new Date(member.acceptedAt).toLocaleDateString()
                        : 'Pending'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {member.role !== 'owner' && (
                        <button
                          type="button"
                          onClick={() => handleRemove(member)}
                          disabled={removeMutation.isPending}
                          className="rounded-md px-3 py-1 text-xs font-medium text-grovio-error transition-colors hover:bg-grovio-error/10 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Invite slide-over */}
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
                  <h2 className="text-base font-semibold text-grovio-text">
                    Invite Team Member
                  </h2>
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
                  onSubmit={handleInviteSubmit}
                  className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-6"
                >
                  <div>
                    <label
                      htmlFor="invite-email"
                      className="mb-1 block text-sm font-medium text-grovio-text"
                    >
                      Email address <span className="text-grovio-error">*</span>
                    </label>
                    <input
                      id="invite-email"
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="staff@example.com"
                      className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:border-grovio-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="invite-role"
                      className="mb-1 block text-sm font-medium text-grovio-text"
                    >
                      Role <span className="text-grovio-error">*</span>
                    </label>
                    <select
                      id="invite-role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'manager' | 'staff')}
                      className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                    >
                      <option value="manager">Manager</option>
                      <option value="staff">Staff</option>
                      {/* owner intentionally omitted — T-06-02 elevation of privilege mitigation */}
                    </select>
                    <p className="mt-1 text-xs text-grovio-text-muted">
                      Owner role cannot be assigned via invite.
                    </p>
                  </div>
                  {inviteError && (
                    <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-3 py-2 text-sm text-grovio-error">
                      {inviteError}
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
                      disabled={inviteMutation.isPending}
                      className="flex-1 rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {inviteMutation.isPending ? 'Sending…' : 'Send Invite'}
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
