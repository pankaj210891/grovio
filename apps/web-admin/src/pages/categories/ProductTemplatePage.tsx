/**
 * ProductTemplatePage — define vendor product creation template for a category.
 *
 * Per CAT-05: Admin sets a default value and hint for each attribute key. Template
 * fields reference attribute definitions by `key` (string), not by id. Save sends
 * the full templateFields array to PUT /admin/categories/:id/template.
 *
 * Routes called:
 *   GET /categories/:id/attributes → load attributes (provides available keys)
 *   GET /categories/:id/template   → load existing template
 *   PUT /admin/categories/:id/template → upsert the template
 */

import type { AttributeDefinition, TemplateField } from '@grovio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { get, put } from '../../lib/apiClient.js';

interface ProductTemplateMeta {
  id: string;
  categoryId: string;
  templateFields: TemplateField[];
}

interface ProductTemplatePageProps {
  categoryId: string;
}

interface TemplateFieldRow {
  key: string;
  label: string;
  attrType: AttributeDefinition['attrType'];
  default: string;
  hint: string;
}

export default function ProductTemplatePage({ categoryId }: ProductTemplatePageProps) {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<TemplateFieldRow[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: attributes, isLoading: attrsLoading } = useQuery<AttributeDefinition[]>({
    queryKey: ['categories', categoryId, 'attributes'],
    queryFn: async () => {
      const data = await get<{ attributes: AttributeDefinition[] }>(`/categories/${categoryId}/attributes`);
      return data.attributes;
    },
    enabled: Boolean(categoryId),
  });

  const { data: template, isLoading: templateLoading } = useQuery<ProductTemplateMeta | null>({
    queryKey: ['categories', categoryId, 'template'],
    queryFn: async () => {
      const data = await get<{ template: ProductTemplateMeta | null }>(`/categories/${categoryId}/template`);
      return data.template;
    },
    enabled: Boolean(categoryId),
  });

  // Merge attributes + existing template fields into form rows
  useEffect(() => {
    if (!attributes) return;

    const existing = new Map<string, TemplateField>(
      (template?.templateFields ?? []).map((f) => [f.key, f]),
    );

    const sorted = [...attributes].sort((a, b) => a.sortOrder - b.sortOrder);
    setFields(
      sorted.map((attr) => {
        const ex = existing.get(attr.key);
        return {
          key: attr.key,
          label: attr.label,
          attrType: attr.attrType,
          default: ex?.default !== undefined ? String(ex.default) : '',
          hint: ex?.hint ?? '',
        };
      }),
    );
  }, [attributes, template]);

  const saveMutation = useMutation({
    mutationFn: (payload: { templateFields: TemplateField[] }) =>
      put<ProductTemplateMeta>(`/admin/categories/${categoryId}/template`, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['categories', categoryId, 'template'], updated);
      void queryClient.invalidateQueries({ queryKey: ['categories', categoryId, 'template'] });
      setSaveSuccess(true);
      setSaveError(null);
    },
    onError: (err: unknown) => {
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
    },
  });

  function handleSave() {
    setSaveSuccess(false);
    setSaveError(null);

    const templateFields: TemplateField[] = fields
      .filter((f) => f.default.trim() !== '' || f.hint.trim() !== '')
      .map((f) => ({
        key: f.key,
        ...(f.default.trim() !== '' ? { default: f.default.trim() } : {}),
        ...(f.hint.trim() !== '' ? { hint: f.hint.trim() } : {}),
      }));

    saveMutation.mutate({ templateFields });
  }

  function updateField(key: string, patch: Partial<Pick<TemplateFieldRow, 'default' | 'hint'>>) {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  const isLoading = attrsLoading || templateLoading;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-grovio-text">Product Template</h2>
          <p className="mt-0.5 text-sm text-grovio-text-muted">
            Set default values and hints for each attribute. Vendors see these when creating products in this category.
            Fields with no default or hint are omitted from the template.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save Template'}
        </button>
      </div>

      {saveError && (
        <div className="mb-4 rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-4 py-2 text-sm text-grovio-error">
          {saveError}
        </div>
      )}

      {saveSuccess && (
        <div className="mb-4 rounded-lg border border-grovio-success/20 bg-grovio-success/10 px-4 py-2 text-sm text-grovio-success">
          Template saved successfully.
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {!isLoading && fields.length === 0 && (
        <div className="rounded-xl border border-dashed border-grovio-border py-12 text-center">
          <p className="text-sm text-grovio-text-muted">
            No attributes defined yet. Add attributes in the Attributes tab first.
          </p>
        </div>
      )}

      {!isLoading && fields.length > 0 && (
        <div className="flex flex-col gap-4">
          {fields.map((field) => (
            <div
              key={field.key}
              className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-medium text-grovio-text">{field.label}</span>
                <span className="rounded-full bg-grovio-border px-2 py-0.5 text-xs text-grovio-text-muted">
                  {field.attrType}
                </span>
                <code className="ml-auto text-xs font-mono text-grovio-text-muted">
                  key: {field.key}
                </code>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Default value */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-grovio-text-muted">
                    Default value
                  </label>
                  <input
                    type="text"
                    value={field.default}
                    onChange={(e) => updateField(field.key, { default: e.target.value })}
                    placeholder={`e.g. ${field.attrType === 'boolean' ? 'true' : field.attrType === 'number' ? '0' : 'some value'}`}
                    className="w-full rounded border border-grovio-border bg-grovio-surface px-3 py-1.5 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                  />
                </div>

                {/* Hint */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-grovio-text-muted">
                    Hint text
                  </label>
                  <input
                    type="text"
                    value={field.hint}
                    onChange={(e) => updateField(field.key, { hint: e.target.value })}
                    placeholder="e.g. Select the primary color of the product"
                    className="w-full rounded border border-grovio-border bg-grovio-surface px-3 py-1.5 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
