/**
 * CategoryTreeNode — a single draggable row in the category tree.
 *
 * Uses useSortable from @dnd-kit/sortable for drag-and-drop.
 * Shows name, expand/collapse toggle (when hasChildren), and inline actions:
 *   - Edit: navigate to /categories/:id
 *   - Archive: archive mutation
 *   - Add sub: open create slide-over for a subcategory
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCategoryUiStore } from '../../stores/categoryUiStore.js';
import { post } from '../../lib/apiClient.js';

interface FlatNode {
  id: string;
  name: string;
  slug: string;
  depth: number;
  hasChildren: boolean;
  parentId: string | null;
  sortOrder: number;
}

interface CategoryTreeNodeProps {
  node: FlatNode;
  onCreateSubcategory: (parentId: string) => void;
}

/** Tailwind padding classes indexed by tree depth (0-indexed). */
const DEPTH_PADDING: Record<number, string> = {
  0: 'pl-0',
  1: 'pl-8',
  2: 'pl-16',
};

function getDepthPadding(depth: number): string {
  return DEPTH_PADDING[depth] ?? 'pl-24';
}

export default function CategoryTreeNode({ node, onCreateSubcategory }: CategoryTreeNodeProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { expandedIds, toggleExpand } = useCategoryUiStore();
  const isExpanded = expandedIds.has(node.id);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const archiveMutation = useMutation({
    mutationFn: () => post<unknown>(`/admin/categories/${node.id}/archive`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  function handleArchive(e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Archive "${node.name}"?`)) return;
    archiveMutation.mutate();
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation();
    navigate(`/categories/${node.id}`);
  }

  function handleAddSub(e: React.MouseEvent) {
    e.stopPropagation();
    onCreateSubcategory(node.id);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'group flex items-center gap-2 border-b border-grovio-border px-4 py-3 last:border-b-0',
        'bg-grovio-surface-raised transition-colors',
        isDragging ? 'z-50 shadow-lg' : 'hover:bg-grovio-surface',
        getDepthPadding(node.depth),
      ].join(' ')}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab touch-none text-grovio-text-muted opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>

      {/* Expand/collapse toggle */}
      {node.hasChildren ? (
        <button
          type="button"
          onClick={() => toggleExpand(node.id)}
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-xs text-grovio-text-muted transition-transform"
          style={{ transform: isExpanded ? 'rotate(90deg)' : undefined }}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          ▶
        </button>
      ) : (
        <span className="h-5 w-5 flex-shrink-0" />
      )}

      {/* Depth indicator dots */}
      {node.depth > 0 && (
        <span className="mr-1 text-xs text-grovio-text-muted opacity-40">
          {'·'.repeat(node.depth)}
        </span>
      )}

      {/* Category name */}
      <span className="flex-1 truncate text-sm font-medium text-grovio-text">{node.name}</span>

      {/* Slug badge */}
      <span className="hidden text-xs text-grovio-text-muted sm:block">
        /{node.slug}
      </span>

      {/* Inline actions (visible on hover) */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {/* Add subcategory — only if depth < 2 (max depth is 3 levels = depth 0/1/2) */}
        {node.depth < 2 && (
          <button
            type="button"
            onClick={handleAddSub}
            className="rounded px-2 py-1 text-xs text-grovio-text-muted transition-colors hover:bg-grovio-surface hover:text-grovio-text"
            title="Add subcategory"
          >
            + Sub
          </button>
        )}

        {/* Edit */}
        <button
          type="button"
          onClick={handleEdit}
          className="rounded px-2 py-1 text-xs text-grovio-text-muted transition-colors hover:bg-grovio-surface hover:text-grovio-text"
        >
          Edit
        </button>

        {/* Archive */}
        <button
          type="button"
          onClick={handleArchive}
          disabled={archiveMutation.isPending}
          className="rounded px-2 py-1 text-xs text-grovio-error transition-colors hover:bg-grovio-error/10 disabled:opacity-50"
        >
          {archiveMutation.isPending ? '…' : 'Archive'}
        </button>
      </div>
    </div>
  );
}
