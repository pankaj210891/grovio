import {
  integer,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { categories } from "./categories.js";
import { attributeDefinitions } from "./attribute-definitions.js";

/**
 * filter_display_type Drizzle pgEnum — the 4 supported storefront filter widget types.
 * Constrained at the DB level per T-02-03.
 *
 * Recommended attribute type → display type mappings (Pattern 6 in PATTERNS.md):
 *   number       → range_slider
 *   boolean      → toggle
 *   enum         → radio (single) or checkbox (multi-choice)
 *   multi_select → checkbox
 *   text/textarea → not filterable (full-text search only)
 *
 * Values must exactly match DisplayTypeSchema in packages/contracts/src/category/filter-schema.ts.
 */
export const filterDisplayTypeEnum = pgEnum("filter_display_type", [
  "checkbox",
  "radio",
  "range_slider",
  "toggle",
]);

/**
 * filter_schema_definitions table
 *
 * Maps attribute definitions to storefront filter widgets for a specific category.
 * Controls which attributes become filter chips/panels on Product Listing Pages (Phase 4).
 *
 * Business rules enforced in FilterSchemaService:
 * - Only attributes with isFilterable=true may be referenced (service-layer check)
 * - (categoryId, attributeDefId) must be unique (enforced via table-level unique below)
 *
 * ON DELETE CASCADE on both FKs: removing a category or attribute removes its filter entries.
 *
 * Covers CAT-04.
 */
export const filterSchemaDefinitions = pgTable(
  "filter_schema_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** FK to the owning category. Cascade: deleting a category removes its filter schema. */
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),

    /**
     * FK to the attribute being filtered on.
     * Cascade: removing an attribute removes its filter entry.
     */
    attributeDefId: uuid("attribute_def_id")
      .notNull()
      .references(() => attributeDefinitions.id, { onDelete: "cascade" }),

    /**
     * Which UI widget the storefront renders for this filter.
     * Constrained at DB level by filterDisplayTypeEnum (T-02-03).
     */
    displayType: filterDisplayTypeEnum("display_type").notNull(),

    /** Display order within a category's filter panel (lower = first). Default 0. */
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    /**
     * Composite unique constraint: one filter entry per (category, attribute) pair.
     * Prevents the same attribute from appearing twice in a category's filter schema.
     */
    unique().on(t.categoryId, t.attributeDefId),
  ]
);

/** TypeScript type for inserting a new filter schema definition row */
export type InsertFilterSchemaDefinition =
  typeof filterSchemaDefinitions.$inferInsert;

/** TypeScript type for selecting a filter schema definition row */
export type SelectFilterSchemaDefinition =
  typeof filterSchemaDefinitions.$inferSelect;
