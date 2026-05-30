import { asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { CreateAttributeInput } from "@grovio/contracts";
import {
  attributeDefinitions,
  type InsertAttributeDefinition,
  type SelectAttributeDefinition,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Deps interface (db-only — no Redis/env; attribute definitions are not cached)
// ---------------------------------------------------------------------------

interface AttributeDefinitionServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
}

// ---------------------------------------------------------------------------
// Input type for updateAttribute (partial update)
// ---------------------------------------------------------------------------

export interface UpdateAttributeInput {
  key?: string;
  label?: string;
  options?: Array<{ value: string; label: string }> | null;
  isRequired?: boolean;
  isFilterable?: boolean;
  isSearchable?: boolean;
  sortOrder?: number;
}

// ---------------------------------------------------------------------------
// AttributeDefinitionService
// ---------------------------------------------------------------------------

/**
 * AttributeDefinitionService
 *
 * Schema registry for per-category attribute definitions (CAT-03).
 *
 * Enforces the options business rule (D-05/D-07):
 * - attrType "enum" or "multi_select" MUST have a non-empty options array.
 * - All other attr types MUST NOT carry an options array.
 *
 * Key uniqueness per category is enforced by the unique(category_id, key) DB
 * constraint. When an insert raises a unique violation, a clear Error is
 * surfaced to the caller.
 *
 * No Redis caching in Phase 2 — attribute definitions change infrequently and
 * are not on a hot read path at this stage.
 *
 * Covers CAT-03, T-02-09, T-02-11.
 */
export class AttributeDefinitionService {
  constructor(private deps: AttributeDefinitionServiceDeps) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Return all attribute definitions for a category, ordered by sortOrder asc.
   */
  async getAttributesByCategory(
    categoryId: string
  ): Promise<SelectAttributeDefinition[]> {
    return await this.deps.db
      .select()
      .from(attributeDefinitions)
      .where(eq(attributeDefinitions.categoryId, categoryId))
      .orderBy(asc(attributeDefinitions.sortOrder));
  }

  /**
   * Create a new attribute definition for a category.
   *
   * Validates the options business rule before inserting:
   * - "enum" and "multi_select" require a non-empty options array (D-07).
   * - All other types must not carry an options field.
   *
   * The unique(category_id, key) DB constraint backs key uniqueness (T-02-11).
   * If the insert raises a unique violation, the error propagates to the caller.
   *
   * @throws Error when options validation fails.
   */
  async createAttribute(
    input: CreateAttributeInput & { categoryId: string }
  ): Promise<SelectAttributeDefinition> {
    this.validateOptions(input.attrType, input.options);

    const insertValues: InsertAttributeDefinition = {
      categoryId: input.categoryId,
      key: input.key,
      label: input.label,
      attrType: input.attrType,
      options: input.options ?? null,
      isRequired: input.isRequired ?? false,
      isFilterable: input.isFilterable ?? false,
      isSearchable: input.isSearchable ?? false,
      sortOrder: input.sortOrder ?? 0,
    };

    const [row] = await this.deps.db
      .insert(attributeDefinitions)
      .values(insertValues)
      .returning();

    return row!;
  }

  /**
   * Partially update an existing attribute definition.
   * Returns null if the attribute is not found.
   */
  async updateAttribute(
    id: string,
    input: UpdateAttributeInput
  ): Promise<SelectAttributeDefinition | null> {
    const updateValues: Partial<InsertAttributeDefinition> = {
      ...input,
      updatedAt: new Date(),
    };

    const rows = await this.deps.db
      .update(attributeDefinitions)
      .set(updateValues)
      .where(eq(attributeDefinitions.id, id))
      .returning();

    return rows[0] ?? null;
  }

  /**
   * Hard-delete an attribute definition.
   *
   * No product FK exists in Phase 2 — safe to hard-delete.
   * Phase 3 will re-evaluate once products reference attribute keys via JSONB.
   *
   * Returns null if the attribute was not found.
   */
  async deleteAttribute(id: string): Promise<SelectAttributeDefinition | null> {
    const rows = await this.deps.db
      .delete(attributeDefinitions)
      .where(eq(attributeDefinitions.id, id))
      .returning();

    return rows[0] ?? null;
  }

  /**
   * Batch-update sort_order for an ordered list of attribute IDs.
   * Each ID receives sort_order = its index (0-based).
   *
   * @param _categoryId - Included for caller clarity; not used in DB queries.
   * @param orderedIds - Attribute IDs in their new display order.
   */
  async reorderAttributes(
    _categoryId: string,
    orderedIds: string[]
  ): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.deps.db
        .update(attributeDefinitions)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(attributeDefinitions.id, orderedIds[i]!));
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Enforce options business rule (D-05/D-07, T-02-09).
   *
   * - "enum" and "multi_select" MUST have at least one option.
   * - All other types MUST NOT carry an options field.
   *
   * @throws Error when the rule is violated.
   */
  private validateOptions(
    attrType: string,
    options?: Array<{ value: string; label: string }> | null
  ): void {
    const requiresOptions = attrType === "enum" || attrType === "multi_select";

    if (requiresOptions) {
      if (!options || options.length === 0) {
        throw new Error(
          `Attribute type "${attrType}" requires at least one option.`
        );
      }
    } else {
      if (options && options.length > 0) {
        throw new Error(
          `Attribute type "${attrType}" must not have options.`
        );
      }
    }
  }
}
