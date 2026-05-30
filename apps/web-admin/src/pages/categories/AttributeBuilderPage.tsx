/**
 * AttributeBuilderPage — edit the attribute schema for a single category.
 *
 * Per CAT-03 / D-08: Admin defines typed attributes (6 types) per category via a
 * reorderable form list (NOT a drag-from-palette). A single Save syncs all adds,
 * updates, removes, and reorders to the backend attribute admin routes.
 *
 * Routes called:
 *   GET    /categories/:id/attributes              → load existing attributes
 *   POST   /admin/categories/:id/attributes        → create new attribute
 *   PATCH  /admin/categories/:id/attributes/:attrId → update existing attribute
 *   DELETE /admin/categories/:id/attributes/:attrId → delete removed attribute
 *   POST   /admin/categories/:id/attributes/reorder → update sort orders
 */

import { DndContext, closestCenter, type DragEndEvent, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import type { AttributeDefinition } from '@grovio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { del, get, patch, post } from '../../lib/apiClient.js';
import AttributeRow, { type AttributeRowData, toRowData } from '../../components/categories/AttributeRow.js';

interface AttributeBuilderPageProps {
  categoryId: string;
}

/** Generate a temporary local ID for new rows (not sent to server) */
function newLocalId(): string {
  return `new_${Math.random().toString(36).slice(2)}`;
}

/** Create a blank row for the "Add attribute" button */
function blankRow(): AttributeRowData {
  return {
    localId: newLocalId(),
    key: '',
    label: '',
    attrType: 'text',
    options: [],
    isRequired: false,
    isFilterable: false,
    isSearchable: false,
    sortOrder: 0,
  };
}

export default function AttributeBuilderPage({ categoryId }: AttributeBuilderPageProps) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<AttributeRowData[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: attributes, isLoading } = useQuery<AttributeDefinition[]>({
    queryKey: ['categories', categoryId, 'attributes'],
    queryFn: () => get<AttributeDefinition[]>(`/categories/${categoryId}/attributes`),
    enabled: Boolean(categoryId),
  });

  // Sync server data → local form rows
  useEffect(() => {
    if (attributes) {
      setRows(
        [...attributes]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((attr) => toRowData(attr, attr.id)),
      );
    }
  }, [attributes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setRows((prev) => {
      const oldIndex = prev.findIndex((r) => r.localId === String(active.id));
      const newIndex = prev.findIndex((r) => r.localId === String(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex).map((r, i) => ({ ...r, sortOrder: i }));
    });
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { ...blankRow(), sortOrder: prev.length },
    ]);
  }

  function removeRow(localId: string) {
    setRows((prev) => prev.filter((r) => r.localId !== localId));
  }

  function updateRow(localId: string, updated: AttributeRowData) {
    setRows((prev) => prev.map((r) => (r.localId === localId ? updated : r)));
  }

  async function handleSave() {
    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);

    try {
      // Validate rows
      for (const row of rows) {
        if (!row.key.trim()) throw new Error('All attributes must have a key.');
        if (!row.label.trim()) throw new Error('All attributes must have a label.');
        const needsOptions = row.attrType === 'enum' || row.attrType === 'multi_select';
        if (needsOptions && row.options.length === 0) {
          throw new Error(`Attribute "${row.label}" (${row.attrType}) requires at least one option.`);
        }
        if (needsOptions) {
          for (const opt of row.options) {
            if (!opt.value.trim() || !opt.label.trim()) {
              throw new Error(`All options for "${row.label}" must have a value and label.`);
            }
          }
        }
      }

      // Determine which server attributes were removed (present in server data but not in rows)
      const serverIds = new Set((attributes ?? []).map((a) => a.id));
      const rowServerIds = new Set(rows.flatMap((r) => (r.serverId ? [r.serverId] : [])));
      const toDelete = [...serverIds].filter((id) => !rowServerIds.has(id));

      // Delete removed attributes
      await Promise.all(
        toDelete.map((attrId) =>
          del<unknown>(`/admin/categories/${categoryId}/attributes/${attrId}`),
        ),
      );

      // Create or update each row
      const savedRows: (AttributeRowData & { serverId: string })[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const payload = {
          key: row.key.trim(),
          label: row.label.trim(),
          attrType: row.attrType,
          options: (row.attrType === 'enum' || row.attrType === 'multi_select') ? row.options : undefined,
          isRequired: row.isRequired,
          isFilterable: row.isFilterable,
          isSearchable: row.isSearchable,
          sortOrder: i,
        };

        if (row.serverId) {
          await patch<AttributeDefinition>(`/admin/categories/${categoryId}/attributes/${row.serverId}`, payload);
          savedRows.push({ ...row, sortOrder: i, serverId: row.serverId });
        } else {
          const created = await post<AttributeDefinition>(`/admin/categories/${categoryId}/attributes`, payload);
          savedRows.push({ ...row, sortOrder: i, serverId: created.id, localId: created.id });
        }
      }

      // Reorder call if there are multiple saved rows
      if (savedRows.length > 1) {
        await post<unknown>(`/admin/categories/${categoryId}/attributes/reorder`, {
          orderedIds: savedRows.map((r) => r.serverId),
        });
      }

      // Invalidate and update local state
      void queryClient.invalidateQueries({ queryKey: ['categories', categoryId, 'attributes'] });
      setRows(savedRows.map((r) => ({ ...r, localId: r.serverId })));
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-grovio-text">Attribute Schema</h2>
          <p className="mt-0.5 text-sm text-grovio-text-muted">
            Define the typed attributes vendors must fill when listing products in this category.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : 'Save Attributes'}
        </button>
      </div>

      {saveError && (
        <div className="mb-4 rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-4 py-2 text-sm text-grovio-error">
          {saveError}
        </div>
      )}

      {saveSuccess && (
        <div className="mb-4 rounded-lg border border-grovio-success/20 bg-grovio-success/10 px-4 py-2 text-sm text-grovio-success">
          Attributes saved successfully.
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {!isLoading && (
        <>
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-grovio-border py-12 text-center">
              <p className="text-sm text-grovio-text-muted">
                No attributes defined yet. Add your first attribute below.
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={rows.map((r) => r.localId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-3">
                  {rows.map((row) => (
                    <AttributeRow
                      key={row.localId}
                      row={row}
                      onChange={(updated) => updateRow(row.localId, updated)}
                      onRemove={() => removeRow(row.localId)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <button
            type="button"
            onClick={addRow}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-grovio-border py-3 text-sm font-medium text-grovio-text-muted transition-colors hover:border-grovio-primary hover:text-grovio-primary"
          >
            + Add attribute
          </button>
        </>
      )}
    </motion.div>
  );
}
