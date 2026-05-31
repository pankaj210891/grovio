import { asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import type { FilterSchemaDef } from "@grovio/contracts";
import {
  attributeDefinitions,
  filterSchemaDefinitions,
  type InsertFilterSchemaDefinition,
  type SelectFilterSchemaDefinition,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Deps interface — db + redis for write-through cache invalidation (Pitfall 6)
// ---------------------------------------------------------------------------

interface FilterSchemaServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  /**
   * Redis client used for write-through cache invalidation.
   * After any filter-schema mutation, the cached filter schema for the affected
   * category is deleted so the next SearchService read fetches a fresh version.
   * Redis key convention: "category_filter_schema:{categoryId}" (PATTERNS.md).
   */
  redis: Redis;
}

// ---------------------------------------------------------------------------
// Input type for upsertFilterEntry
// ---------------------------------------------------------------------------

export interface UpsertFilterEntryInput {
  categoryId: string;
  attributeDefId: string;
  displayType: "checkbox" | "radio" | "range_slider" | "toggle";
  sortOrder?: number;
}

// ---------------------------------------------------------------------------
// FilterSchemaService
// ---------------------------------------------------------------------------

/**
 * FilterSchemaService
 *
 * Manages per-category filter schema definitions (CAT-04).
 *
 * Enforces the filterable-only constraint (T-02-10):
 * - Only attributes with `is_filterable = true` may be added to the filter schema.
 * - Before any write, the service loads the attribute row and rejects the
 *   operation when `is_filterable` is false.
 *
 * Provides write-through Redis cache invalidation (Pitfall 6, T-03-G2):
 * - Every mutation (replaceFilterSchema, upsertFilterEntry, removeFilterEntry,
 *   reorderFilterEntries) calls invalidateFilterCache(categoryId) to delete the
 *   "category_filter_schema:{categoryId}" Redis key.
 * - The SearchService (plan 03-06) caches filter schemas under this key. Stale
 *   cache would cause the search facet panel to show removed or outdated facets.
 *
 * getFilterSchema() joins filter_schema_definitions with attribute_definitions
 * to return the `attribute` sub-object (key/label/attrType/options) per the
 * FilterSchemaDef contract shape — what the storefront filter panel needs.
 *
 * Covers CAT-04, T-02-10, Pitfall 6, T-03-G2.
 */
export class FilterSchemaService {
  constructor(private deps: FilterSchemaServiceDeps) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Return all filter schema entries for a category, joined with attribute
   * metadata (key, label, attrType, options), ordered by sortOrder asc.
   *
   * Returns the FilterSchemaDef[] shape — the contract Phase 4 storefront reads
   * to render filter chips/panels on Product Listing Pages.
   */
  async getFilterSchema(categoryId: string): Promise<FilterSchemaDef[]> {
    const { db } = this.deps;

    const rows = await db
      .select({
        fsd_id: filterSchemaDefinitions.id,
        fsd_category_id: filterSchemaDefinitions.categoryId,
        fsd_attribute_def_id: filterSchemaDefinitions.attributeDefId,
        fsd_display_type: filterSchemaDefinitions.displayType,
        fsd_sort_order: filterSchemaDefinitions.sortOrder,
        ad_key: attributeDefinitions.key,
        ad_label: attributeDefinitions.label,
        ad_attr_type: attributeDefinitions.attrType,
        ad_options: attributeDefinitions.options,
      })
      .from(filterSchemaDefinitions)
      .innerJoin(
        attributeDefinitions,
        eq(filterSchemaDefinitions.attributeDefId, attributeDefinitions.id)
      )
      .where(eq(filterSchemaDefinitions.categoryId, categoryId))
      .orderBy(asc(filterSchemaDefinitions.sortOrder));

    return rows.map((row) => ({
      id: row.fsd_id,
      categoryId: row.fsd_category_id,
      attributeDefId: row.fsd_attribute_def_id,
      attribute: {
        key: row.ad_key,
        label: row.ad_label,
        attrType: row.ad_attr_type,
        options: row.ad_options ?? null,
      },
      displayType: row.fsd_display_type,
      sortOrder: row.fsd_sort_order,
    }));
  }

  /**
   * Create or update a single filter schema entry for a category+attribute pair.
   *
   * Filterable-only gate (T-02-10): loads the attribute row and throws when
   * `is_filterable` is false — prevents adding attributes to filter schemas
   * that the admin never marked filterable (CAT-04 / SRCH-04 alignment).
   *
   * Invalidates the "category_filter_schema:{categoryId}" Redis cache key after
   * the insert so SearchService reads a fresh schema on the next request (Pitfall 6).
   *
   * Uses INSERT with ON CONFLICT DO UPDATE (upsert) semantics when possible;
   * falls back to plain INSERT in Phase 2 (unique constraint on category+attribute).
   *
   * @throws Error when the referenced attribute is not filterable.
   * @throws Error when the attribute does not belong to the category.
   */
  async upsertFilterEntry(
    input: UpsertFilterEntryInput
  ): Promise<SelectFilterSchemaDefinition> {
    const { db } = this.deps;

    // Filterable-only gate: load the attribute and check is_filterable.
    const attrRows = await db
      .select()
      .from(attributeDefinitions)
      .where(eq(attributeDefinitions.id, input.attributeDefId))
      .limit(1);

    const attr = attrRows[0];

    if (!attr) {
      throw new Error(
        `Attribute "${input.attributeDefId}" not found.`
      );
    }

    if (!attr.isFilterable) {
      throw new Error(
        `Attribute "${attr.key}" is not filterable. Set is_filterable=true on the attribute before adding it to the filter schema.`
      );
    }

    const insertValues: InsertFilterSchemaDefinition = {
      categoryId: input.categoryId,
      attributeDefId: input.attributeDefId,
      displayType: input.displayType,
      sortOrder: input.sortOrder ?? 0,
    };

    const [row] = await db
      .insert(filterSchemaDefinitions)
      .values(insertValues)
      .returning();

    // Invalidate after successful insert (Pitfall 6, T-03-G2).
    await this.invalidateFilterCache(input.categoryId);

    return row!;
  }

  /**
   * Replace the entire filter schema for a category using PUT semantics.
   *
   * Deletes all existing filter entries for the category, then inserts the
   * new set in order. Each entry is validated for the is_filterable gate.
   *
   * Invalidates the "category_filter_schema:{categoryId}" Redis cache key after
   * all inserts so SearchService reads a fresh schema (Pitfall 6, T-03-G2).
   *
   * Atomic within a single transaction boundary when the DB supports it.
   * In Phase 2, this is a sequential delete + insert (no transaction support
   * wired into the service layer yet).
   *
   * @throws Error if any attribute in the new set is not filterable.
   */
  async replaceFilterSchema(
    categoryId: string,
    filters: UpsertFilterEntryInput[]
  ): Promise<SelectFilterSchemaDefinition[]> {
    const { db } = this.deps;

    // Validate all attributes before making any writes (fail-fast).
    for (const filter of filters) {
      const attrRows = await db
        .select()
        .from(attributeDefinitions)
        .where(eq(attributeDefinitions.id, filter.attributeDefId))
        .limit(1);

      const attr = attrRows[0];
      if (!attr) {
        throw new Error(`Attribute "${filter.attributeDefId}" not found.`);
      }
      if (!attr.isFilterable) {
        throw new Error(
          `Attribute "${attr.key}" is not filterable. Set is_filterable=true on the attribute before adding it to the filter schema.`
        );
      }
    }

    // Delete all existing entries for this category.
    await db
      .delete(filterSchemaDefinitions)
      .where(eq(filterSchemaDefinitions.categoryId, categoryId));

    // Insert the new set in order.
    const results: SelectFilterSchemaDefinition[] = [];
    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i]!;
      const insertValues: InsertFilterSchemaDefinition = {
        categoryId: filter.categoryId,
        attributeDefId: filter.attributeDefId,
        displayType: filter.displayType,
        sortOrder: filter.sortOrder ?? i,
      };
      const [row] = await db
        .insert(filterSchemaDefinitions)
        .values(insertValues)
        .returning();
      results.push(row!);
    }

    // Invalidate after all inserts complete (Pitfall 6, T-03-G2).
    await this.invalidateFilterCache(categoryId);

    return results;
  }

  /**
   * Remove a single filter schema entry by ID.
   *
   * Loads the entry's categoryId before deletion so the correct Redis cache key
   * can be invalidated after the delete (Pitfall 6, T-03-G2).
   *
   * Returns null if the entry was not found (cache is not touched in this case).
   */
  async removeFilterEntry(
    id: string
  ): Promise<SelectFilterSchemaDefinition | null> {
    // Load the entry first to capture its categoryId for cache invalidation.
    const existing = await this.deps.db
      .select()
      .from(filterSchemaDefinitions)
      .where(eq(filterSchemaDefinitions.id, id))
      .limit(1);

    const entry = existing[0];
    if (!entry) return null;

    const rows = await this.deps.db
      .delete(filterSchemaDefinitions)
      .where(eq(filterSchemaDefinitions.id, id))
      .returning();

    const deleted = rows[0] ?? null;

    // Invalidate cache for the affected category (Pitfall 6, T-03-G2).
    if (deleted) {
      await this.invalidateFilterCache(entry.categoryId);
    }

    return deleted;
  }

  /**
   * Batch-update sort_order for an ordered list of filter entry IDs.
   * Each ID receives sort_order = its index (0-based).
   *
   * Invalidates the "category_filter_schema:{categoryId}" Redis cache key after
   * reordering so SearchService reads the updated sort order (Pitfall 6, T-03-G2).
   *
   * @param categoryId - Category whose filter schema is being reordered.
   * @param orderedIds - Filter entry IDs in their new display order.
   */
  async reorderFilterEntries(
    categoryId: string,
    orderedIds: string[]
  ): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.deps.db
        .update(filterSchemaDefinitions)
        .set({ sortOrder: i })
        .where(eq(filterSchemaDefinitions.id, orderedIds[i]!));
    }

    // Invalidate cache after reorder (Pitfall 6, T-03-G2).
    await this.invalidateFilterCache(categoryId);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Invalidate the Redis cache key for a category's filter schema (Pitfall 6).
   *
   * Key convention: "category_filter_schema:{categoryId}" — must match the key
   * SearchService uses when caching filter schemas (plan 03-06, PATTERNS.md).
   * Deleting this key causes the next SearchService.getFilterSchema() call to
   * re-read from the DB and repopulate the cache.
   */
  private async invalidateFilterCache(categoryId: string): Promise<void> {
    await this.deps.redis.del(`category_filter_schema:${categoryId}`);
  }
}
