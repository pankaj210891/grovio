import { z } from "zod";

/**
 * Category tree node — a single node in the GET /categories response.
 *
 * Per D-04, the full tree response includes navigation fields only.
 * Per-category detail (attributes, filters, metadata) is lazy-fetched via separate endpoints.
 *
 * Depth: 0 = root category, 1 = subcategory, 2 = leaf.
 * Maximum depth is 3 levels (D-01) — depth values are 0, 1, 2.
 */

/**
 * TypeScript type declared first to resolve the circular reference in the Zod schema.
 * The Zod schema (CategoryTreeNodeSchema) must reference this type via z.lazy().
 */
export type CategoryTreeNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  /** Tree depth: 0 = root, 1 = subcategory, 2 = leaf (max depth per D-01) */
  depth: number;
  hasChildren: boolean;
  childCount: number;
  children: CategoryTreeNode[];
};

/**
 * Recursive Zod schema for a category tree node.
 * Uses z.lazy() to handle the circular children[] reference.
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
    childCount: z.number().int().min(0),
    children: z.array(CategoryTreeNodeSchema),
  })
);

/** Schema for the GET /categories response body (inside the data envelope) */
export const CategoryTreeResponseSchema = z.object({
  tree: z.array(CategoryTreeNodeSchema),
});

/** TypeScript type for the category tree response */
export type CategoryTreeResponse = z.infer<typeof CategoryTreeResponseSchema>;

/**
 * Flat category detail — returned by GET /categories/:id.
 * Includes admin-relevant fields (isRestricted, archivedAt) unlike the tree node.
 */
export const CategoryDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  parentId: z.string().uuid().nullable(),
  sortOrder: z.number().int(),
  depth: z.number().int().min(0).max(2),
  isRestricted: z.boolean(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** TypeScript type for a category detail response */
export type CategoryDetail = z.infer<typeof CategoryDetailSchema>;

/** Input schema for creating a new category */
export const CreateCategoryInputSchema = z.object({
  name: z.string().min(1),
  /** Omit for root categories; provide for subcategories (max depth 2 per D-01) */
  parentId: z.string().uuid().optional(),
  /** Optional slug override; auto-derived from name if omitted */
  slug: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

/** TypeScript type for category creation input */
export type CreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>;

/** Input schema for updating an existing category */
export const UpdateCategoryInputSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isRestricted: z.boolean().optional(),
});

/** TypeScript type for category update input */
export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInputSchema>;

/** Input schema for reordering sibling categories */
export const ReorderCategoriesInputSchema = z.object({
  /** All sibling IDs in the desired sort order (index = new sort_order) */
  orderedIds: z.array(z.string().uuid()).min(1),
});

/** TypeScript type for category reorder input */
export type ReorderCategoriesInput = z.infer<typeof ReorderCategoriesInputSchema>;
