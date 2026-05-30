import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { TemplateField } from "@grovio/contracts";
import {
  productTemplates,
  type SelectProductTemplate,
} from "../../db/schema/index.js";

interface ProductTemplateServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
}

/**
 * ProductTemplateService
 *
 * Manages per-category product templates (CAT-05).
 *
 * One template per category is enforced by the UNIQUE constraint on
 * product_templates.category_id. upsertTemplate uses INSERT … ON CONFLICT DO UPDATE
 * so the caller always gets a valid row back whether or not one existed before.
 *
 * templateFields stores an ordered list of { key, default?, hint? } objects.
 * The key references attribute_definitions.key (text), not UUID, so templates
 * survive attribute delete+recreate with the same key (D-open-question-2).
 */
export class ProductTemplateService {
  constructor(private deps: ProductTemplateServiceDeps) {}

  /**
   * Retrieve the product template for a category.
   * Returns null if no template has been defined for the category yet.
   *
   * @param categoryId - UUID of the category whose template to fetch.
   */
  async getTemplate(categoryId: string): Promise<SelectProductTemplate | null> {
    const { db } = this.deps;

    const rows = await db
      .select()
      .from(productTemplates)
      .where(eq(productTemplates.categoryId, categoryId))
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * Create or update the product template for a category.
   *
   * On conflict (same categoryId already has a template), replaces the
   * templateFields and updates updatedAt. Returns the full persisted row.
   *
   * @param categoryId     - UUID of the owning category.
   * @param templateFields - New ordered array of template field definitions.
   */
  async upsertTemplate(
    categoryId: string,
    templateFields: TemplateField[]
  ): Promise<SelectProductTemplate> {
    const { db } = this.deps;

    const now = new Date();

    const [row] = await db
      .insert(productTemplates)
      .values({
        categoryId,
        templateFields,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: productTemplates.categoryId,
        set: {
          templateFields,
          updatedAt: now,
        },
      })
      .returning();

    return row!;
  }
}
