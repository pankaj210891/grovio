import { z } from "zod";

/**
 * Category tree contract types and Zod schemas.
 *
 * Per D-04: The full tree response includes only navigation fields.
 * No attribute, metadata, or merchandising detail fields are included here.
 * Per-category detail is lazy-fetched via GET /categories/:id.
 *
 * The recursive CategoryTreeNode type requires TypeScript type declaration
 * before the Zod schema to resolve the circular reference.
 */

/**
 * A single node in the category navigation tree.
 * Contains only the fields required for navigation rendering (D-04).
 */
export type CategoryTreeNode = {
  /** Category UUID */
  id: string;
  /** Display name */
  name: string;
  /** URL-safe slug */
  slug: string;
  /** Parent category UUID, or null for root categories */
  parentId: string | null;
  /** Ordering position among siblings */
  sortOrder: number;
  /** Tree depth — 0 (root), 1 (subcategory), 2 (leaf) */
  depth: number;
  /** Whether this node has any children */
  hasChildren: boolean;
  /** Number of direct children */
  childCount: number;
  /** Child nodes — empty array if none */
  children: CategoryTreeNode[];
};

/**
 * Zod schema for CategoryTreeNode.
 * Uses z.lazy() to handle the recursive children reference.
 *
 * Note: The explicit ZodType annotation is required to satisfy TypeScript's
 * type checker when a Zod schema references itself.
 */
export const CategoryTreeNodeSchema: z.ZodType<CategoryTreeNode> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    parentId: z.string().uuid().nullable(),
    sortOrder: z.number().int(),
    depth: z.number().int().min(0).max(2),
    hasChildren: z.boolean(),
    childCount: z.number().int(),
    children: z.array(CategoryTreeNodeSchema),
  })
);

/** Response shape for GET /categories */
export const CategoryTreeResponseSchema = z.object({
  tree: z.array(CategoryTreeNodeSchema),
});

/** TypeScript type inferred from CategoryTreeResponseSchema */
export type CategoryTreeResponse = z.infer<typeof CategoryTreeResponseSchema>;
