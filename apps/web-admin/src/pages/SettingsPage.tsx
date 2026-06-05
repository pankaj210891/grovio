/**
 * SettingsPage — admin marketplace settings & branding (ADM-05, D-19).
 *
 * Grouped sections: General / Branding / Email.
 * GET /admin/settings → MarketplaceSettingsResponse.
 * PATCH /admin/settings/:key → UpdateSettingInput.
 *
 * Integration secret keys (smtp credentials) are shown masked/read-only (T-06-35, D-19).
 * Changes are logged to audit_log by the backend.
 */

import type { MarketplaceSettingKey, MarketplaceSettingsResponse } from '@grovio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { get, patch } from '../lib/apiClient.js';

// Keys shown masked (read-only in UI) — T-06-35
const SECRET_KEYS: MarketplaceSettingKey[] = ['smtp_sender_email'];

interface SettingGroup {
  title: string;
  description: string;
  keys: MarketplaceSettingKey[];
}

const SETTING_GROUPS: SettingGroup[] = [
  {
    title: 'General',
    description: 'Core marketplace configuration',
    keys: [
      'store_name',
      'default_currency',
      'timezone',
      'default_return_window_days',
      'low_stock_threshold',
    ],
  },
  {
    title: 'Branding',
    description: 'Visual identity and design tokens',
    keys: ['primary_color', 'logo_url', 'favicon_url'],
  },
  {
    title: 'Email',
    description: 'Transactional email configuration (Google SMTP)',
    keys: ['smtp_sender_name', 'smtp_sender_email'],
  },
];

const SETTING_LABELS: Record<MarketplaceSettingKey, string> = {
  store_name: 'Store Name',
  default_currency: 'Default Currency',
  timezone: 'Timezone',
  default_return_window_days: 'Default Return Window (days)',
  low_stock_threshold: 'Low Stock Threshold',
  primary_color: 'Primary Color (hex)',
  logo_url: 'Logo URL',
  favicon_url: 'Favicon URL',
  smtp_sender_name: 'Sender Name',
  smtp_sender_email: 'Sender Email (read-only)',
};

interface SettingRowProps {
  settingKey: MarketplaceSettingKey;
  value: unknown;
  onSave: (key: MarketplaceSettingKey, value: unknown) => void;
  isPending: boolean;
}

function SettingRow({ settingKey, value, onSave, isPending }: SettingRowProps) {
  const isSecret = SECRET_KEYS.includes(settingKey);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));

  // Keep draft in sync when value changes externally
  useEffect(() => {
    if (!editing) setDraft(String(value ?? ''));
  }, [value, editing]);

  if (isSecret) {
    return (
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-grovio-text">{SETTING_LABELS[settingKey]}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value="••••••••••••"
            readOnly
            aria-label={`${SETTING_LABELS[settingKey]} (masked — read-only)`}
            className="w-48 rounded-lg border border-grovio-border bg-grovio-surface px-3 py-1.5 font-mono text-sm text-grovio-text-muted cursor-not-allowed"
          />
          <span className="text-xs text-grovio-text-muted">(read-only)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-grovio-text">{SETTING_LABELS[settingKey]}</p>
        <p className="font-mono text-xs text-grovio-text-muted">{settingKey}</p>
      </div>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // For numeric keys, coerce to number
            const numericKeys: MarketplaceSettingKey[] = [
              'default_return_window_days',
              'low_stock_threshold',
            ];
            const newValue = numericKeys.includes(settingKey) ? Number(draft) : draft;
            onSave(settingKey, newValue);
            setEditing(false);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            className="w-48 rounded-lg border border-grovio-primary bg-grovio-surface px-3 py-1.5 text-sm text-grovio-text focus:outline-none"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-grovio-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setDraft(String(value ?? ''));
            }}
            className="rounded-lg border border-grovio-border px-3 py-1.5 text-xs font-medium text-grovio-text hover:bg-grovio-surface"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-grovio-text">
            {value != null ? String(value) : <span className="text-grovio-text-muted italic">not set</span>}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded border border-grovio-border px-2.5 py-1 text-xs font-medium text-grovio-text hover:bg-grovio-surface"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<MarketplaceSettingsResponse>({
    queryKey: ['admin', 'settings'],
    queryFn: () => get<MarketplaceSettingsResponse>('/admin/settings'),
  });

  const saveMutation = useMutation({
    mutationFn: ({ key, value }: { key: MarketplaceSettingKey; value: unknown }) =>
      patch<void>(`/admin/settings/${key}`, { key, value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: (err: unknown) =>
      setSaveError(err instanceof Error ? err.message : 'Failed to save setting'),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-grovio-text">Settings & Branding</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">
          Configure marketplace name, branding, email, and integration settings. Changes are logged to the audit log.
        </p>
      </div>

      {saveError && (
        <div className="mb-4 rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-4 py-3 text-sm text-grovio-error">
          {saveError}
          <button type="button" onClick={() => setSaveError(null)} className="ml-2 text-xs underline">
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
          Failed to load settings: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {SETTING_GROUPS.map((group) => (
            <div key={group.title} className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
              <div className="border-b border-grovio-border px-6 py-4">
                <h2 className="text-sm font-semibold text-grovio-text">{group.title}</h2>
                <p className="mt-0.5 text-xs text-grovio-text-muted">{group.description}</p>
              </div>
              <div className="divide-y divide-grovio-border px-6">
                {group.keys.map((key) => (
                  <SettingRow
                    key={key}
                    settingKey={key}
                    value={data[key]}
                    onSave={(k, v) => saveMutation.mutate({ key: k, value: v })}
                    isPending={saveMutation.isPending}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
