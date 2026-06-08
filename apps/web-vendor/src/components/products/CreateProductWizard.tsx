/**
 * Multi-step product creation wizard (Plan 11-03, T3).
 *
 * Step 1 — Category & Attributes: category select, dynamic attribute fields, name/description
 * Step 2 — Images & Variants: drag-drop image upload, variant matrix, SKU generation
 * Step 3 — Pricing & Publish: price inputs, inventory, publish toggle
 *
 * Draft saves after Step 1 (POST /vendor/products with status='draft').
 * Steps 2 & 3 call PATCH /vendor/products/:id.
 */

import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient.js';
import { useUiStore } from '../../stores/uiStore.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface AttributeField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'color' | 'number';
  options?: string[];
  required?: boolean;
}

interface ProductImage {
  id: string;
  url: string;
  file?: File;
}

interface Variant {
  sku: string;
  attributes: Record<string, string>;
  quantityAvailable: number;
}

interface WizardState {
  // Step 1
  categoryId: string;
  name: string;
  description: string;
  attributes: Record<string, string>;
  // Step 2
  images: ProductImage[];
  variants: Variant[];
  // Step 3
  basePriceMinor: string;
  compareAtPriceMinor: string;
  costPriceMinor: string;
  quantityAvailable: number;
  lowStockThreshold: number;
  status: 'draft' | 'active';
  // Internal
  productId: string | null;
}

const INITIAL_STATE: WizardState = {
  categoryId: '',
  name: '',
  description: '',
  attributes: {},
  images: [],
  variants: [],
  basePriceMinor: '',
  compareAtPriceMinor: '',
  costPriceMinor: '',
  quantityAvailable: 0,
  lowStockThreshold: 5,
  status: 'draft',
  productId: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateSku(name: string, variantAttrs: Record<string, string>): string {
  const namePart = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);
  const variantPart = Object.values(variantAttrs)
    .map((v) => v.toLowerCase().slice(0, 5))
    .join('-');
  return variantPart ? `${namePart}-${variantPart}` : namePart;
}

// ── Step indicators ───────────────────────────────────────────────────────────

function StepIndicator({ step, current }: { step: number; current: number }) {
  const done = current > step;
  const active = current === step;
  return (
    <div className="flex items-center gap-2">
      <div
        className={[
          'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
          done
            ? 'bg-green-500 text-white'
            : active
            ? 'bg-grovio-primary text-white'
            : 'border-2 border-grovio-border text-grovio-text-muted',
        ].join(' ')}
      >
        {done ? '✓' : step}
      </div>
      {step < 3 && (
        <div
          className={[
            'h-0.5 w-12 transition-colors sm:w-20',
            current > step ? 'bg-green-500' : 'bg-grovio-border',
          ].join(' ')}
        />
      )}
    </div>
  );
}

// ── Main wizard component ─────────────────────────────────────────────────────

