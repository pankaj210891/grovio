/**
 * CommissionRulesPage — admin commission rule management (ADM-03, D-18).
 *
 * Three-section UI per D-18:
 * 1. Global rate — pinned top row, NO delete button, inline edit only (T-06-33).
 * 2. Category overrides — add/edit/delete via slide-over.
 * 3. Vendor overrides — add/edit/delete via slide-over.
 *
 * DELETE on global is not offered in UI; a 403 from the server is surfaced gracefully.
 * All mutations are logged to audit_log by the backend service.
 */

import type {
  CommissionRule,
  CommissionRulesResponse,
  CreateCommissionRuleInput,
  UpdateCommissionRuleInput,
} from '@grovio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useState } from 'react';
import { del, get, patch, post } from '../lib/apiClient.js';

type EditTarget = { rule: CommissionRule; mode: 'edit' };
type CreateTarget = { mode: 'create'; scope: 'category' | 'vendor' };
type PanelState = EditTarget | CreateTarget | null;

interface RuleFormState {
  ratePercent: string;
  categoryId: string;
  vendorId: string;
}

export function CommissionRulesPage() {
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<PanelState>(null);
  const [form, setForm] = useState<RuleFormState>({ ratePercent: '', categoryId: '', vendorId: '' });
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Inline edit for global rate
  const [editingGlobal, setEditingGlobal] = useState(false);
  const [globalRate, setGlobalRate] = useState('');

  const { data, isLoading, error } = useQuery<CommissionRulesResponse>({
    queryKey: ['admin', 'commission-rules'],
    queryFn: () => get<CommissionRulesResponse>('/admin/commission-rules'),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'commission-rules'] });
  }

  // Global rate update
  const updateGlobalMutation = useMutation({
    mutationFn: (body: UpdateCommissionRuleInput) =>
      patch<void>(`/admin/commission-rules/${data!.global.id}`, body),
    onSuccess: () => {
      invalidate();
      setEditingGlobal(false);
    },
    onError: (err: unknown) =>
      setMutationError(err instanceof Error ? err.message : 'Failed to update global rate'),
  });

  // Create override
  const createMutation = useMutation({
    mutationFn: (body: CreateCommissionRuleInput) =>
      post<CommissionRule>('/admin/commission-rules', body),
    onSuccess: () => {
      invalidate();
      setPanel(null);
    },
    onError: (err: unknown) =>
      setMutationError(err instanceof Error ? err.message : 'Failed to create rule'),
  });

  // Update override
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCommissionRuleInput }) =>
      patch<void>(`/admin/commission-rules/${id}`, body),
    onSuccess: () => {
      invalidate();
      setPanel(null);
    },
    onError: (err: unknown) =>
      setMutationError(err instanceof Error ? err.message : 'Failed to update rule'),
  });

  // Delete override
  const deleteMutation = useMutation({
    mutationFn: (id: string) => del<void>(`/admin/commission-rules/${id}`),
    onSuccess: invalidate,
    onError: (err: unknown) =>
      setMutationError(err instanceof Error ? err.message : 'Failed to delete rule'),
  });

  function openCreate(scope: 'category' | 'vendor') {
    setPanel({ mode: 'create', scope });
    setForm({ ratePercent: '', categoryId: '', vendorId: '' });
    setMutationError(null);
  }

  function openEdit(rule: CommissionRule) {
    setPanel({ mode: 'edit', rule });
    setForm({ ratePercent: String(rule.ratePercent), categoryId: rule.categoryId ?? '', vendorId: rule.vendorId ?? '' });
    setMutationError(null);
  }

  function handleGlobalEdit() {
    setGlobalRate(String(data!.global.ratePercent));
    setEditingGlobal(true);
    setMutationError(null);
  }

  function handleGlobalSave(e: React.FormEvent) {
    e.preventDefault();
    const rate = parseFloat(globalRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setMutationError('Rate must be between 0 and 100');
      return;
    }
    updateGlobalMutation.mutate({ ratePercent: rate });
  }

  function handlePanelSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rate = parseFloat(form.ratePercent);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setMutationError('Rate must be between 0 and 100');
      return;
    }
    if (panel?.mode === 'edit') {
      updateMutation.mutate({ id: panel.rule.id, body: { ratePercent: rate } });
    } else if (panel?.mode === 'create') {
      createMutation.mutate({
        scope: panel.scope,
        categoryId: panel.scope === 'category' ? form.categoryId || null : null,
        vendorId: panel.scope === 'vendor' ? form.vendorId || null : null,
        ratePercent: rate,
      });
    }
  }

  function OverrideTable({
    title,
    rules,
    scope,
    idField,
    idLabel,
  }: {
    title: string;
    rules: CommissionRule[];
    scope: 'category' | 'vendor';
    idField: 'categoryId' | 'vendorId';
    idLabel: string;
  }) {
    return (
      <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
        <div className="flex items-center justify-between border-b border-grovio-border px-6 py-4">
          <h2 className="text-sm font-semibold text-grovio-text">{title}</h2>
          <button
            type="button"
            onClick={() => openCreate(scope)}
            className="rounded-lg bg-grovio-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            + Add Override
          </button>
        </div>
        {rules.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-grovio-text-muted">No overrides yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grovio-border text-left">
                  {[idLabel + ' ID', 'Rate %', 'Actions'].map((h) => (
                    <th key={h} className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-grovio-text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-grovio-border">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-grovio-surface/40">
                    <td className="px-5 py-3 font-mono text-xs text-grovio-text-muted">
                      {rule[idField] ?? '—'}
                    </td>
                    <td className="px-5 py-3 font-medium text-grovio-text">{rule.ratePercent}%</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(rule)}
                          className="rounded border border-grovio-border px-2.5 py-1 text-xs font-medium text-grovio-text hover:bg-grovio-surface"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(rule.id)}
                          disabled={deleteMutation.isPending}
                          className="rounded border border-grovio-error/30 px-2.5 py-1 text-xs font-medium text-grovio-error hover:bg-grovio-error/10 disabled:opacity-60"
                        >
                          Delete
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
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-grovio-text">Commission Rules</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">
          Configure the global default, category overrides, and vendor overrides. Priority: vendor &gt; category &gt; global.
        </p>
      </div>

      {mutationError && (
        <div className="mb-4 rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-4 py-3 text-sm text-grovio-error">
          {mutationError}
          <button type="button" onClick={() => setMutationError(null)} className="ml-2 text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
          Failed to load commission rules: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Section 1: Global rate (pinned, no delete) */}
          <div className="rounded-xl border border-grovio-primary/20 bg-grovio-surface-raised">
            <div className="border-b border-grovio-border px-6 py-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-grovio-text">Global Default Rate</h2>
                <span className="rounded-full bg-grovio-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-grovio-primary">
                  Pinned
                </span>
              </div>
              <p className="mt-0.5 text-xs text-grovio-text-muted">
                The fallback rate applied when no category or vendor override matches. Cannot be deleted.
              </p>
            </div>
            <div className="px-6 py-4">
              {editingGlobal ? (
                <form onSubmit={handleGlobalSave} className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={globalRate}
                    onChange={(e) => setGlobalRate(e.target.value)}
                    className="w-28 rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                    autoFocus
                  />
                  <span className="text-sm text-grovio-text-muted">%</span>
                  <button
                    type="submit"
                    disabled={updateGlobalMutation.isPending}
                    className="rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {updateGlobalMutation.isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingGlobal(false)}
                    className="rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text hover:bg-grovio-surface"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-bold text-grovio-primary">
                    {data.global.ratePercent}%
                  </span>
                  {/* NOTE: No delete button for global rule (T-06-33) */}
                  <button
                    type="button"
                    onClick={handleGlobalEdit}
                    className="rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text hover:bg-grovio-surface"
                  >
                    Edit Rate
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Category overrides */}
          <OverrideTable
            title="Category Overrides"
            rules={data.categoryOverrides}
            scope="category"
            idField="categoryId"
            idLabel="Category"
          />

          {/* Section 3: Vendor overrides */}
          <OverrideTable
            title="Vendor Overrides"
            rules={data.vendorOverrides}
            scope="vendor"
            idField="vendorId"
            idLabel="Vendor"
          />
        </div>
      )}

      {/* Slide-over panel for create/edit overrides */}
      <AnimatePresence>
        {panel && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPanel(null)}
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
                    {panel.mode === 'edit'
                      ? `Edit ${panel.rule.scope === 'category' ? 'Category' : 'Vendor'} Override`
                      : `Add ${panel.mode === 'create' && panel.scope === 'category' ? 'Category' : 'Vendor'} Override`}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setPanel(null)}
                    className="text-grovio-text-muted hover:text-grovio-text"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <form
                  onSubmit={handlePanelSubmit}
                  className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6"
                >
                  {/* Show category or vendor ID field only on create */}
                  {panel.mode === 'create' && panel.scope === 'category' && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-grovio-text">
                        Category ID (UUID)
                      </label>
                      <input
                        type="text"
                        value={form.categoryId}
                        onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                        placeholder="550e8400-e29b-41d4-a716-446655440000"
                        className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 font-mono text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                      />
                    </div>
                  )}
                  {panel.mode === 'create' && panel.scope === 'vendor' && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-grovio-text">
                        Vendor ID (UUID)
                      </label>
                      <input
                        type="text"
                        value={form.vendorId}
                        onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))}
                        placeholder="550e8400-e29b-41d4-a716-446655440000"
                        className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 font-mono text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                      />
                    </div>
                  )}
                  {/* Show read-only ID info on edit */}
                  {panel.mode === 'edit' && (
                    <div className="rounded-lg bg-grovio-surface px-3 py-2 text-xs text-grovio-text-muted font-mono">
                      {panel.rule.scope === 'category'
                        ? `Category: ${panel.rule.categoryId}`
                        : `Vendor: ${panel.rule.vendorId}`}
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-grovio-text">
                      Commission Rate (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={form.ratePercent}
                      onChange={(e) => setForm((f) => ({ ...f, ratePercent: e.target.value }))}
                      placeholder="e.g. 12.5"
                      required
                      className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                    />
                  </div>

                  {mutationError && (
                    <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-3 py-2 text-sm text-grovio-error">
                      {mutationError}
                    </div>
                  )}

                  <div className="mt-auto flex gap-3">
                    <button
                      type="button"
                      onClick={() => setPanel(null)}
                      className="flex-1 rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text hover:bg-grovio-surface"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="flex-1 rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save'}
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
