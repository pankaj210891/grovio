import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { AttributeOption } from "@grovio/contracts";
import { categories } from "./categories.js";

/**
 * attr_type Drizzle pgEnum — the 6 supported attribute value types per D-05 and D-06.
 * Constrains attr_type at the Postgres level — invalid values are rejected by the DB
 * even if service-layer validation is bypassed (T-02-03).
 *
 * Values must exactly match AttrTypeSchema in packages/contracts/src/category/attribute-definition.ts.
 */
export const attrTypeEnum = pgEnum("attr_type", [
  "text",
  "textarea",
  "number",
  "boolean",
  "enum",
  "multi_select",
]);

/**
 * attribute_definitions table
 *
 * Per-category attribute schema registry. This is the JSONB + schema registry pattern
 * from ARCHITECTURE.md — explicitly NOT EAV (Pitfall 8, Anti-Pattern 3).
 *
 * Each row defines one typed attribute that products in this category may (or must) carry.
 * Products store their actual attribute values as JSONB in products.attributes (Phase 3).
 *
 * Business rules enforced in AttributeDefinitionService:
 * - options must be a non-empty array when attrType is "enum" or "multi_select"
 * - options must be null for all other types
 * - (categoryId, key) must be unique — enforced via DB unique constraint below
 *
 * ON DELETE CASCADE on categoryId: deleting/archiving a category cascades to its attributes.
 * Note: archived_at soft-delete on categories does NOT cascade — service layer must filter
 * queries by archived_at IS NULL when fetching attributes for active categories (Pitfall 4).
 *
 * Covers CAT-03.
 */
export const attributeDefinitions = pgTable(
  "attribute_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** FK to the owning category. Cascade: deleting a category removes its attributes. */
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),

    /**
     * Programmatic key — e.g., "material", "size", "weight_kg".
     * Unique per category (enforced via table-level unique constraint below).
     * Used as the key in product.attributes JSONB object and in product_templates.template_fields.
     */
    key: text("key").notNull(),

    /** Human-readable label shown in admin attribute builder and vendor product form */
    label: text("label").notNull(),

    /**
     * Attribute value type (pgEnum — constrained at DB level per T-02-03).
     * Determines which input widget is shown and how values are indexed in Phase 3.
     */
    attrType: attrTypeEnum("attr_type").notNull(),

    /**
     * Options array for enum/multi_select attribute types (D-07).
     * Structure: [{ value: string, label: string }]
     * null for text, textarea, number, boolean types.
     * Typed via .$type<AttributeOption[]>() — DB stores raw JSON; TypeScript sees typed array.
     */
    options: jsonb("options").$type<AttributeOption[]>(),

    /** Whether vendors must provide a value for this attribute when creating a product */
    isRequired: boolean("is_required").notNull().default(false),

    /**
     * Whether this attribute can be added to the filter schema (CAT-04).
     * Only attributes with isFilterable=true may appear in filter_schema_definitions.
     */
    isFilterable: boolean("is_filterable").notNull().default(false),

    /**
     * Whether this attribute's value should be projected into OpenSearch (Phase 3).
     * Phase 2 sets the flag; Phase 3 reads it during mapping generation.
     */
    isSearchable: boolean("is_searchable").notNull().default(false),

    /** Display order within a category's attribute list (lower = first). Default 0. */
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    /**
     * Composite unique constraint: one row per (category, key) pair.
     * Prevents duplicate attribute keys within the same category.
     */
    unique().on(t.categoryId, t.key),
  ]
);

/** TypeScript type for inserting a new attribute definition row */
export type InsertAttributeDefinition = typeof attributeDefinitions.$inferInsert;

/** TypeScript type for selecting an attribute definition row */
export type SelectAttributeDefinition = typeof attributeDefinitions.$inferSelect;
