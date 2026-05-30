/**
 * CategoryListPage — displays the category tree with drag-and-drop reorder,
 * and provides a "New Category" action via an animated slide-over panel.
 *
 * Routes: /categories
 * Data: GET /categories → { tree: CategoryTreeNode[] }
 */

import type { CategoryTreeNode } from '@grovio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useState } from 'react';
import { get, post } from '../../lib/apiClient.js';
import CategoryTree from '../../components/categories/CategoryTree.js';

interface CategoryTreeResponse {
  tree: CategoryTreeNode[];
}

interface CreateCategoryInput {
  name: string;
  slug?: string;
  parentId?: string;
}

export default function CategoryListPage() {
  const queryClient = useQueryClient();
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | undefined>(undefined);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form state
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery<CategoryTreeResponse>({
    queryKey: ['categories', 'tree'],
    queryFn: () => get<CategoryTreeResponse>('/categories'),
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateCategoryInput) =>
      post<CategoryTreeNode>('/admin/categories', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      setShowCreatePanel(false);
      setNewName('');
      setNewSlug('');
      setCreateParentId(undefined);
      setCreateError(null);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'Failed to create category.';
      setCreateError(msg);
    },
  });

  function openCreatePanel(parentId?: string) {
    setCreateParentId(parentId);
    setNewName('');
    setNewSlug('');
    setCreateError(null);
    setShowCreatePanel(true);
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const body: CreateCategoryInput = { name: newName.trim() };
    if (newSlug.trim()) body.slug = newSlug.trim();
    if (createParentId) body.parentId = createParentId;
    createMutation.mutate(body);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grovio-text">Categories</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">
            Manage your category tree — create, reorder, and edit categories.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreatePanel()}
          className="rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          New Category
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {/* Error state */}
      {queryError && (
        <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
          Failed to load categories:{' '}
          {queryError instanceof Error ? queryError.message : 'Unknown error'}
        </div>
      )}

      {/* Category tree */}
      {data?.tree && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          {data.tree.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-grovio-text-muted">
              No categories yet.{' '}
              <button
                type="button"
                onClick={() => openCreatePanel()}
                className="text-grovio-primary underline underline-offset-2"
              >
                Create your first category.
              </button>
            </div>
          ) : (
            <CategoryTree tree={data.tree} onCreateSubcategory={openCreatePanel} />
          )}
        </div>
      )}

      {/* Create slide-over panel */}
      <AnimatePresence>
        {showCreatePanel && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreatePanel(false)}
            />

            {/* Panel */}
            <motion.div
              key="panel"
              className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-grovio-border bg-grovio-surface-raised shadow-xl"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            >
              <div className="flex h-full flex-col">
                {/* Panel header */}
                <div className="flex items-center justify-between border-b border-grovio-border px-6 py-4">
                  <h2 className="text-base font-semibold text-grovio-text">
                    {createParentId ? 'New Subcategory' : 'New Category'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowCreatePanel(false)}
                    className="text-grovio-text-muted transition-colors hover:text-grovio-text"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                {/* Panel form */}
                <form
                  onSubmit={handleCreateSubmit}
                  className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-6"
                >
                  <div>
                    <label
                      htmlFor="create-name"
                      className="mb-1 block text-sm font-medium text-grovio-text"
                    >
                      Name <span className="text-grovio-error">*</span>
                    </label>
                    <input
                      id="create-name"
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Electronics"
                      required
                      className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:border-grovio-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="create-slug"
                      className="mb-1 block text-sm font-medium text-grovio-text"
                    >
                      Slug{' '}
                      <span className="text-xs font-normal text-grovio-text-muted">
                        (optional — auto-derived from name)
                      </span>
                    </label>
                    <input
                      id="create-slug"
                      type="text"
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value)}
                      placeholder="e.g. electronics"
                      className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:border-grovio-primary focus:outline-none"
                    />
                  </div>

                  {/* Depth error (422) and other errors */}
                  {createError && (
                    <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-3 py-2 text-sm text-grovio-error">
                      {createError}
                    </div>
                  )}

                  <div className="mt-auto flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCreatePanel(false)}
                      className="flex-1 rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text transition-colors hover:bg-grovio-surface"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending || !newName.trim()}
                      className="flex-1 rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {createMutation.isPending ? 'Creating…' : 'Create'}
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
