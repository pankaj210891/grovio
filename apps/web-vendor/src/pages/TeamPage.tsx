/**
 * Vendor Team page — enhanced (Plan 11-03, T8).
 *
 * Sections:
 *   1. Active members: inline role change, deactivate button
 *   2. Pending invites: resend, cancel
 * Invite panel (owner only): slide-over with email + role (no owner)
 *
 * API endpoints used:
 *   GET  /vendor/team               → { members, invites }
 *   POST /vendor/team/invite        → { email, role }
 *   PATCH /vendor/team/:id/role     → { role }
 *   PATCH /vendor/team/:id/deactivate
 *   POST /vendor/team/invite/:id/resend
 *   DELETE /vendor/team/invite/:id  → cancel invite
 *   DELETE /vendor/team/:id         → remove active member
 */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import { useUiStore } from '../stores/uiStore.js';
import type { VendorStaffMember } from '@grovio/contracts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PendingInvite {
  id: string;
  email: string;
  role: 'manager' | 'staff';
  createdAt: string;
  expiresAt?: string;
}

interface TeamResponse {
  success: boolean;
  data: { members: VendorStaffMember[]; invites?: PendingInvite[] };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-grovio-primary/10 text-grovio-primary',
  manager: 'bg-blue-100 text-blue-700',
  staff: 'bg-gray-100 text-gray-600',
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function TeamPage() {
  const queryClient = useQueryClient();
  const { addToast } = useUiStore();

  const [showPanel, setShowPanel] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'staff'>('staff');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);

  // ── Queries
  const { data, isLoading, error: queryError } = useQuery<{
    members: VendorStaffMember[];
    invites: PendingInvite[];
  }>({
    queryKey: ['vendorTeam'],
    queryFn: async () => {
      const res = await apiClient.get<TeamResponse>('/vendor/team');
      return {
        members: res.data.members,
        invites: res.data.invites ?? [],
      };
    },
  });

  // ── Mutations: active members
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

