import {
  type AnyPgColumn,
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * categories table
 *
 * Stores the category taxonomy as an adjacency list (parent_id) per D-02.
 * Maximum nesting depth is 3 levels (Root → Subcategory → Leaf) enforced at the
 * service layer in CategoryService (D-01). No depth column — computed during
 * tree assembly from the parent chain.
 *
 * Soft-delete via archived_at: admin can archive but not hard-delete categories
 * (FK safety for Phase 3+ product references). ON DELETE RESTRICT on parent_id
 * prevents orphan subtrees (T-02-04).
 *
 * Covers CAT-01, CAT-02.
 */
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * Self-referential FK for the adjacency list (D-02).
   * ON DELETE RESTRICT: prevents deleting a category that still has children —
   * admin must archive or reassign children first.
   * null = root category.
   */
  parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
    onDelete: "restrict",
  }),

  /** Display name of the category (e.g., "Electronics", "Smartphones") */
  name: text("name").notNull(),

  /**
   * URL-safe slug — unique across all categories.
   * Auto-derived from name on create; admin-overridable.
   * CategoryService validates uniqueness before insert/update (Pitfall 7).
   */
  slug: text("slug").notNull().unique(),

  /** Display order within sibling categories (lower = first). Default 0. */
  sortOrder: integer("sort_order").notNull().default(0),

  /**
   * Whether this category requires vendor approval before a vendor can list
   * products in it (D-09). False by default — categories are open to all vendors.
   * Enforcement logic is in Phase 3; Phase 2 sets the flag only.
   */
  isRestricted: boolean("is_restricted").notNull().default(false),

  /**
   * Soft-delete timestamp. null = active; non-null = archived.
   * Archived categories are excluded from GET /categories tree responses.
   * Hard delete is intentionally unavailable — Phase 3+ products may reference
   * category IDs via FK. Archive preserves FK integrity.
   */
  archivedAt: timestamp("archived_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new category row */
export type InsertCategory = typeof categories.$inferInsert;

/** TypeScript type for selecting a category row */
export type SelectCategory = typeof categories.$inferSelect;
