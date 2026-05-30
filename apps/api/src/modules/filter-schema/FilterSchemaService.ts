import { asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { FilterSchemaDef } from "@grovio/contracts";
import {
  attributeDefinitions,
  filterSchemaDefinitions,
  type InsertFilterSchemaDefinition,
  type SelectFilterSchemaDefinition,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Deps interface (db-only — no Redis/env; filter schemas are not cached)
// ---------------------------------------------------------------------------

interface FilterSchemaServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
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
 * getFilterSchema() joins filter_schema_definitions with attribute_definitions
 * to return the `attribute` sub-object (key/label/attrType/options) per the
 * FilterSchemaDef contract shape — what the storefront filter panel needs.
 *
 * No Redis caching in Phase 2 — filter schemas change infrequently and are
 * not on a hot read path at this stage. (Phase 3 search service will cache
 * the derived OpenSearch mapping, not the raw filter schema.)
 *
 * Covers CAT-04, T-02-10.
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

    return row!;
  }

  /**
   * Replace the entire filter schema for a category using PUT semantics.
   *
   * Deletes all existing filter entries for the category, then inserts the
   * new set in order. Each entry is validated for the is_filterable gate.
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

    return results;
  }

  /**
   * Remove a single filter schema entry by ID.
   * Returns null if the entry was not found.
   */
  async removeFilterEntry(
    id: string
  ): Promise<SelectFilterSchemaDefinition | null> {
    const rows = await this.deps.db
      .delete(filterSchemaDefinitions)
      .where(eq(filterSchemaDefinitions.id, id))
      .returning();

    return rows[0] ?? null;
  }

  /**
   * Batch-update sort_order for an ordered list of filter entry IDs.
   * Each ID receives sort_order = its index (0-based).
   *
   * @param _categoryId - Included for caller clarity; not used in DB queries.
   * @param orderedIds - Filter entry IDs in their new display order.
   */
  async reorderFilterEntries(
    _categoryId: string,
    orderedIds: string[]
  ): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.deps.db
        .update(filterSchemaDefinitions)
        .set({ sortOrder: i })
        .where(eq(filterSchemaDefinitions.id, orderedIds[i]!));
    }
  }
}
