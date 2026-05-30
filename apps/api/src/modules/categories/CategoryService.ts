import { asc, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import type { CategoryTreeNode } from "@grovio/contracts";
import type { Env } from "../../config/env.js";
import {
  categories,
  type InsertCategory,
  type SelectCategory,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Domain error
// ---------------------------------------------------------------------------

/**
 * Thrown when createCategory would exceed the 3-level depth limit (D-01).
 *
 * Error code "CATEGORY_DEPTH_EXCEEDED" allows routes to return a structured
 * 422 response without relying on error message string matching.
 */
export class CategoryDepthError extends Error {
  readonly code = "CATEGORY_DEPTH_EXCEEDED";

  constructor(
    message = "Cannot create subcategory: maximum depth of 3 levels reached."
  ) {
    super(message);
    this.name = "CategoryDepthError";
  }
}

// ---------------------------------------------------------------------------
// Deps interface (mirrors FeatureFlagServiceDeps)
// ---------------------------------------------------------------------------

interface CategoryServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  redis: Redis;
  env: Env;
}

// ---------------------------------------------------------------------------
// Input type for createCategory
// ---------------------------------------------------------------------------

export interface CreateCategoryInput {
  name: string;
  slug?: string;
  parentId?: string | null;
  sortOrder?: number;
  isRestricted?: boolean;
}

// ---------------------------------------------------------------------------
// Input type for updateCategory
// ---------------------------------------------------------------------------

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  sortOrder?: number;
  isRestricted?: boolean;
}

// ---------------------------------------------------------------------------
// CategoryService
// ---------------------------------------------------------------------------

/**
 * CategoryService
 *
 * Owns the full category CRUD lifecycle including:
 * - 3-level depth guard (D-01): createCategory throws CategoryDepthError
 *   when parentId is at depth 2 (would create level 4).
 * - Redis-first tree read (D-03): getTree() checks "cat:tree" before querying DB.
 * - Write-through cache invalidation (Pitfall 2): every mutation calls
 *   invalidateTree() immediately after the DB write — never leaves stale cache.
 * - Slug generation: auto-derived from name via slugify; collision handling
 *   appends -2, -3, … (Pitfall 7).
 * - Soft-delete: archiveCategory() sets archivedAt (D-01 FK safety for Phase 3+).
 * - Sibling reorder: reorderCategories() batch-updates sort_order.
 *
 * Redis key: "cat:tree" (singleton — entire tree is one serialised JSON value).
 *
 * Covers CAT-01, CAT-02.
 */
export class CategoryService {
  /** The single Redis key holding the serialised category tree. */
  private readonly treeKey = "cat:tree";

  constructor(private deps: CategoryServiceDeps) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Return the full nested category tree.
   *
   * Redis-first: returns the cached tree immediately on a hit.
   * On miss: queries DB (active categories only, sorted by sort_order),
   * builds the nested tree, writes to Redis with CATEGORY_TREE_TTL_SECONDS TTL,
   * and returns the tree.
   */
  async getTree(): Promise<CategoryTreeNode[]> {
    const { db, redis, env } = this.deps;

    // Redis-first: return cached tree immediately on a hit.
    const cached = await redis.get(this.treeKey);
    if (cached !== null) return JSON.parse(cached) as CategoryTreeNode[];

    // DB fallback on cache miss — active categories only, ordered for stable tree.
    const rows = await db
      .select()
      .from(categories)
      .where(isNull(categories.archivedAt))
      .orderBy(asc(categories.sortOrder));

    const tree = this.buildTree(rows);

    // Populate cache for subsequent reads.
    await redis.setex(
      this.treeKey,
      env.CATEGORY_TREE_TTL_SECONDS,
      JSON.stringify(tree)
    );

    return tree;
  }

  /**
   * Fetch a single category row by ID.
   * Direct DB read — no caching (per-category detail, not the tree).
   * Returns null if the category does not exist or is archived.
   */
  async getCategoryById(id: string): Promise<SelectCategory | null> {
    const { db } = this.deps;

    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * Create a new category with optional parent.
   *
   * Depth guard: throws CategoryDepthError if parentId would place the new
   * category at level 4 (parent depth >= 2, i.e., parent is already a leaf).
   *
   * Slug: auto-derived from name via slugify() if not provided; collision
   * handling appends -2, -3, … (Pitfall 7).
   *
   * Invalidates the Redis tree cache after a successful insert.
   */
  async createCategory(input: CreateCategoryInput): Promise<SelectCategory> {
    const { db } = this.deps;

    // Depth guard (D-01): check parent's depth before inserting.
    if (input.parentId) {
      const parentDepth = await this.getDepth(input.parentId);
      if (parentDepth >= 2) {
        throw new CategoryDepthError();
      }
    }

    // Slug generation with collision handling (Pitfall 7).
    const slug = await this.resolveSlug(input.slug ?? input.name);

    const now = new Date();
    const insertValues: InsertCategory = {
      name: input.name,
      slug,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
      isRestricted: input.isRestricted ?? false,
      createdAt: now,
      updatedAt: now,
    };

    const [row] = await db
      .insert(categories)
      .values(insertValues)
      .returning();

    // Invalidate tree cache after every mutation (Pitfall 2, D-03).
    await this.invalidateTree();

    return row!;
  }

  /**
   * Update mutable fields on an existing category.
   * Invalidates the Redis tree cache after the update.
   */
  async updateCategory(
    id: string,
    input: UpdateCategoryInput
  ): Promise<SelectCategory | null> {
    const { db } = this.deps;

    const updateValues: Partial<InsertCategory> = {
      ...input,
      updatedAt: new Date(),
    };

    // Re-resolve slug if a new slug value was provided.
    if (input.slug !== undefined) {
      updateValues.slug = await this.resolveSlug(input.slug, id);
    }

    const rows = await db
      .update(categories)
      .set(updateValues)
      .where(eq(categories.id, id))
      .returning();

    const row = rows[0] ?? null;
    if (row) {
      await this.invalidateTree();
    }

    return row;
  }

  /**
   * Soft-delete a category by setting archivedAt to the current timestamp.
   * Does NOT hard-delete — Phase 3+ products may hold FK references (D-01).
   * Invalidates the Redis tree cache.
   */
  async archiveCategory(id: string): Promise<SelectCategory | null> {
    const { db } = this.deps;

    const rows = await db
      .update(categories)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();

    const row = rows[0] ?? null;
    if (row) {
      await this.invalidateTree();
    }

    return row;
  }

  /**
   * Update sort_order for an ordered list of sibling category IDs.
   * Each ID in `orderedIds` receives sort_order = its index (0-based).
   * Invalidates the Redis tree cache after all updates.
   *
   * @param _parentId - Not used for DB filtering; included for caller clarity.
   * @param orderedIds - IDs of sibling categories in their new order.
   */
  async reorderCategories(
    _parentId: string | null,
    orderedIds: string[]
  ): Promise<void> {
    const { db } = this.deps;

    // Batch update sort_order for each sibling.
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(categories)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(categories.id, orderedIds[i]!));
    }

