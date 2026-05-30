/**
 * CategoryMetadataPage — SEO fields + merchandising block editor for a category.
 *
 * Per CAT-07 / D-12 / D-13: Admin edits flat SEO fields and an ordered list of
 * typed merchandising blocks. Save sends the full payload to PUT .../metadata.
 *
 * The server-side MerchandisingBlockSchema is the authority (T-02-20). 400 errors
 * from block validation are surfaced in the UI — the UI never bypasses the server.
 *
 * Routes called:
 *   GET /categories/:id/metadata       → load existing metadata (may be null — lazy-created)
 *   PUT /admin/categories/:id/metadata → upsert metadata (creates on first save)
 */

import type { CategoryMetadata, MerchandisingBlock } from '@grovio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { get, put } from '../../lib/apiClient.js';
import { ApiError } from '../../lib/apiClient.js';
import BlockEditor, { type BlockWithLocalId } from '../../components/categories/BlockEditor.js';

interface CategoryMetadataPageProps {
  categoryId: string;
}

function newLocalId() {
  return `blk_${Math.random().toString(36).slice(2)}`;
}

export default function CategoryMetadataPage({ categoryId }: CategoryMetadataPageProps) {
  const queryClient = useQueryClient();

  // SEO fields
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Blocks
  const [blocks, setBlocks] = useState<BlockWithLocalId[]>([]);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: metadata, isLoading } = useQuery<CategoryMetadata | null>({
    queryKey: ['categories', categoryId, 'metadata'],
    queryFn: () => get<CategoryMetadata | null>(`/categories/${categoryId}/metadata`),
    enabled: Boolean(categoryId),
  });

  // Sync server metadata → form state
  useEffect(() => {
    if (metadata) {
      setSeoTitle(metadata.seoTitle ?? '');
      setSeoDescription(metadata.seoDescription ?? '');
      setSeoKeywords(metadata.seoKeywords ?? '');
      setCanonicalUrl(metadata.canonicalUrl ?? '');
      setDescription(metadata.description ?? '');
      setImageUrl(metadata.imageUrl ?? '');
      setBlocks(
        metadata.blocks.map((block) => ({ localId: newLocalId(), block })),
      );
    }
  }, [metadata]);

  const saveMutation = useMutation({
    mutationFn: (payload: {
      seoTitle?: string;
      seoDescription?: string;
      seoKeywords?: string;
      canonicalUrl?: string;
      description?: string;
      imageUrl?: string;
      blocks?: MerchandisingBlock[];
    }) => put<CategoryMetadata>(`/admin/categories/${categoryId}/metadata`, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['categories', categoryId, 'metadata'], updated);
      void queryClient.invalidateQueries({ queryKey: ['categories', categoryId, 'metadata'] });
      setSaveSuccess(true);
      setSaveError(null);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setSaveError(`${err.code}: ${err.message}`);
      } else {
        setSaveError(err instanceof Error ? err.message : 'Save failed.');
      }
    },
  });

  function handleSave() {
    setSaveSuccess(false);
    setSaveError(null);

    saveMutation.mutate({
      ...(seoTitle.trim() ? { seoTitle: seoTitle.trim() } : {}),
      ...(seoDescription.trim() ? { seoDescription: seoDescription.trim() } : {}),
      ...(seoKeywords.trim() ? { seoKeywords: seoKeywords.trim() } : {}),
      ...(canonicalUrl.trim() ? { canonicalUrl: canonicalUrl.trim() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
      blocks: blocks.map((b) => b.block),
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-grovio-text">Category Metadata</h2>
          <p className="mt-0.5 text-sm text-grovio-text-muted">
            SEO fields and merchandising blocks for this category's landing page.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save Metadata'}
        </button>
      </div>

      {saveError && (
        <div className="mb-4 rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-4 py-3 text-sm text-grovio-error">
          <strong>Save failed:</strong> {saveError}
          {saveError.includes('VALIDATION') && (
            <p className="mt-1 text-xs">
              The server rejected one or more blocks. Check that banner blocks have a valid image URL,
              and product_grid blocks have at least one valid product UUID.
            </p>
          )}
        </div>
      )}

      {saveSuccess && (
        <div className="mb-4 rounded-lg border border-grovio-success/20 bg-grovio-success/10 px-4 py-2 text-sm text-grovio-success">
          Metadata saved successfully.
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {!isLoading && (
        <div className="flex flex-col gap-6">
          {/* SEO Fields */}
          <section className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-6">
            <h3 className="mb-4 text-sm font-semibold text-grovio-text">SEO</h3>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                {/* SEO Title */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-grovio-text-muted">
                    SEO Title
                  </label>
                  <input
                    type="text"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    placeholder="Category page title for search engines"
                    className="w-full rounded border border-grovio-border bg-grovio-surface px-3 py-1.5 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                  />
                </div>

                {/* Canonical URL */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-grovio-text-muted">
                    Canonical URL
                  </label>
                  <input
                    type="text"
                    value={canonicalUrl}
                    onChange={(e) => setCanonicalUrl(e.target.value)}
                    placeholder="https://example.com/categories/electronics"
                    className="w-full rounded border border-grovio-border bg-grovio-surface px-3 py-1.5 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* SEO Description */}
              <div>
                <label className="mb-1 block text-xs font-medium text-grovio-text-muted">
                  SEO Description
                </label>
                <textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  rows={3}
                  placeholder="Meta description shown in search engine results"
                  className="w-full rounded border border-grovio-border bg-grovio-surface px-3 py-1.5 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                />
              </div>

              {/* SEO Keywords */}
              <div>
                <label className="mb-1 block text-xs font-medium text-grovio-text-muted">
                  SEO Keywords <span className="font-normal">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={seoKeywords}
                  onChange={(e) => setSeoKeywords(e.target.value)}
                  placeholder="electronics, gadgets, smartphones"
                  className="w-full rounded border border-grovio-border bg-grovio-surface px-3 py-1.5 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Category description + image */}
          <section className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-6">
            <h3 className="mb-4 text-sm font-semibold text-grovio-text">Category Info</h3>

            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-grovio-text-muted">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe this category for shoppers (plain text or Markdown)"
                  className="w-full rounded border border-grovio-border bg-grovio-surface px-3 py-1.5 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-grovio-text-muted">
                  Image URL <span className="font-normal">(category hero / banner image)</span>
                </label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/images/electronics.jpg"
                  className="w-full rounded border border-grovio-border bg-grovio-surface px-3 py-1.5 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Merchandising Blocks */}
          <section className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-6">
            <h3 className="mb-1 text-sm font-semibold text-grovio-text">Merchandising Blocks</h3>
            <p className="mb-4 text-xs text-grovio-text-muted">
              Blocks are validated by the server — invalid blocks (e.g. product_grid with no product IDs) will
              return a 400 error. No WYSIWYG in v1.
            </p>

            <BlockEditor blocks={blocks} onChange={setBlocks} />
          </section>
        </div>
      )}
    </motion.div>
  );
}
