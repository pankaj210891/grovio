/**
 * FilterSchemaPage — configure which attributes appear as storefront filter facets.
 *
 * Per CAT-04 / Pattern 6: Admin picks from attributes with is_filterable=true,
 * assigns a display type (checkbox/radio/range_slider/toggle) per attribute type,
 * and reorders the filter list. A single Save sends PUT /admin/categories/:id/filters.
 *
 * Routes called:
 *   GET /categories/:id/attributes → load all attributes (filter to is_filterable only)
 *   GET /categories/:id/filters    → load existing filter schema
 *   PUT /admin/categories/:id/filters → replace the filter schema
 *
 * Security (T-02-21): UI only offers is_filterable attributes. Server re-validates.
 */

import type { AttributeDefinition, DisplayType, FilterSchemaDef } from '@grovio/contracts';
import { DndContext, closestCenter, type DragEndEvent, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { get, put } from '../../lib/apiClient.js';
import { ApiError } from '../../lib/apiClient.js';

interface FilterSchemaPageProps {
  categoryId: string;
}

interface FilterFacetRow {
  localId: string;
  attributeDefId: string;
  attributeLabel: string;
  attrType: AttributeDefinition['attrType'];
  displayType: DisplayType;
  sortOrder: number;
}

const DISPLAY_TYPES: { value: DisplayType; label: string }[] = [
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio' },
  { value: 'range_slider', label: 'Range slider' },
  { value: 'toggle', label: 'Toggle' },
];

/**
 * Pattern 6: default display_type per attribute type.
 */
function defaultDisplayType(attrType: AttributeDefinition['attrType']): DisplayType {
  switch (attrType) {
    case 'number': return 'range_slider';
    case 'boolean': return 'toggle';
    case 'enum': return 'radio';
    case 'multi_select': return 'checkbox';
    default: return 'checkbox';
  }
}

interface FacetRowItemProps {
  row: FilterFacetRow;
  onChange: (updated: FilterFacetRow) => void;
  onRemove: () => void;
}

function FacetRowItem({ row, onChange, onRemove }: FacetRowItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.localId,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-grovio-border bg-grovio-surface-raised px-4 py-3"
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-grovio-text-muted hover:text-grovio-text active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>

      {/* Attribute label */}
      <span className="flex-1 text-sm font-medium text-grovio-text">
        {row.attributeLabel}
        <span className="ml-2 text-xs font-normal text-grovio-text-muted">({row.attrType})</span>
      </span>

      {/* Display type selector */}
      <select
        value={row.displayType}
        onChange={(e) => onChange({ ...row, displayType: e.target.value as DisplayType })}
        className="rounded border border-grovio-border bg-grovio-surface px-2 py-1 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
      >
        {DISPLAY_TYPES.map((dt) => (
          <option key={dt.value} value={dt.value}>
            {dt.label}
          </option>
        ))}
      </select>

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="text-sm text-grovio-text-muted hover:text-grovio-error"
        aria-label="Remove facet"
      >
        ✕
      </button>
    </div>
  );
}