  const changeRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'manager' | 'staff' }) =>
      apiClient.patch(`/vendor/team/${memberId}/role`, { role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorTeam'] });
      setChangingRoleId(null);
      addToast({ id: Date.now().toString(), message: 'Role updated.', variant: 'success' });
    },
    onError: () => {
      addToast({ id: Date.now().toString(), message: 'Failed to change role.', variant: 'error' });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (memberId: string) => apiClient.patch(`/vendor/team/${memberId}/deactivate`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorTeam'] });
      addToast({ id: Date.now().toString(), message: 'Member deactivated.', variant: 'success' });
    },
    onError: () => {
      addToast({ id: Date.now().toString(), message: 'Failed to deactivate member.', variant: 'error' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => apiClient.delete(`/vendor/team/${memberId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorTeam'] });
      addToast({ id: Date.now().toString(), message: 'Member removed.', variant: 'success' });
    },
    onError: () => {
      addToast({ id: Date.now().toString(), message: 'Failed to remove member.', variant: 'error' });
    },
  });

  // ── Mutations: pending invites
  const resendMutation = useMutation({
    mutationFn: (inviteId: string) => apiClient.post(`/vendor/team/invite/${inviteId}/resend`, {}),
    onSuccess: () => {
      addToast({ id: Date.now().toString(), message: 'Invite re-sent.', variant: 'success' });
    },
    onError: () => {
      addToast({ id: Date.now().toString(), message: 'Failed to resend invite.', variant: 'error' });
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (inviteId: string) => apiClient.delete(`/vendor/team/invite/${inviteId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorTeam'] });
      addToast({ id: Date.now().toString(), message: 'Invite cancelled.', variant: 'success' });
    },
    onError: () => {
      addToast({ id: Date.now().toString(), message: 'Failed to cancel invite.', variant: 'error' });
    },
  });

  // ── Handlers
  function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteError(null);
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  }

  function handleDeactivate(member: VendorStaffMember) {
    if (member.role === 'owner') return;
    if (!confirm(`Deactivate ${member.email}? They will lose portal access.`)) return;
    deactivateMutation.mutate(member.id);
  }

  function handleRemove(member: VendorStaffMember) {
    if (member.role === 'owner') return;
    if (!confirm(`Remove ${member.email} from the team?`)) return;
    removeMutation.mutate(member.id);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grovio-text">Team</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">
            Manage your store team members and pending invitations.
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
        <div className="space-y-8">
          {/* ── Section 1: Active Members ────────────────────────────────── */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-grovio-text-muted">
              Active Members ({data.members.length})
            </h2>
            <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
              {data.members.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-grovio-text-muted">
                  No active team members.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-grovio-border text-left">
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Email</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Role</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Joined</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grovio-border">
                    {data.members.map((member) => (
                      <tr key={member.id} className="hover:bg-grovio-surface/50">
                        <td className="px-4 py-3 text-grovio-text">{member.email}</td>

                        {/* Inline role change */}
                        <td className="px-4 py-3">
                          {member.role === 'owner' ? (
                            <span
                              className={[
                                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                                ROLE_COLORS[member.role] ?? 'bg-gray-100 text-gray-600',
                              ].join(' ')}
                            >
                              Owner
                            </span>
                          ) : changingRoleId === member.id ? (
                            <div className="flex items-center gap-1.5">
                              <select
                                defaultValue={member.role}
                                className="rounded-lg border border-grovio-border bg-grovio-surface px-2 py-1 text-xs text-grovio-text focus:border-grovio-primary focus:outline-none"
                                onBlur={() => setChangingRoleId(null)}
                                onChange={(e) => {
                                  changeRoleMutation.mutate({
                                    memberId: member.id,
                                    role: e.target.value as 'manager' | 'staff',
                                  });
                                }}
                              >
                                <option value="manager">Manager</option>
                                <option value="staff">Staff</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => setChangingRoleId(null)}
                                className="text-xs text-grovio-text-muted"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setChangingRoleId(member.id)}
                              className={[
                                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize transition-opacity hover:opacity-70',
                                ROLE_COLORS[member.role] ?? 'bg-gray-100 text-gray-600',
                              ].join(' ')}
                              title="Click to change role"
                            >
                              {member.role}
                            </button>
                          )}
                        </td>

                        <td className="px-4 py-3 text-grovio-text-muted">
                          {member.acceptedAt
                            ? new Date(member.acceptedAt).toLocaleDateString()
                            : 'Pending'}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={[
                              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                              (member as VendorStaffMember & { isActive?: boolean }).isActive !== false
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500',
                            ].join(' ')}
                          >
                            {(member as VendorStaffMember & { isActive?: boolean }).isActive !== false
                              ? 'Active'
                              : 'Deactivated'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          {member.role !== 'owner' && (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeactivate(member)}
                                disabled={deactivateMutation.isPending}
                                className="rounded-md px-2.5 py-1 text-xs font-medium text-grovio-text-muted transition-colors hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
                                title="Deactivate member"
                              >
                                Deactivate
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemove(member)}
                                disabled={removeMutation.isPending}
                                className="rounded-md px-2.5 py-1 text-xs font-medium text-grovio-error transition-colors hover:bg-grovio-error/10 disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* ── Section 2: Pending Invites ───────────────────────────────── */}
          {data.invites.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-grovio-text-muted">
                Pending Invitations ({data.invites.length})
              </h2>
              <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-grovio-border text-left">
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Email</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Role</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Sent</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Expires</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grovio-border">
                    {data.invites.map((invite) => (
                      <tr key={invite.id} className="hover:bg-grovio-surface/50">
                        <td className="px-4 py-3 text-grovio-text">{invite.email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={[
                              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                              ROLE_COLORS[invite.role] ?? 'bg-gray-100 text-gray-600',
                            ].join(' ')}
                          >
                            {invite.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-grovio-text-muted">
                          {new Date(invite.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-grovio-text-muted">
                          {invite.expiresAt
                            ? new Date(invite.expiresAt).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => resendMutation.mutate(invite.id)}
                              disabled={resendMutation.isPending}
                              className="rounded-md px-2.5 py-1 text-xs font-medium text-grovio-primary transition-colors hover:bg-grovio-primary/10 disabled:opacity-50"
                            >
                              Resend
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!confirm(`Cancel invite to ${invite.email}?`)) return;
                                cancelInviteMutation.mutate(invite.id);
                              }}
                              disabled={cancelInviteMutation.isPending}
                              className="rounded-md px-2.5 py-1 text-xs font-medium text-grovio-error transition-colors hover:bg-grovio-error/10 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Invite slide-over ──────────────────────────────────────────────── */}
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
                  <h2 className="text-base font-semibold text-grovio-text">Invite Team Member</h2>
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
