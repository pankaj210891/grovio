/**
 * CmsPage — admin CMS / homepage block management (ADM-04, D-11).
 *
 * Ordered list of homepage blocks. Per block: type badge, active toggle, Edit/Delete, Up/Down arrows.
 * Type-specific edit modal (banner / product_grid / text_block / featured_categories).
 * URL-only image inputs. No drag-and-drop (D-11 spec: Up/Down arrows only).
 * HomepageService Redis cache is invalidated by backend on each mutation.
 *
 * Uses framer-motion (web-admin convention per PATTERNS.md).
 */

import type {
  CreateHomepageBlockInput,
  MerchandisingBlock,
  UpdateHomepageBlockInput,
} from '@grovio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useState } from 'react';
import { del, get, patch, post } from '../lib/apiClient.js';

interface HomepageBlock {
  id: string;
  block: MerchandisingBlock;
  active: boolean;
  position: number;
}

interface HomepageBlocksResponse {
  blocks: HomepageBlock[];
}

const BLOCK_TYPE_LABELS: Record<MerchandisingBlock['type'], string> = {
  banner: 'Banner',
  product_grid: 'Product Grid',
  text_block: 'Text Block',
  featured_categories: 'Featured Categories',
};

const BLOCK_TYPE_COLORS: Record<MerchandisingBlock['type'], string> = {
  banner: 'bg-blue-100 text-blue-800',
  product_grid: 'bg-purple-100 text-purple-800',
  text_block: 'bg-gray-100 text-gray-800',
  featured_categories: 'bg-green-100 text-green-800',
};

function defaultBlock(type: MerchandisingBlock['type']): MerchandisingBlock {
  switch (type) {
    case 'banner':
      return { type: 'banner', imageUrl: 'https://', title: '' };
    case 'product_grid':
      return { type: 'product_grid', title: '', productIds: [], layout: 'grid' };
    case 'text_block':
      return { type: 'text_block', title: '', content: '' };
    case 'featured_categories':
      return { type: 'featured_categories', title: '', categoryIds: [], layout: 'grid' };
  }
}

interface BlockFormProps {
  block: MerchandisingBlock;
  onChange: (b: MerchandisingBlock) => void;
}