export default function FilterSchemaPage({ categoryId }: FilterSchemaPageProps) {
  const queryClient = useQueryClient();
  const [facets, setFacets] = useState<FilterFacetRow[]>([]);
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

  const { data: filters, isLoading: filtersLoading } = useQuery<FilterSchemaDef[]>({
    queryKey: ['categories', categoryId, 'filters'],
    queryFn: async () => {
      const data = await get<{ filters: FilterSchemaDef[] }>(`/categories/${categoryId}/filters`);
      return data.filters;
    },
    enabled: Boolean(categoryId),
  });

  // Sync server filter schema → local facet rows
  useEffect(() => {
    if (filters && attributes) {
      const attrMap = new Map(attributes.map((a) => [a.id, a]));
      setFacets(
        [...filters]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((f, i) => {
            const attr = attrMap.get(f.attributeDefId);
            return {
              localId: f.id,
              attributeDefId: f.attributeDefId,
              attributeLabel: attr?.label ?? f.attribute.label,
              attrType: attr?.attrType ?? f.attribute.attrType,
              displayType: f.displayType,
              sortOrder: i,
            };
          }),
      );
    }
  }, [filters, attributes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setFacets((prev) => {
      const oldIdx = prev.findIndex((r) => r.localId === String(active.id));
      const newIdx = prev.findIndex((r) => r.localId === String(over.id));
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx).map((r, i) => ({ ...r, sortOrder: i }));
    });
  }

  function addFacet(attr: AttributeDefinition) {
    // Prevent duplicates
    if (facets.some((f) => f.attributeDefId === attr.id)) return;

    setFacets((prev) => [
      ...prev,
      {
        localId: `new_${Math.random().toString(36).slice(2)}`,
        attributeDefId: attr.id,
        attributeLabel: attr.label,
        attrType: attr.attrType,
        displayType: defaultDisplayType(attr.attrType),
        sortOrder: prev.length,
      },
    ]);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: { filters: { attributeDefId: string; displayType: DisplayType; sortOrder: number }[] }) =>
      put<unknown>(`/admin/categories/${categoryId}/filters`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories', categoryId, 'filters'] });
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
    saveMutation.mutate({
      filters: facets.map((f, i) => ({
        attributeDefId: f.attributeDefId,
        displayType: f.displayType,
        sortOrder: i,
      })),
    });
  }

  // Only offer filterable attributes that are not already in the facet list
  const filterableAttributes = (attributes ?? []).filter((a) => a.isFilterable);
  const availableToAdd = filterableAttributes.filter(
    (a) => !facets.some((f) => f.attributeDefId === a.id),
  );

  const isLoading = attrsLoading || filtersLoading;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-grovio-text">Filter Schema</h2>
          <p className="mt-0.5 text-sm text-grovio-text-muted">
            Choose which attributes appear as storefront filter widgets and configure their display type.
            Only attributes marked as "Filterable" in the Attributes tab are available here.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save Filters'}
        </button>
      </div>

      {saveError && (
        <div className="mb-4 rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-4 py-2 text-sm text-grovio-error">
          {saveError}
        </div>
      )}

      {saveSuccess && (
        <div className="mb-4 rounded-lg border border-grovio-success/20 bg-grovio-success/10 px-4 py-2 text-sm text-grovio-success">
          Filter schema saved successfully.
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* Active facets */}
          {facets.length === 0 ? (
            <div className="mb-4 rounded-xl border border-dashed border-grovio-border py-10 text-center">
              <p className="text-sm text-grovio-text-muted">
                No filter facets configured yet. Add a filterable attribute below.
              </p>
            </div>
          ) : (
            <div className="mb-4">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={facets.map((f) => f.localId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-2">
                    {facets.map((facet) => (
                      <FacetRowItem
                        key={facet.localId}
                        row={facet}
                        onChange={(updated) =>
                          setFacets((prev) =>
                            prev.map((f) => (f.localId === facet.localId ? updated : f)),
                          )
                        }
                        onRemove={() =>
                          setFacets((prev) => prev.filter((f) => f.localId !== facet.localId))
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* Available filterable attributes to add */}
          {availableToAdd.length > 0 && (
            <div className="rounded-lg border border-grovio-border bg-grovio-surface p-4">
              <p className="mb-2 text-xs font-medium text-grovio-text-muted">
                Add filterable attribute as facet:
              </p>
              <div className="flex flex-wrap gap-2">
                {availableToAdd.map((attr) => (
                  <button
                    key={attr.id}
                    type="button"
                    onClick={() => addFacet(attr)}
                    className="rounded-full border border-grovio-border px-3 py-1 text-xs font-medium text-grovio-text transition-colors hover:border-grovio-primary hover:bg-grovio-primary/5 hover:text-grovio-primary"
                  >
                    + {attr.label}{' '}
                    <span className="font-normal text-grovio-text-muted">({attr.attrType})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filterableAttributes.length === 0 && (
            <div className="mt-2 rounded-lg border border-grovio-border bg-grovio-surface p-4 text-sm text-grovio-text-muted">
              No filterable attributes found. Mark attributes as "Filterable" in the Attributes tab first.
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
