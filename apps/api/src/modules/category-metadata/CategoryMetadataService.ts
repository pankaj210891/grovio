import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { MerchandisingBlockSchema } from "@grovio/contracts";
import type { UpsertMetadataInput } from "@grovio/contracts";
import {
  categoryMetadata,
  type SelectCategoryMetadata,
} from "../../db/schema/index.js";

interface CategoryMetadataServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
}

/**
 * CategoryMetadataService
 *
 * Manages SEO fields and merchandising blocks for category landing pages (CAT-07).
 *
 * Security gate (T-02-12 / Pitfall 5): When blocks are present in the input, this
 * service MUST run `MerchandisingBlockSchema.array().parse(input.blocks)` BEFORE any
 * DB write. A Zod parse failure propagates to the caller so the route can return a
 * structured 400 response with validation details. Malformed blocks never reach the DB.
 *
 * Lazy-create pattern (Open Question 1): getMetadata returns null if no row exists yet.
 * upsertMetadata creates the row on first call and updates it on subsequent calls via
 * INSERT … ON CONFLICT DO UPDATE on the unique category_id constraint.
 *
 * One metadata row per category is enforced by the UNIQUE constraint on
 * category_metadata.category_id.
 *
 * Covers CAT-07 (D-12, D-13).
 */
export class CategoryMetadataService {
  constructor(private deps: CategoryMetadataServiceDeps) {}

  /**
   * Retrieve category metadata by category ID.
   *
   * Returns null if no metadata row has been created for the category yet.
   * Absence is valid — the category landing page renders with defaults until
   * an admin configures metadata (lazy-create pattern per Open Question 1).
   *
   * @param categoryId - UUID of the category whose metadata to fetch.
   */
  async getMetadata(categoryId: string): Promise<SelectCategoryMetadata | null> {
    const { db } = this.deps;

    const rows = await db
      .select()
      .from(categoryMetadata)
      .where(eq(categoryMetadata.categoryId, categoryId))
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * Create or update category metadata.
   *
   * Block validation (Pitfall 5 / T-02-12):
   *   When `input.blocks` is provided, runs `MerchandisingBlockSchema.array().parse()`
   *   BEFORE any DB write. A Zod validation failure throws immediately — the DB is
   *   never touched and malformed JSONB never enters the database.
   *
   * Lazy-create (Open Question 1):
   *   Uses INSERT … ON CONFLICT DO UPDATE on the unique category_id so the first call
   *   creates the row and subsequent calls update it. No separate "exists?" check needed.
   *
   * @param categoryId - UUID of the owning category.
   * @param input      - Partial metadata update. All fields are optional.
   */
  async upsertMetadata(
    categoryId: string,
    input: UpsertMetadataInput
  ): Promise<SelectCategoryMetadata> {
    // SECURITY GATE: validate blocks before any DB interaction (Pitfall 5 / T-02-12).
    // This guard runs FIRST — if it throws, no insert/update occurs.
    if (input.blocks !== undefined) {
      MerchandisingBlockSchema.array().parse(input.blocks);
    }

    const { db } = this.deps;
    const now = new Date();

    const [row] = await db
      .insert(categoryMetadata)
      .values({
        categoryId,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        seoKeywords: input.seoKeywords ?? null,
        canonicalUrl: input.canonicalUrl ?? null,
        blocks: input.blocks ?? [],
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: categoryMetadata.categoryId,
        set: {
          // Only update provided fields — undefined means "do not change"
          ...(input.seoTitle !== undefined && { seoTitle: input.seoTitle }),
          ...(input.seoDescription !== undefined && {
            seoDescription: input.seoDescription,
          }),
          ...(input.seoKeywords !== undefined && {
            seoKeywords: input.seoKeywords,
          }),
          ...(input.canonicalUrl !== undefined && {
            canonicalUrl: input.canonicalUrl,
          }),
          ...(input.blocks !== undefined && { blocks: input.blocks }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
          ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
          updatedAt: now,
        },
      })
      .returning();

    return row!;
  }
}