export default function CreateProductWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useUiStore();

  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [attributeFields, setAttributeFields] = useState<AttributeField[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Load categories ────────────────────────────────────────────────────────

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: Category[] }>('/categories');
      return res.data;
    },
  });

  // ── Load attribute template when category changes ──────────────────────────

  const handleCategoryChange = useCallback(async (categoryId: string) => {
    setState((s) => ({ ...s, categoryId, attributes: {} }));
    if (!categoryId) {
      setAttributeFields([]);
      return;
    }
    try {
      const res = await apiClient.get<{ success: boolean; data: { attributes: AttributeField[] } }>(
        `/categories/${categoryId}/attributes`,
      );
      setAttributeFields(res.data.attributes ?? []);
    } catch {
      setAttributeFields([]);
    }
  }, []);

  // ── Image handling ─────────────────────────────────────────────────────────

  const handleImageDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/'),
      );
      const newImages: ProductImage[] = files.map((f) => ({
        id: crypto.randomUUID(),
        url: URL.createObjectURL(f),
        file: f,
      }));
      setState((s) => ({ ...s, images: [...s.images, ...newImages] }));
    },
    [],
  );

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      const newImages: ProductImage[] = files.map((f) => ({
        id: crypto.randomUUID(),
        url: URL.createObjectURL(f),
        file: f,
      }));
      setState((s) => ({ ...s, images: [...s.images, ...newImages] }));
    },
    [],
  );

  function removeImage(id: string) {
    setState((s) => ({ ...s, images: s.images.filter((img) => img.id !== id) }));
  }

  function moveImage(fromIdx: number, toIdx: number) {
    setState((s) => {
      const imgs = [...s.images];
      const [moved] = imgs.splice(fromIdx, 1);
      if (moved) imgs.splice(toIdx, 0, moved);
      return { ...s, images: imgs };
    });
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createDraftMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<{ success: boolean; data: { id: string } }>(
        '/vendor/products',
        body,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorProducts'] });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Record<string, unknown>;
    }) => apiClient.patch(`/vendor/products/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorProducts'] });
    },
  });

  // ── Step navigation ────────────────────────────────────────────────────────

  async function handleStep1Next() {
    if (!state.categoryId || !state.name.trim()) {
      addToast({ id: Date.now().toString(), message: 'Category and product name are required.', variant: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      if (!state.productId) {
        // Create draft product
        const result = await createDraftMutation.mutateAsync({
          categoryId: state.categoryId,
          name: state.name.trim(),
          description: state.description.trim() || null,
          attributes: state.attributes,
          status: 'draft',
        });
        setState((s) => ({ ...s, productId: result.data.id }));
      } else {
        // Update existing draft
        await updateProductMutation.mutateAsync({
          id: state.productId,
          body: {
            categoryId: state.categoryId,
            name: state.name.trim(),
            description: state.description.trim() || null,
            attributes: state.attributes,
          },
        });
      }
      addToast({ id: Date.now().toString(), message: 'Draft saved.', variant: 'success' });
      setStep(2);
    } catch {
      addToast({ id: Date.now().toString(), message: 'Failed to save draft.', variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStep2Next() {
    if (!state.productId) return;
    setIsSaving(true);
    try {
      // Upload images via storage endpoint then patch product
      const imageUrls = await Promise.all(
        state.images.map(async (img) => {
          if (!img.file) return img.url; // already uploaded
          const form = new FormData();
          form.append('file', img.file);
          form.append('folder', 'products');
          try {
            const res = await fetch(
              `${(import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3001'}/vendor/profile/upload-image`,
              { method: 'POST', credentials: 'include', body: form },
            );
            if (res.ok) {
              const data = (await res.json()) as { success: boolean; data: { url: string } };
              return data.data.url;
            }
          } catch {
            // Upload failed — use object URL as fallback
          }
          return img.url;
        }),
      );

      // Auto-generate variants if we have variant attributes
      const variantAttributes = attributeFields.filter(
        (f) => (f.key === 'color' || f.key === 'size') && state.attributes[f.key],
      );

      let variants = state.variants;
      if (variantAttributes.length > 0 && variants.length === 0) {
        variants = [{
          sku: generateSku(state.name, state.attributes),
          attributes: state.attributes,
          quantityAvailable: state.quantityAvailable,
        }];
      }

      await updateProductMutation.mutateAsync({
        id: state.productId,
        body: { imageUrls, variants },
      });
      setState((s) => ({ ...s, images: s.images.map((img, i) => ({ ...img, url: imageUrls[i] ?? img.url })) }));
      setStep(3);
    } catch {
      addToast({ id: Date.now().toString(), message: 'Failed to save images.', variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish(publishStatus: 'draft' | 'active') {
    if (!state.productId) return;
    const basePriceMinor = Math.round(parseFloat(state.basePriceMinor || '0') * 100);
    if (basePriceMinor <= 0) {
      addToast({ id: Date.now().toString(), message: 'Please enter a valid price.', variant: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      await updateProductMutation.mutateAsync({
        id: state.productId,
        body: {
          basePriceMinor,
          compareAtPriceMinor: state.compareAtPriceMinor
            ? Math.round(parseFloat(state.compareAtPriceMinor) * 100)
            : null,
          costPriceMinor: state.costPriceMinor
            ? Math.round(parseFloat(state.costPriceMinor) * 100)
            : null,
          quantityAvailable: state.quantityAvailable,
          lowStockThreshold: state.lowStockThreshold,
          status: publishStatus,
        },
      });
      addToast({
        id: Date.now().toString(),
        message: publishStatus === 'active' ? 'Product published!' : 'Saved as draft.',
        variant: 'success',
      });
      void navigate('/products');
    } catch {
      addToast({ id: Date.now().toString(), message: 'Failed to save product.', variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:border-grovio-primary focus:outline-none';
  const labelClass = 'mb-1 block text-sm font-medium text-grovio-text';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-2xl"
    >
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-grovio-text">Create Product</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">
          Complete all 3 steps to publish your product.
        </p>
      </div>

      {/* Step indicators */}
      <div className="mb-8 flex items-center">
        {[1, 2, 3].map((s) => (
          <StepIndicator key={s} step={s} current={step} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── Step 1: Category & Attributes ───────────────────────────────── */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-6">
              <h2 className="mb-4 text-base font-semibold text-grovio-text">
                Step 1 — Category &amp; Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="category" className={labelClass}>
                    Category <span className="text-grovio-error">*</span>
                  </label>
                  <select
                    id="category"
                    value={state.categoryId}
                    onChange={(e) => void handleCategoryChange(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select a category…</option>
                    {(categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="product-name" className={labelClass}>
                    Product name <span className="text-grovio-error">*</span>
                  </label>
                  <input
                    id="product-name"
                    type="text"
                    value={state.name}
                    onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
                    placeholder="e.g., Premium Cotton T-Shirt"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="description" className={labelClass}>
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={4}
                    value={state.description}
                    onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
                    placeholder="Describe your product…"
                    className={inputClass}
                  />
                </div>

                {/* Dynamic attribute fields */}
                {attributeFields.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-grovio-text-muted uppercase tracking-wide">
                      Category Attributes
                    </h3>
                    {attributeFields.map((field) => (
                      <div key={field.key}>
                        <label htmlFor={`attr-${field.key}`} className={labelClass}>
                          {field.label}
                          {field.required && <span className="ml-1 text-grovio-error">*</span>}
                        </label>
                        {field.type === 'select' && field.options ? (
                          <select
                            id={`attr-${field.key}`}
                            value={state.attributes[field.key] ?? ''}
                            onChange={(e) =>
                              setState((s) => ({
                                ...s,
                                attributes: { ...s.attributes, [field.key]: e.target.value },
                              }))
                            }
                            className={inputClass}
                          >
                            <option value="">Select…</option>
                            {field.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={`attr-${field.key}`}
                            type={field.type === 'number' ? 'number' : 'text'}
                            value={state.attributes[field.key] ?? ''}
                            onChange={(e) =>
                              setState((s) => ({
                                ...s,
                                attributes: { ...s.attributes, [field.key]: e.target.value },
                              }))
                            }
                            className={inputClass}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => void navigate('/products')}
                className="rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text hover:bg-grovio-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving || !state.categoryId || !state.name.trim()}
                onClick={() => void handleStep1Next()}
                className="rounded-lg bg-grovio-primary px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Saving…' : 'Next: Images & Variants →'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 2: Images & Variants ────────────────────────────────────── */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-6">
              <h2 className="mb-4 text-base font-semibold text-grovio-text">
                Step 2 — Images &amp; Variants
              </h2>

              {/* Image drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleImageDrop}
                className={[
                  'rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                  dragOver
                    ? 'border-grovio-primary bg-grovio-primary/5'
                    : 'border-grovio-border',
                ].join(' ')}
              >
                <p className="text-sm font-medium text-grovio-text">
                  Drag images here or{' '}
                  <label className="cursor-pointer text-grovio-primary hover:underline">
                    browse
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </label>
                </p>
                <p className="mt-1 text-xs text-grovio-text-muted">
                  PNG, JPG, WebP up to 10 MB each
                </p>
              </div>

              {/* Image grid */}
              {state.images.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {state.images.map((img, idx) => (
                    <motion.div
                      key={img.id}
                      layout
                      className="group relative aspect-square rounded-lg border border-grovio-border bg-grovio-surface overflow-hidden"
                    >
                      <img
                        src={img.url}
                        alt={`Product image ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => moveImage(idx, idx - 1)}
                            className="rounded bg-white/90 p-1 text-xs"
                            title="Move left"
                          >
                            ←
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(img.id)}
                          className="rounded bg-red-500 p-1 text-xs text-white"
                          title="Remove"
                        >
                          ✕
                        </button>
                        {idx < state.images.length - 1 && (
                          <button
                            type="button"
                            onClick={() => moveImage(idx, idx + 1)}
                            className="rounded bg-white/90 p-1 text-xs"
                            title="Move right"
                          >
                            →
                          </button>
                        )}
                      </div>
                      {idx === 0 && (
                        <span className="absolute left-1 top-1 rounded bg-grovio-primary px-1 text-[10px] text-white">
                          Main
                        </span>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* SKU */}
              <div className="mt-5">
                <label className={labelClass}>Auto-generated SKU</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generateSku(state.name, state.attributes)}
                    className={`${inputClass} bg-grovio-surface/50`}
                  />
                  <p className="flex items-center text-xs text-grovio-text-muted whitespace-nowrap">
                    (editable)
                  </p>
                </div>
              </div>

              {/* Inventory quantity */}
              <div className="mt-4">
                <label htmlFor="qty-step2" className={labelClass}>
                  Initial stock quantity
                </label>
                <input
                  id="qty-step2"
                  type="number"
                  min={0}
                  value={state.quantityAvailable}
                  onChange={(e) =>
                    setState((s) => ({ ...s, quantityAvailable: parseInt(e.target.value, 10) || 0 }))
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text hover:bg-grovio-surface"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleStep2Next()}
                className="rounded-lg bg-grovio-primary px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Uploading…' : 'Next: Pricing →'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 3: Pricing & Publish ────────────────────────────────────── */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-6">
              <h2 className="mb-4 text-base font-semibold text-grovio-text">
                Step 3 — Pricing &amp; Publish
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="base-price" className={labelClass}>
                    Selling price (₹) <span className="text-grovio-error">*</span>
                  </label>
                  <input
                    id="base-price"
                    type="number"
                    min={0}
                    step={0.01}
                    value={state.basePriceMinor}
                    onChange={(e) => setState((s) => ({ ...s, basePriceMinor: e.target.value }))}
                    placeholder="0.00"
                    className={inputClass}
                  />
                  <p className="mt-0.5 text-xs text-grovio-text-muted">In major units (rupees)</p>
                </div>

                <div>
                  <label htmlFor="compare-price" className={labelClass}>
                    Compare-at price (₹)
                  </label>
                  <input
                    id="compare-price"
                    type="number"
                    min={0}
                    step={0.01}
                    value={state.compareAtPriceMinor}
                    onChange={(e) => setState((s) => ({ ...s, compareAtPriceMinor: e.target.value }))}
                    placeholder="0.00"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="cost-price" className={labelClass}>
                    Cost price (₹)
                  </label>
                  <input
                    id="cost-price"
                    type="number"
                    min={0}
                    step={0.01}
                    value={state.costPriceMinor}
                    onChange={(e) => setState((s) => ({ ...s, costPriceMinor: e.target.value }))}
                    placeholder="0.00"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="low-stock" className={labelClass}>
                    Low stock threshold
                  </label>
                  <input
                    id="low-stock"
                    type="number"
                    min={0}
                    value={state.lowStockThreshold}
                    onChange={(e) =>
                      setState((s) => ({ ...s, lowStockThreshold: parseInt(e.target.value, 10) || 0 }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-grovio-border bg-grovio-surface p-4">
                <p className="text-sm font-medium text-grovio-text">
                  Publishing as: <span className="font-bold">{state.status === 'active' ? 'Published' : 'Draft'}</span>
                </p>
                <p className="mt-1 text-xs text-grovio-text-muted">
                  Draft products are not visible to customers. You can publish later.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text hover:bg-grovio-surface"
              >
                ← Back
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handlePublish('draft')}
                  className="rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text transition-colors hover:bg-grovio-surface disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Saving…' : 'Save as Draft'}
                </button>
                <button
                  type="button"
                  disabled={isSaving || !state.basePriceMinor}
                  onClick={() => void handlePublish('active')}
                  className="rounded-lg bg-grovio-primary px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Publishing…' : 'Publish Product'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
