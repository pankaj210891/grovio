/**
 * AttributeRow — a single attribute definition form row for the AttributeBuilderPage.
 *
 * Renders a drag handle (useSortable from dnd-kit), key/label/type fields,
 * required/filterable/searchable checkboxes, and — only when attrType is
 * enum or multi_select — a conditional options editor (list of {value, label} pairs).
 *
 * This is a controlled form row: all state lives in the parent (AttributeBuilderPage).
 * The parent passes down the current row value and an onChange callback.
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AttributeDefinition, AttrType, AttributeOption } from '@grovio/contracts';

/** Row state shape managed by AttributeBuilderPage */
export interface AttributeRowData {
  /** Temporary local ID used as dnd-kit drag handle key (uuid or existing server id) */
  localId: string;
  /** Server-side id — present for existing attributes, undefined for new ones */
  serverId?: string;
  key: string;
  label: string;
  attrType: AttrType;
  options: AttributeOption[];
  isRequired: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
  sortOrder: number;
}

const ATTR_TYPES: { value: AttrType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'enum', label: 'Enum (single-select)' },
  { value: 'multi_select', label: 'Multi-select' },
];

interface AttributeRowProps {
  row: AttributeRowData;
  onChange: (updated: AttributeRowData) => void;
  onRemove: () => void;
}

export default function AttributeRow({ row, onChange, onRemove }: AttributeRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.localId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function update(patch: Partial<AttributeRowData>) {
    onChange({ ...row, ...patch });
  }

  function handleTypeChange(newType: AttrType) {
    // Clear options when switching away from enum/multi_select
    const needsOptions = newType === 'enum' || newType === 'multi_select';
    update({
      attrType: newType,
      options: needsOptions ? (row.options.length > 0 ? row.options : [{ value: '', label: '' }]) : [],
    });
  }

  function addOption() {
    update({ options: [...row.options, { value: '', label: '' }] });
  }

  function removeOption(idx: number) {
    update({ options: row.options.filter((_, i) => i !== idx) });
  }

  function updateOption(idx: number, field: keyof AttributeOption, value: string) {
    const updated = row.options.map((opt, i) =>
      i === idx ? { ...opt, [field]: value } : opt,
    );
    update({ options: updated });
  }

  const needsOptions = row.attrType === 'enum' || row.attrType === 'multi_select';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-4"
    >
      {/* Row header: drag handle + key/label/type + remove */}
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab touch-none text-grovio-text-muted hover:text-grovio-text active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          ⠿
        </button>

        <div className="flex flex-1 flex-col gap-3">
          {/* Key + Label + Type row */}
          <div className="grid grid-cols-3 gap-3">
            {/* Key */}
            <div>
              <label className="mb-1 block text-xs font-medium text-grovio-text-muted">
                Key <span className="text-grovio-error">*</span>
              </label>
              <input
                type="text"
                value={row.key}
                onChange={(e) => update({ key: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                placeholder="e.g. color"
                required
                className="w-full rounded border border-grovio-border bg-grovio-surface px-2 py-1.5 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
              />
            </div>

            {/* Label */}
            <div>
              <label className="mb-1 block text-xs font-medium text-grovio-text-muted">
                Label <span className="text-grovio-error">*</span>
              </label>
              <input
                type="text"
                value={row.label}
                onChange={(e) => {
                  const newLabel = e.target.value;
                  // Auto-derive key from label if key is empty or matches previous auto-derive
                  const autoKey = row.label.replace(/\s+/g, '_').toLowerCase();
                  const shouldAutoKey = row.key === '' || row.key === autoKey;
                  update({
                    label: newLabel,
                    ...(shouldAutoKey ? { key: newLabel.replace(/\s+/g, '_').toLowerCase() } : {}),
                  });
                }}
                placeholder="e.g. Color"
                required
                className="w-full rounded border border-grovio-border bg-grovio-surface px-2 py-1.5 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
              />
            </div>

            {/* Type */}
            <div>
              <label className="mb-1 block text-xs font-medium text-grovio-text-muted">
                Type <span className="text-grovio-error">*</span>
              </label>
              <select
                value={row.attrType}
                onChange={(e) => handleTypeChange(e.target.value as AttrType)}
                className="w-full rounded border border-grovio-border bg-grovio-surface px-2 py-1.5 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
              >
                {ATTR_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex items-center gap-5">
            <label className="flex items-center gap-1.5 text-sm text-grovio-text">
              <input
                type="checkbox"
                checked={row.isRequired}
                onChange={(e) => update({ isRequired: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-grovio-border"
              />
              Required
            </label>
            <label className="flex items-center gap-1.5 text-sm text-grovio-text">
              <input
                type="checkbox"
                checked={row.isFilterable}
                onChange={(e) => update({ isFilterable: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-grovio-border"
              />
              Filterable
            </label>
            <label className="flex items-center gap-1.5 text-sm text-grovio-text">
              <input
                type="checkbox"
                checked={row.isSearchable}
                onChange={(e) => update({ isSearchable: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-grovio-border"
              />
              Searchable
            </label>
          </div>

          {/* Conditional options editor: only for enum and multi_select */}
          {needsOptions && (
            <div className="rounded border border-grovio-border bg-grovio-surface p-3">
              <p className="mb-2 text-xs font-medium text-grovio-text-muted">
                Options <span className="text-grovio-error">*</span>{' '}
                <span className="font-normal">(at least one required)</span>
              </p>

              <div className="flex flex-col gap-2">
                {row.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt.value}
                      onChange={(e) => updateOption(idx, 'value', e.target.value)}
                      placeholder="value"
                      className="w-1/3 rounded border border-grovio-border bg-grovio-surface-raised px-2 py-1 text-xs text-grovio-text focus:border-grovio-primary focus:outline-none"
                    />
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => updateOption(idx, 'label', e.target.value)}
                      placeholder="label"
                      className="flex-1 rounded border border-grovio-border bg-grovio-surface-raised px-2 py-1 text-xs text-grovio-text focus:border-grovio-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="text-xs text-grovio-error hover:underline disabled:opacity-40"
                      disabled={row.options.length <= 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addOption}
                className="mt-2 text-xs font-medium text-grovio-primary hover:underline"
              >
                + Add option
              </button>
            </div>
          )}
        </div>

        {/* Remove row button */}
        <button
          type="button"
          onClick={onRemove}
          className="mt-1 text-sm text-grovio-text-muted hover:text-grovio-error"
          aria-label="Remove attribute"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/** Convert a server AttributeDefinition into a local AttributeRowData for the form */
export function toRowData(attr: AttributeDefinition, localId: string): AttributeRowData {
  return {
    localId,
    serverId: attr.id,
    key: attr.key,
    label: attr.label,
    attrType: attr.attrType,
    options: attr.options ?? [],
    isRequired: attr.isRequired,
    isFilterable: attr.isFilterable,
    isSearchable: attr.isSearchable,
    sortOrder: attr.sortOrder,
  };
}
