/**
 * BlockEditor — reorderable merchandising block list editor.
 *
 * Per D-12 / CAT-07: Admin manages an ordered list of typed merchandising blocks.
 * v1 block types: banner, product_grid, text_block. No WYSIWYG.
 *
 * Each block type renders its own form fields matching the MerchandisingBlock union.
 * Blocks are reorderable via dnd-kit useSortable.
 *
 * Security (T-02-20): The authoritative gate is the server-side MerchandisingBlockSchema
 * in CategoryMetadataService. The block editor constructs typed blocks; 400 errors from
 * the server are surfaced by CategoryMetadataPage.
 */

import type { BannerBlock, FeaturedCategoriesBlock, MerchandisingBlock, ProductGridBlock, TextBlock } from '@grovio/contracts';
import { DndContext, closestCenter, type DragEndEvent, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';

export interface BlockWithLocalId {
  localId: string;
  block: MerchandisingBlock;
}

interface BlockEditorProps {
  blocks: BlockWithLocalId[];
  onChange: (blocks: BlockWithLocalId[]) => void;
}

function newLocalId() {
  return `blk_${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Per-type block form fields
// ---------------------------------------------------------------------------

interface BannerBlockFormProps {
  block: BannerBlock;
  onChange: (updated: BannerBlock) => void;
}

function BannerBlockForm({ block, onChange }: BannerBlockFormProps) {
  return (
    <div className="flex flex-col gap-2">
      <Field
        label="Image URL *"
        value={block.imageUrl}
        onChange={(v) => onChange({ ...block, imageUrl: v })}
        placeholder="https://example.com/banner.jpg"
      />
      <Field
        label="Title *"
        value={block.title}
        onChange={(v) => onChange({ ...block, title: v })}
        placeholder="Summer Sale"
      />
      <Field
        label="Subtitle"
        value={block.subtitle ?? ''}
        onChange={(v) => onChange({ ...block, subtitle: v || undefined })}
        placeholder="Up to 50% off"
      />
      <Field
        label="CTA text"
        value={block.ctaText ?? ''}
        onChange={(v) => onChange({ ...block, ctaText: v || undefined })}
        placeholder="Shop now"
      />
      <Field
        label="CTA URL"
        value={block.ctaUrl ?? ''}
        onChange={(v) => onChange({ ...block, ctaUrl: v || undefined })}
        placeholder="https://example.com/sale"
      />
    </div>
  );
}

interface ProductGridBlockFormProps {
  block: ProductGridBlock;
  /** Stable localId used as the radio group name — prevents re-renders from breaking
   *  radio exclusivity (WR-01) and avoids the stale-rawIds anti-pattern (WR-02). */
  localId: string;
  onChange: (updated: ProductGridBlock) => void;
}

function ProductGridBlockForm({ block, localId, onChange }: ProductGridBlockFormProps) {
  // WR-02: derive display value from block.productIds directly rather than storing
  // a separate rawIds state that goes stale when the block is replaced externally
  // (e.g., after a dnd-kit reorder triggers arrayMove + onChange in the parent).
  const rawIds = block.productIds.join('\n');

  function handleIdsChange(value: string) {
    const ids = value
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({ ...block, productIds: ids });
  }

  return (
    <div className="flex flex-col gap-2">
      <Field
        label="Section title *"
        value={block.title}
        onChange={(v) => onChange({ ...block, title: v })}
        placeholder="Featured Products"
      />
      <div>
        <label className="mb-1 block text-xs font-medium text-grovio-text-muted">
          Product IDs * <span className="font-normal">(one UUID per line or comma-separated)</span>
        </label>
        <textarea
          value={rawIds}
          onChange={(e) => handleIdsChange(e.target.value)}
          rows={4}
          placeholder={'550e8400-e29b-41d4-a716-446655440000\n...'}
          className="w-full rounded border border-grovio-border bg-grovio-surface px-2 py-1.5 text-xs font-mono text-grovio-text focus:border-grovio-primary focus:outline-none"
        />
        <p className="mt-0.5 text-xs text-grovio-text-muted">
          {block.productIds.length} product{block.productIds.length !== 1 ? 's' : ''} selected
        </p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-grovio-text-muted">Layout</label>
        <div className="flex gap-3">
          {(['grid', 'carousel'] as const).map((layout) => (
            <label key={layout} className="flex items-center gap-1.5 text-sm text-grovio-text">
              <input
                type="radio"
                name={`layout_${localId}`}
                value={layout}
                checked={block.layout === layout}
                onChange={() => onChange({ ...block, layout })}
                className="border-grovio-border"
              />
              {layout.charAt(0).toUpperCase() + layout.slice(1)}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

interface TextBlockFormProps {
  block: TextBlock;
  onChange: (updated: TextBlock) => void;
}

function TextBlockForm({ block, onChange }: TextBlockFormProps) {
  return (
    <div className="flex flex-col gap-2">
      <Field
        label="Title *"
        value={block.title}
        onChange={(v) => onChange({ ...block, title: v })}
        placeholder="About This Category"
      />
      <div>
        <label className="mb-1 block text-xs font-medium text-grovio-text-muted">
          Content * <span className="font-normal">(plain text or Markdown)</span>
        </label>
        <textarea
          value={block.content}
          onChange={(e) => onChange({ ...block, content: e.target.value })}
          rows={5}
          placeholder="Describe this category for shoppers..."
          className="w-full rounded border border-grovio-border bg-grovio-surface px-2 py-1.5 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
        />
      </div>
    </div>
  );
}

interface FeaturedCategoriesBlockFormProps {
  block: FeaturedCategoriesBlock;
  onChange: (updated: FeaturedCategoriesBlock) => void;
}

function FeaturedCategoriesBlockForm({ block, onChange }: FeaturedCategoriesBlockFormProps) {
  const rawIds = block.categoryIds.join('\n');

  function handleIdsChange(value: string) {
    const ids = value
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({ ...block, categoryIds: ids });
  }

  return (
    <div className="flex flex-col gap-2">
      <Field
        label="Section title *"
        value={block.title}
        onChange={(v) => onChange({ ...block, title: v })}
        placeholder="Shop by Category"
      />
      <div>
        <label className="mb-1 block text-xs font-medium text-grovio-text-muted">
          Category IDs * <span className="font-normal">(one UUID per line or comma-separated)</span>
        </label>
        <textarea
          value={rawIds}
          onChange={(e) => handleIdsChange(e.target.value)}
          rows={4}
          placeholder={'550e8400-e29b-41d4-a716-446655440000\n...'}
          className="w-full rounded border border-grovio-border bg-grovio-surface px-2 py-1.5 text-xs font-mono text-grovio-text focus:border-grovio-primary focus:outline-none"
        />
        <p className="mt-0.5 text-xs text-grovio-text-muted">
          {block.categoryIds.length} categor{block.categoryIds.length !== 1 ? 'ies' : 'y'} selected
        </p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-grovio-text-muted">Layout</label>
        <div className="flex gap-3">
          {(['grid', 'row'] as const).map((layout) => (
            <label key={layout} className="flex items-center gap-1.5 text-sm text-grovio-text">
              <input
                type="radio"
                name={`fc_layout_${block.title}`}
                value={layout}
                checked={block.layout === layout}
                onChange={() => onChange({ ...block, layout })}
                className="border-grovio-border"
              />
              {layout.charAt(0).toUpperCase() + layout.slice(1)}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared tiny field helper
// ---------------------------------------------------------------------------

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-grovio-text-muted">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-grovio-border bg-grovio-surface px-2 py-1.5 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single block item (draggable)
// ---------------------------------------------------------------------------

const BLOCK_TYPE_LABELS: Record<MerchandisingBlock['type'], string> = {
  banner: 'Banner',
  product_grid: 'Product Grid',
  text_block: 'Text Block',
  featured_categories: 'Featured Categories',
};

interface BlockItemProps {
  item: BlockWithLocalId;
  onBlockChange: (updated: MerchandisingBlock) => void;
  onRemove: () => void;
}

function BlockItem({ item, onBlockChange, onRemove }: BlockItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.localId,
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
      className="rounded-lg border border-grovio-border bg-grovio-surface-raised"
    >
      {/* Block header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-grovio-text-muted hover:text-grovio-text active:cursor-grabbing"
          aria-label="Drag to reorder block"
        >
          ⠿
        </button>

        <span className="flex-1 text-sm font-medium text-grovio-text">
          {BLOCK_TYPE_LABELS[item.block.type]}
          {item.block.type === 'banner' && item.block.title && (
            <span className="ml-2 font-normal text-grovio-text-muted">— {item.block.title}</span>
          )}
          {item.block.type === 'text_block' && item.block.title && (
            <span className="ml-2 font-normal text-grovio-text-muted">— {item.block.title}</span>
          )}
          {item.block.type === 'product_grid' && item.block.title && (
            <span className="ml-2 font-normal text-grovio-text-muted">— {item.block.title}</span>
          )}
        </span>

        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="text-xs text-grovio-text-muted hover:text-grovio-text"
        >
          {isExpanded ? '▲ Collapse' : '▼ Expand'}
        </button>

        <button
          type="button"
          onClick={onRemove}
          className="text-sm text-grovio-text-muted hover:text-grovio-error"
          aria-label="Remove block"
        >
          ✕
        </button>
      </div>

      {/* Block form fields */}
      {isExpanded && (
        <div className="border-t border-grovio-border px-4 py-4">
          {item.block.type === 'banner' && (
            <BannerBlockForm
              block={item.block}
              onChange={onBlockChange}
            />
          )}
          {item.block.type === 'product_grid' && (
            <ProductGridBlockForm
              block={item.block}
              localId={item.localId}
              onChange={onBlockChange}
            />
          )}
          {item.block.type === 'text_block' && (
            <TextBlockForm
              block={item.block}
              onChange={onBlockChange}
            />
          )}
          {item.block.type === 'featured_categories' && (
            <FeaturedCategoriesBlockForm
              block={item.block}
              onChange={onBlockChange}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main BlockEditor
// ---------------------------------------------------------------------------

const ADD_BLOCK_OPTIONS: { type: MerchandisingBlock['type']; label: string }[] = [
  { type: 'banner', label: 'Banner' },
  { type: 'product_grid', label: 'Product Grid' },
  { type: 'text_block', label: 'Text Block' },
  { type: 'featured_categories', label: 'Featured Categories' },
];

function createDefaultBlock(type: MerchandisingBlock['type']): MerchandisingBlock {
  switch (type) {
    case 'banner':
      return { type: 'banner', imageUrl: '', title: '' };
    case 'product_grid':
      return { type: 'product_grid', title: '', productIds: [], layout: 'grid' };
    case 'text_block':
      return { type: 'text_block', title: '', content: '' };
    case 'featured_categories':
      return { type: 'featured_categories', title: '', categoryIds: [], layout: 'grid' };
  }
}

export default function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = blocks.findIndex((b) => b.localId === String(active.id));
    const newIdx = blocks.findIndex((b) => b.localId === String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    onChange(arrayMove(blocks, oldIdx, newIdx));
  }

  function addBlock(type: MerchandisingBlock['type']) {
    onChange([...blocks, { localId: newLocalId(), block: createDefaultBlock(type) }]);
  }

  function removeBlock(localId: string) {
    onChange(blocks.filter((b) => b.localId !== localId));
  }

  function updateBlock(localId: string, updated: MerchandisingBlock) {
    onChange(blocks.map((b) => (b.localId === localId ? { ...b, block: updated } : b)));
  }

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-grovio-text">Merchandising Blocks</p>

      {blocks.length === 0 ? (
        <div className="mb-3 rounded-lg border border-dashed border-grovio-border py-8 text-center">
          <p className="text-sm text-grovio-text-muted">No blocks yet. Add one below.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={blocks.map((b) => b.localId)}
            strategy={verticalListSortingStrategy}
          >
            <div className="mb-3 flex flex-col gap-3">
              {blocks.map((item) => (
                <BlockItem
                  key={item.localId}
                  item={item}
                  onBlockChange={(updated) => updateBlock(item.localId, updated)}
                  onRemove={() => removeBlock(item.localId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add block type selector */}
      <div className="flex flex-wrap gap-2">
        {ADD_BLOCK_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            type="button"
            onClick={() => addBlock(opt.type)}
            className="rounded-full border border-grovio-border px-3 py-1 text-xs font-medium text-grovio-text-muted transition-colors hover:border-grovio-primary hover:text-grovio-primary"
          >
            + {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