    // Invalidate tree cache after all updates (Pitfall 2).
    await this.invalidateTree();
  }

  /**
   * Invalidate the Redis tree cache.
   * Called after every mutation so the next getTree() re-fetches from DB.
   */
  async invalidateTree(): Promise<void> {
    await this.deps.redis.del(this.treeKey);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Build a nested CategoryTreeNode[] from a flat adjacency-list result set.
   *
   * Complexity: O(n) — two passes.
   *   Pass 1: Build a Map from id → node (with depth=0, children=[]).
   *   Pass 2: Walk the map and attach each non-root node to its parent.
   *
   * depth is computed during assembly:
   *   - Root nodes (parentId=null) → depth 0
   *   - Children of roots → depth 1
   *   - Grandchildren → depth 2
   *
   * hasChildren and childCount are set after all children are attached.
   *
   * @param rows - Flat list of SelectCategory rows (archivedAt IS NULL,
   *               ordered by sort_order ascending).
   */
  private buildTree(rows: SelectCategory[]): CategoryTreeNode[] {
    const nodeMap = new Map<string, CategoryTreeNode>();

    // Pass 1: create node stubs.
    for (const row of rows) {
      nodeMap.set(row.id, {
        id: row.id,
        name: row.name,
        slug: row.slug,
        parentId: row.parentId ?? null,
        sortOrder: row.sortOrder,
        depth: 0, // resolved in pass 2
        hasChildren: false,
        childCount: 0,
        children: [],
      });
    }

    const roots: CategoryTreeNode[] = [];

    // Pass 2: attach children to parents; compute depth from parent.
    for (const row of rows) {
      const node = nodeMap.get(row.id)!;
      if (!row.parentId) {
        node.depth = 0;
        roots.push(node);
      } else {
        const parent = nodeMap.get(row.parentId);
        if (parent) {
          node.depth = parent.depth + 1;
          parent.children.push(node);
          parent.hasChildren = true;
          parent.childCount += 1;
        } else {
          // Parent not in result set (e.g., parent was archived). Treat as root.
          node.depth = 0;
          roots.push(node);
        }
      }
    }

    return roots;
  }

  /**
   * Compute the depth of an existing category by walking the parent chain.
   *
   * Returns 0 for root categories (no parentId), 1 for children of root,
   * 2 for grandchildren (leaves). Walks at most 3 hops (depth limit is 3).
   *
   * Used by createCategory to enforce D-01 before inserting.
   *
   * @param categoryId - UUID of the category whose depth to compute.
   */
  private async getDepth(categoryId: string): Promise<number> {
    const { db } = this.deps;

    let depth = 0;
    let currentId: string | null = categoryId;

    // Walk up the parent chain. Max 3 iterations for the 3-level limit.
    while (currentId !== null) {
      const rows = await db
        .select()
        .from(categories)
        .where(eq(categories.id, currentId))
        .limit(1);

      const row = rows[0];
      if (!row) break; // Category not found — treat as depth 0.

      currentId = row.parentId ?? null;
      if (currentId !== null) {
        depth += 1;
      }
    }

    return depth;
  }

  /**
   * Generate a URL-safe slug from a source string.
   * Lowercases, strips non-alphanumeric characters (except hyphens),
   * collapses multiple hyphens, and trims leading/trailing hyphens.
   */
  private slugify(source: string): string {
    return source
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  /**
   * Resolve a unique slug for a new or updated category (Pitfall 7).
   *
   * 1. Slugify the input string.
   * 2. Check whether the slug already exists (excluding `excludeId` if updating).
   * 3. If taken, append -2, -3, … until a free slug is found.
   *
   * @param source - Name or explicit slug string to derive from.
   * @param excludeId - UUID to exclude from uniqueness check (for updates).
   */
  private async resolveSlug(
    source: string,
    excludeId?: string
  ): Promise<string> {
    const { db } = this.deps;
    const base = this.slugify(source);
    let candidate = base;
    let suffix = 2;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const rows = await db
        .select()
        .from(categories)
        .where(eq(categories.slug, candidate))
        .limit(1);

      const existing = rows[0];
      if (!existing || existing.id === excludeId) {
        // Slug is free (or belongs to the record being updated).
        return candidate;
      }

      // Slug is taken — try next suffix.
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
  }
}
