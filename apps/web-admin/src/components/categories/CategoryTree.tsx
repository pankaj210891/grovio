/**
 * CategoryTree — wraps @dnd-kit/core DndContext + SortableContext to render
 * the nested category tree as a flat sortable list with depth-based indentation.
 *
 * The tree is flattened (not rendered as nested DOM trees) so dnd-kit
 * SortableContext can manage a single flat list of draggable items.
 *
 * On onDragEnd, sibling sort order is updated via POST /admin/categories/:id/reorder
 * with the new orderedIds array. Uses React Query optimistic update.
 *
 * Indentation follows D-08: pl-0 (depth 0), pl-8 (depth 1), pl-16 (depth 2).
 */

import type { CategoryTreeNode } from '@grovio/contracts';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { post } from '../../lib/apiClient.js';
import { useCategoryUiStore } from '../../stores/categoryUiStore.js';
import CategoryTreeNodeComponent from './CategoryTreeNode.js';

interface FlatNode {
  id: string;
  name: string;
  slug: string;
  depth: number;
  hasChildren: boolean;
  parentId: string | null;
  sortOrder: number;
}

interface CategoryTreeProps {
  tree: CategoryTreeNode[];
  onCreateSubcategory: (parentId: string) => void;
}

/**
 * Recursively flatten the nested tree into an ordered flat list, respecting
 * expand/collapse state from the Zustand store.
 *
 * Collapsed nodes hide their entire subtree from the flat list — they are
 * still in the tree data but not rendered.
 */
function flattenTree(
  nodes: CategoryTreeNode[],
  expandedIds: Set<string>,
  depth = 0,
): FlatNode[] {
  const result: FlatNode[] = [];
  for (const node of nodes) {
    result.push({
      id: node.id,
      name: node.name,
      slug: node.slug,
      depth,
      hasChildren: node.hasChildren,
      parentId: node.parentId,
      sortOrder: node.sortOrder,
    });
    // Only recurse if expanded and has children
    if (node.hasChildren && expandedIds.has(node.id) && node.children.length > 0) {
      result.push(...flattenTree(node.children, expandedIds, depth + 1));
    }
  }
  return result;
}

/**
 * Given a drag event (active id + over id), compute the new sibling order
 * for the active node's parent group and return:
 *   - parentId: the shared parentId of the siblings (or null for roots)
 *   - orderedIds: new order of sibling IDs
 *
 * Returns null if the drag is invalid (cross-parent drag — not supported in v1).
 */
function computeNewOrder(
  flatItems: FlatNode[],
  activeId: string,
  overId: string,
): { parentId: string | null; orderedIds: string[] } | null {
  const activeNode = flatItems.find((n) => n.id === activeId);
  const overNode = flatItems.find((n) => n.id === overId);

  if (!activeNode || !overNode) return null;
  // Only allow reorder within same parent
  if (activeNode.parentId !== overNode.parentId) return null;

  const siblings = flatItems.filter((n) => n.parentId === activeNode.parentId);
  const siblingIds = siblings.map((n) => n.id);
  const oldIndex = siblingIds.indexOf(activeId);
  const newIndex = siblingIds.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1) return null;

  return {
    parentId: activeNode.parentId,
    orderedIds: arrayMove(siblingIds, oldIndex, newIndex),
  };
}

interface CategoryTreeResponse {
  tree: CategoryTreeNode[];
}

export default function CategoryTree({ tree, onCreateSubcategory }: CategoryTreeProps) {
  const queryClient = useQueryClient();
  const { expandedIds } = useCategoryUiStore();

  const flatItems = flattenTree(tree, expandedIds);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const reorderMutation = useMutation({
    mutationFn: (vars: { categoryId: string; orderedIds: string[] }) =>
      post<unknown>(`/admin/categories/${vars.categoryId}/reorder`, {
        orderedIds: vars.orderedIds,
      }),
    onMutate: async (vars) => {
      // Optimistic update: reorder in the cached tree
      await queryClient.cancelQueries({ queryKey: ['categories', 'tree'] });
      const previous = queryClient.getQueryData<CategoryTreeResponse>(['categories', 'tree']);

      queryClient.setQueryData<CategoryTreeResponse>(['categories', 'tree'], (old) => {
        if (!old) return old;
        return {
          tree: applyReorderToTree(old.tree, vars.categoryId, vars.orderedIds),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Roll back on error
      if (context?.previous) {
        queryClient.setQueryData(['categories', 'tree'], context.previous);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const newOrder = computeNewOrder(flatItems, activeId, overId);
    if (!newOrder) return;

    // Use the parentId of the sibling group as the "categoryId" for the reorder
    // endpoint (API: POST /admin/categories/:id/reorder expects the parent's ID,
    // not the dragged node's own ID). Fall back to activeId only for root-level
    // nodes where parentId is null — the server's reorderCategories ignores the
    // param for root reorders but still requires a non-empty :id segment.
    reorderMutation.mutate({
      categoryId: newOrder.parentId ?? activeId,
      orderedIds: newOrder.orderedIds,
    });
  }

  if (flatItems.length === 0) {
    return (
      <p className="px-6 py-8 text-center text-sm text-grovio-text-muted">
        No categories to display.
      </p>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={flatItems.map((n) => n.id)}
        strategy={verticalListSortingStrategy}
      >
        {flatItems.map((node) => (
          <CategoryTreeNodeComponent
            key={node.id}
            node={node}
            onCreateSubcategory={onCreateSubcategory}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Apply a reorder to the in-memory tree for the optimistic update.
 * Finds the group of siblings (by parentId) and reorders them per orderedIds.
 */
function applyReorderToTree(
  nodes: CategoryTreeNode[],
  categoryId: string,
  orderedIds: string[],
): CategoryTreeNode[] {
  // Find the parent of the category being reordered
  const target = findNode(nodes, categoryId);
  if (!target) return nodes;

  if (target.parentId === null) {
    // Root-level reorder
    return reorderByIds(nodes, orderedIds);
  }

  // Subcategory reorder — recurse
  return nodes.map((node) => ({
    ...node,
    children:
      node.id === target.parentId
        ? reorderByIds(node.children, orderedIds)
        : applyReorderToTree(node.children, categoryId, orderedIds),
  }));
}

function reorderByIds(nodes: CategoryTreeNode[], orderedIds: string[]): CategoryTreeNode[] {
  const map = new Map(nodes.map((n) => [n.id, n]));
  // WR-07: also update sortOrder on each node so the optimistic cache reflects
  // the new positions. Without this, a re-sort by sortOrder (e.g., after a
  // mutation triggers an invalidation and the stale cache is read before fresh
  // data arrives) would flash the nodes back to their original order.
  return orderedIds.flatMap((id, i) => {
    const node = map.get(id);
    return node ? [{ ...node, sortOrder: i }] : [];
  });
}

function findNode(nodes: CategoryTreeNode[], id: string): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}
