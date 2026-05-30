import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import type { TemplateField } from "@grovio/contracts";
import { categories } from "./categories.js";

/**
 * product_templates table
 *
 * One product template per category (UNIQUE on categoryId). Stores an ordered list
 * of template field hints that speed vendor product creation by providing default
 * values and UX guidance for each category-specific attribute.
 *
 * templateFields references attribute_definition.key (text) rather than UUID so the
 * template survives attribute deletion and recreation with the same key (RESEARCH.md
 * Open Questions #2).
 *
 * ON DELETE CASCADE on categoryId: deleting a category removes its template.
 *
 * Covers CAT-05.
 */
export const productTemplates = pgTable("product_templates", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to the owning category — UNIQUE enforces one template per category.
   * Cascade: deleting a category removes its template.
   */
  categoryId: uuid("category_id")
    .notNull()
    .unique()
    .references(() => categories.id, { onDelete: "cascade" }),

  /**
   * Ordered array of template field definitions.
   * Structure: [{ key: string, default?: string|number|boolean, hint?: string }]
   * Typed via .$type<TemplateField[]>() — DB stores raw JSON; TypeScript sees typed array.
   * Default is an empty array (no template fields defined yet).
   */
  templateFields: jsonb("template_fields")
    .$type<TemplateField[]>()
    .notNull()
    .default([]),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new product template row */
export type InsertProductTemplate = typeof productTemplates.$inferInsert;

/** TypeScript type for selecting a product template row */
export type SelectProductTemplate = typeof productTemplates.$inferSelect;
