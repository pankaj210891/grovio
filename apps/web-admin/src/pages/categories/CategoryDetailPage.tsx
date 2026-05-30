/**
 * CategoryDetailPage — edit form for a single category plus a tab container
 * with attribute/filter/template/metadata/restriction editors (plan 02-08).
 *
 * Routes: /categories/:id
 * Data:
 *   GET /categories/:id        → CategoryDetail (single category)
 *   PATCH /admin/categories/:id → update name/slug/sortOrder/isRestricted
 *   POST /admin/categories/:id/archive → soft-delete
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, patch, post } from '../../lib/apiClient.js';
import AttributeBuilderPage from './AttributeBuilderPage.js';
import FilterSchemaPage from './FilterSchemaPage.js';
import ProductTemplatePage from './ProductTemplatePage.js';
import VendorRestrictionsPage from './VendorRestrictionsPage.js';
import CategoryMetadataPage from './CategoryMetadataPage.js';

interface CategoryDetail {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  depth: number;
  isRestricted: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type Tab = 'details' | 'attributes' | 'filters' | 'template' | 'metadata' | 'restrictions';

const TABS: { id: Tab; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'attributes', label: 'Attributes' },
  { id: 'filters', label: 'Filters' },
  { id: 'template', label: 'Template' },
  { id: 'metadata', label: 'Metadata' },
  { id: 'restrictions', label: 'Restrictions' },
];

export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('details');

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [isRestricted, setIsRestricted] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const {
    data: category,
    isLoading,
    error: queryError,
  } = useQuery<CategoryDetail>({
    queryKey: ['categories', id],
    queryFn: () => get<CategoryDetail>(`/categories/${id ?? ''}`),
    enabled: Boolean(id),
  });

  // Sync form state only on first load — not on every subsequent refetch/mutation.
  // Without this guard, updateMutation.onSuccess calls setQueryData which changes
  // the category reference, re-triggering this effect and silently overwriting any
  // unsaved edits the admin may have made while the mutation was in flight (WR-04).
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (category && !hasInitialized.current) {
      hasInitialized.current = true;
      setName(category.name);
      setSlug(category.slug);
      setSortOrder(category.sortOrder);
      setIsRestricted(category.isRestricted);
    }
  }, [category]);

  const updateMutation = useMutation({
    mutationFn: (body: Partial<Pick<CategoryDetail, 'name' | 'slug' | 'sortOrder' | 'isRestricted'>>) =>
      patch<CategoryDetail>(`/admin/categories/${id ?? ''}`, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(['categories', id], updated);
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditError(null);
    },
    onError: (err: unknown) => {
      setEditError(err instanceof Error ? err.message : 'Failed to update category.');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => post<CategoryDetail>(`/admin/categories/${id ?? ''}/archive`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      navigate('/categories');
    },
    onError: (err: unknown) => {
      setArchiveError(err instanceof Error ? err.message : 'Failed to archive category.');
    },
  });

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate({ name, slug, sortOrder, isRestricted });
  }

  function handleArchive() {
    if (!window.confirm(`Archive "${category?.name ?? 'this category'}"? It will be hidden from the tree.`)) {
      return;
    }
    archiveMutation.mutate();
  }

  if (!id) {
    return (
      <div className="py-16 text-center text-sm text-grovio-text-muted">
        No category ID provided.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate('/categories')}
        className="mb-4 flex items-center gap-1 text-sm text-grovio-text-muted transition-colors hover:text-grovio-text"
      >
        ← Categories
      </button>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {/* Error state */}
      {queryError && (
        <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
          {queryError instanceof Error ? queryError.message : 'Failed to load category.'}
        </div>
      )}

      {category && (
        <>
          {/* Page header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-grovio-text">{category.name}</h1>
              <p className="mt-1 text-sm text-grovio-text-muted">
                Slug: <code className="font-mono text-xs">{category.slug}</code>
                {' · '}
                Depth: {category.depth}
                {category.archivedAt && (
                  <span className="ml-2 rounded-full bg-grovio-error/10 px-2 py-0.5 text-xs font-medium text-grovio-error">
                    Archived
                  </span>
                )}
              </p>
            </div>

            {/* Archive button */}
            {!category.archivedAt && (
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiveMutation.isPending}
                className="rounded-lg border border-grovio-error/30 px-3 py-1.5 text-sm font-medium text-grovio-error transition-colors hover:bg-grovio-error/10 disabled:opacity-60"
              >
                {archiveMutation.isPending ? 'Archiving…' : 'Archive'}
              </button>
            )}
          </div>

          {archiveError && (
            <div className="mb-4 rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-4 py-2 text-sm text-grovio-error">
              {archiveError}
            </div>
          )}

          {/* Tab navigation */}
          <div className="mb-6 flex gap-1 border-b border-grovio-border">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-b-2 border-grovio-primary text-grovio-primary'
                    : 'text-grovio-text-muted hover:text-grovio-text',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'details' && (
            <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-6">
              <form onSubmit={handleEditSubmit} className="flex flex-col gap-4 max-w-lg">
                <div>
                  <label
                    htmlFor="edit-name"
                    className="mb-1 block text-sm font-medium text-grovio-text"
                  >
                    Name <span className="text-grovio-error">*</span>
                  </label>
                  <input
                    id="edit-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-slug"
                    className="mb-1 block text-sm font-medium text-grovio-text"
                  >
                    Slug
                  </label>
                  <input
                    id="edit-slug"
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-sort"
                    className="mb-1 block text-sm font-medium text-grovio-text"
                  >
                    Sort Order
                  </label>
                  <input
                    id="edit-sort"
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="edit-restricted"
                    type="checkbox"
                    checked={isRestricted}
                    onChange={(e) => setIsRestricted(e.target.checked)}
                    className="h-4 w-4 rounded border-grovio-border text-grovio-primary focus:ring-grovio-primary"
                  />
                  <label
                    htmlFor="edit-restricted"
                    className="text-sm font-medium text-grovio-text"
                  >
                    Restricted (approve vendors individually)
                  </label>
                </div>

                {editError && (
                  <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-3 py-2 text-sm text-grovio-error">
                    {editError}
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Editor tabs — wired in plan 02-08 */}
          {activeTab === 'attributes' && (
            <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-6">
              <AttributeBuilderPage categoryId={category.id} />
            </div>
          )}

          {activeTab === 'filters' && (
            <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-6">
              <FilterSchemaPage categoryId={category.id} />
            </div>
          )}

          {activeTab === 'template' && (
            <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-6">
              <ProductTemplatePage categoryId={category.id} />
            </div>
          )}

          {activeTab === 'metadata' && (
            <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-6">
              <CategoryMetadataPage categoryId={category.id} />
            </div>
          )}

          {activeTab === 'restrictions' && (
            <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-6">
              <VendorRestrictionsPage
                categoryId={category.id}
                isRestricted={category.isRestricted}
              />
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