function BlockForm({ block, onChange }: BlockFormProps) {
  function field(label: string, value: string, setter: (v: string) => void, placeholder?: string) {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-grovio-text">{label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => setter(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
        />
      </div>
    );
  }

  if (block.type === 'banner') {
    return (
      <div className="space-y-3">
        {field('Image URL *', block.imageUrl, (v) => onChange({ ...block, imageUrl: v }), 'https://example.com/banner.jpg')}
        {field('Title *', block.title, (v) => onChange({ ...block, title: v }), 'Summer Sale')}
        {field('Subtitle', block.subtitle ?? '', (v) => onChange({ ...block, subtitle: v || undefined }), 'Up to 50% off')}
        {field('CTA Text', block.ctaText ?? '', (v) => onChange({ ...block, ctaText: v || undefined }), 'Shop Now')}
        {field('CTA URL', block.ctaUrl ?? '', (v) => onChange({ ...block, ctaUrl: v || undefined }), 'https://example.com')}
      </div>
    );
  }

  if (block.type === 'product_grid') {
    return (
      <div className="space-y-3">
        {field('Title *', block.title, (v) => onChange({ ...block, title: v }), 'Featured Products')}
        <div>
          <label className="mb-1 block text-sm font-medium text-grovio-text">
            Product IDs <span className="text-xs font-normal text-grovio-text-muted">(UUIDs, one per line)</span>
          </label>
          <textarea
            value={block.productIds.join('\n')}
            onChange={(e) =>
              onChange({
                ...block,
                productIds: e.target.value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
              })
            }
            rows={4}
            className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 font-mono text-xs text-grovio-text focus:border-grovio-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-grovio-text">Layout</label>
          <div className="flex gap-4">
            {(['grid', 'carousel'] as const).map((l) => (
              <label key={l} className="flex items-center gap-2 text-sm text-grovio-text">
                <input
                  type="radio"
                  checked={block.layout === l}
                  onChange={() => onChange({ ...block, layout: l })}
                />
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (block.type === 'text_block') {
    return (
      <div className="space-y-3">
        {field('Title *', block.title, (v) => onChange({ ...block, title: v }), 'About This Section')}
        <div>
          <label className="mb-1 block text-sm font-medium text-grovio-text">Content *</label>
          <textarea
            value={block.content}
            onChange={(e) => onChange({ ...block, content: e.target.value })}
            rows={6}
            placeholder="Block body text…"
            className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
          />
        </div>
      </div>
    );
  }

  // featured_categories
  return (
    <div className="space-y-3">
      {field('Title *', block.title, (v) => onChange({ ...block, title: v }), 'Browse Categories')}
      <div>
        <label className="mb-1 block text-sm font-medium text-grovio-text">
          Category IDs <span className="text-xs font-normal text-grovio-text-muted">(UUIDs, one per line)</span>
        </label>
        <textarea
          value={block.categoryIds.join('\n')}
          onChange={(e) =>
            onChange({
              ...block,
              categoryIds: e.target.value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
            })
          }
          rows={4}
          className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 font-mono text-xs text-grovio-text focus:border-grovio-primary focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-grovio-text">Layout</label>
        <div className="flex gap-4">
          {(['grid', 'row'] as const).map((l) => (
            <label key={l} className="flex items-center gap-2 text-sm text-grovio-text">
              <input
                type="radio"
                checked={block.layout === l}
                onChange={() => onChange({ ...block, layout: l })}
              />
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CmsPage() {
  const queryClient = useQueryClient();
  const [editBlock, setEditBlock] = useState<HomepageBlock | null>(null);
  const [createType, setCreateType] = useState<MerchandisingBlock['type'] | null>(null);
  const [formBlock, setFormBlock] = useState<MerchandisingBlock>(defaultBlock('banner'));
  const [formActive, setFormActive] = useState(true);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<HomepageBlocksResponse>({
    queryKey: ['admin', 'homepage-blocks'],
    queryFn: () => get<HomepageBlocksResponse>('/admin/homepage-blocks'),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'homepage-blocks'] });
  }

  const createMutation = useMutation({
    mutationFn: (body: CreateHomepageBlockInput) =>
      post<HomepageBlock>('/admin/homepage-blocks', body),
    onSuccess: () => {
      invalidate();
      setCreateType(null);
    },
    onError: (err: unknown) =>
      setMutationError(err instanceof Error ? err.message : 'Failed to create block'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateHomepageBlockInput }) =>
      patch<void>(`/admin/homepage-blocks/${id}`, body),
    onSuccess: () => {
      invalidate();
      setEditBlock(null);
    },
    onError: (err: unknown) =>
      setMutationError(err instanceof Error ? err.message : 'Failed to update block'),
  });

  const toggleMutation = useMutation({
    // WR-07: backend only exposes PATCH /admin/homepage-blocks/:id (no /toggle sub-path)
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      patch<void>(`/admin/homepage-blocks/${id}`, { active }),
    onSuccess: invalidate,
    onError: (err: unknown) =>
      setMutationError(err instanceof Error ? err.message : 'Failed to toggle block'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del<void>(`/admin/homepage-blocks/${id}`),
    onSuccess: invalidate,
    onError: (err: unknown) =>
      setMutationError(err instanceof Error ? err.message : 'Failed to delete block'),
  });

  const reorderMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
      post<void>(`/admin/homepage-blocks/${id}/reorder`, { blockId: id, direction }),
    onSuccess: invalidate,
    onError: (err: unknown) =>
      setMutationError(err instanceof Error ? err.message : 'Failed to reorder block'),
  });

  function openCreate(type: MerchandisingBlock['type']) {
    setCreateType(type);
    setFormBlock(defaultBlock(type));
    setFormActive(true);
    setMutationError(null);
  }

  function openEdit(block: HomepageBlock) {
    setEditBlock(block);
    setFormBlock(block.block);
    setFormActive(block.active);
    setMutationError(null);
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({ block: formBlock, active: formActive });
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editBlock) return;
    updateMutation.mutate({ id: editBlock.id, body: { block: formBlock, active: formActive } });
  }

  const blocks = data?.blocks ?? [];
  const showPanel = editBlock !== null || createType !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-grovio-text">CMS / Homepage</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">
            Manage homepage block order, content, and visibility.
          </p>
        </div>

        {/* Add block dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-grovio-text-muted">Add:</span>
          {(['banner', 'product_grid', 'text_block', 'featured_categories'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => openCreate(type)}
              className="rounded-lg border border-grovio-border bg-grovio-surface-raised px-3 py-1.5 text-xs font-medium text-grovio-text hover:bg-grovio-surface"
            >
              {BLOCK_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
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
          Failed to load blocks: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {/* Block list */}
      {blocks.length === 0 && !isLoading && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised px-6 py-16 text-center text-sm text-grovio-text-muted">
          No homepage blocks yet. Add one above.
        </div>
      )}

      <div className="space-y-3">
        {blocks.map((block, i) => (
          <div
            key={block.id}
            className="flex items-center gap-4 rounded-xl border border-grovio-border bg-grovio-surface-raised px-5 py-4"
          >
            {/* Up/Down reorder — no drag-and-drop (D-11) */}
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => reorderMutation.mutate({ id: block.id, direction: 'up' })}
                disabled={i === 0 || reorderMutation.isPending}
                className="rounded p-0.5 text-xs text-grovio-text-muted hover:bg-grovio-surface hover:text-grovio-text disabled:opacity-30"
                aria-label="Move up"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => reorderMutation.mutate({ id: block.id, direction: 'down' })}
                disabled={i === blocks.length - 1 || reorderMutation.isPending}
                className="rounded p-0.5 text-xs text-grovio-text-muted hover:bg-grovio-surface hover:text-grovio-text disabled:opacity-30"
                aria-label="Move down"
              >
                ▼
              </button>
            </div>

            {/* Type badge */}
            <span
              className={[
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                BLOCK_TYPE_COLORS[block.block.type] ?? 'bg-gray-100 text-gray-800',
              ].join(' ')}
            >
              {BLOCK_TYPE_LABELS[block.block.type]}
            </span>

            {/* Block preview title */}
            <span className="flex-1 text-sm text-grovio-text truncate">
              {'title' in block.block ? block.block.title || '(untitled)' : '—'}
            </span>

            {/* Active toggle */}
            <button
              type="button"
              onClick={() => toggleMutation.mutate({ id: block.id, active: !block.active })}
              disabled={toggleMutation.isPending}
              className={[
                'relative h-5 w-9 rounded-full transition-colors focus:outline-none',
                block.active ? 'bg-grovio-primary' : 'bg-gray-300',
              ].join(' ')}
              aria-label={block.active ? 'Deactivate block' : 'Activate block'}
            >
              <span
                className={[
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  block.active ? 'translate-x-4' : 'translate-x-0.5',
                ].join(' ')}
              />
            </button>

            {/* Edit / Delete */}
            <button
              type="button"
              onClick={() => openEdit(block)}
              className="rounded border border-grovio-border px-2.5 py-1 text-xs font-medium text-grovio-text hover:bg-grovio-surface"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => deleteMutation.mutate(block.id)}
              disabled={deleteMutation.isPending}
              className="rounded border border-grovio-error/30 px-2.5 py-1 text-xs font-medium text-grovio-error hover:bg-grovio-error/10 disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {/* Edit / Create slide-over */}
      <AnimatePresence>
        {showPanel && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setEditBlock(null);
                setCreateType(null);
              }}
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
                    {editBlock ? 'Edit Block' : `New ${createType ? BLOCK_TYPE_LABELS[createType] : ''} Block`}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setEditBlock(null);
                      setCreateType(null);
                    }}
                    className="text-grovio-text-muted hover:text-grovio-text"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <form
                  onSubmit={editBlock ? handleEditSubmit : handleCreateSubmit}
                  className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6"
                >
                  <BlockForm block={formBlock} onChange={setFormBlock} />

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="block-active"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      className="h-4 w-4 rounded border-grovio-border text-grovio-primary"
                    />
                    <label htmlFor="block-active" className="text-sm text-grovio-text">
                      Active (visible on storefront)
                    </label>
                  </div>

                  {mutationError && (
                    <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-3 py-2 text-sm text-grovio-error">
                      {mutationError}
                    </div>
                  )}

                  <div className="mt-auto flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditBlock(null);
                        setCreateType(null);
                      }}
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
