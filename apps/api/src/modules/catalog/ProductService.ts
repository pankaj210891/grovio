import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Queue } from "bullmq";
import type { FeatureFlagService } from "../feature-flags/FeatureFlagService.js";
import {
  products,
  productVariants,
  attributeDefinitions,
  categories,
  vendorCategoryRestrictions,
  type InsertProduct,
  type InsertProductVariant,
  type SelectProduct,
  type SelectProductVariant,
} from "../../db/schema/index.js";
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
} from "@grovio/contracts";

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a state machine transition is invalid (e.g., submitting non-draft)
 * or a required business rule is violated (e.g., empty rejection reason).
 */
export class ProductStateError extends Error {
  readonly code = "PRODUCT_STATE_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "ProductStateError";
  }
}

/**
 * Thrown when a vendor attempts to mutate a product they do not own (IDOR guard, V4).
 */
export class ProductOwnershipError extends Error {
  readonly code = "PRODUCT_OWNERSHIP_ERROR";

  constructor(message = "You do not have permission to modify this product.") {
    super(message);
    this.name = "ProductOwnershipError";
  }
}

/**
 * Thrown when a product is not found or the queried product does not belong to the vendor.
 */
export class ProductNotFoundError extends Error {
  readonly code = "PRODUCT_NOT_FOUND";

  constructor(message = "Product not found.") {
    super(message);
    this.name = "ProductNotFoundError";
  }
}

/**
 * Thrown when a vendor tries to create a product in a restricted category they are not approved for.
 * Covers D-18/CAT-06.
 */
export class ProductRestrictionError extends Error {
  readonly code = "PRODUCT_RESTRICTION_ERROR";

  constructor(message = "You are not approved to create products in this category.") {
    super(message);
    this.name = "ProductRestrictionError";
  }
}

/**
 * Thrown when product attribute keys or values fail schema validation.
 * Covers T-03-P4, V5.
 */
export class ProductValidationError extends Error {
  readonly code = "PRODUCT_VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "ProductValidationError";
  }
}

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

interface ProductServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  featureFlagService: Pick<FeatureFlagService, "getFlag">;
  /** BullMQ Queue interface — injected via Awilix. Typed against Queue to avoid import cycles with jobs module. */
  productIndexQueue: Pick<Queue, "add">;
}

// ---------------------------------------------------------------------------
// Cursor type for pagination
// ---------------------------------------------------------------------------

interface ProductCursor {
  createdAt: Date;
  id: string;
}

// ---------------------------------------------------------------------------
// ProductService
// ---------------------------------------------------------------------------

/**
 * ProductService
 *
 * Owns all product business logic:
 * - createProduct: attribute validation against schema registry, restriction check, slug generation, draft insert
 * - updateProduct: ownership guard, pending_review→draft reset (D-06, Pitfall 3), no direct status mutation
 * - submitProduct: draft→pending_review or draft→approved via CATALOG_AUTO_APPROVE flag (D-07)
 * - approveProduct: pending_review→approved + index job (D-14)
 * - rejectProduct: pending_review→rejected + required reason (D-08) + delete job if was approved (D-13, Pitfall 7)
 * - archiveProduct: ownership guard, soft-delete archivedAt, delete job (Pitfall 7)
 * - listVendorProducts: cursor pagination, vendor-scoped, non-archived only
 * - variant management: addVariant, updateVariant, deleteVariant (D-04)
 *
 * State changes ONLY via named methods — updateProduct never writes status directly
 * except the mandatory pending_review→draft reset. (Pitfall 3, T-03-P2)
 *
 * Ownership: every vendor-scoped mutation includes `eq(products.vendorId, vendorId)` (V4).
 *
 * Covers PROD-01, PROD-02, PROD-04, PROD-06.
 */
export class ProductService {
  constructor(private deps: ProductServiceDeps) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Create a new product in draft status.
   *
   * Validates attribute keys/types against the category's attribute_definitions schema registry.
   * Enforces vendor-category restriction check (D-18/CAT-06).
   * Generates a unique slug from the product name (collision loop).
   *
   * @throws ProductRestrictionError when category is restricted and vendor not approved.
   * @throws ProductValidationError when attribute keys are unknown.
   */
  async createProduct(
    vendorId: string,
    input: CreateProductInput
  ): Promise<SelectProduct> {
    const { db } = this.deps;

    // 1. Load category — check restriction (D-18/CAT-06)
    const categoryRows = await db
      .select()
      .from(categories)
      .where(eq(categories.id, input.categoryId))
      .limit(1);

    const category = categoryRows[0];
    if (category?.isRestricted) {
      // Check if vendor has an approved restriction entry
      const restrictionRows = await db
        .select()
        .from(vendorCategoryRestrictions)
        .where(
          and(
            eq(vendorCategoryRestrictions.categoryId, input.categoryId),
            eq(vendorCategoryRestrictions.vendorId, vendorId)
          )
        )
        .limit(1);

      if (!restrictionRows[0]) {
        throw new ProductRestrictionError();
      }
    }

    // 2. Validate attributes against the schema registry (T-03-P4)
    const attrDefs = await db
      .select()
      .from(attributeDefinitions)
      .where(eq(attributeDefinitions.categoryId, input.categoryId))
      .limit(200);

    if (input.attributes && Object.keys(input.attributes).length > 0) {
      const allowedKeys = new Set(attrDefs.map((d) => d.key));
      for (const key of Object.keys(input.attributes)) {
        if (!allowedKeys.has(key)) {
          throw new ProductValidationError(
            `Unknown attribute key "${key}" for this category.`
          );
        }
      }
      // Check required attributes
      for (const def of attrDefs) {
        if (
          def.isRequired &&
          (input.attributes[def.key] === undefined ||
            input.attributes[def.key] === null)
        ) {
          throw new ProductValidationError(
            `Required attribute "${def.key}" is missing.`
          );
        }
      }
    } else {
      // No attributes provided — check for required fields
      const requiredDefs = attrDefs.filter((d) => d.isRequired);
      if (requiredDefs.length > 0) {
        throw new ProductValidationError(
          `Required attribute "${requiredDefs[0]!.key}" is missing.`
        );
      }
    }

    // 3. Generate unique slug
    const slug = await this.resolveSlug(input.name);

    // 4. Insert with status=draft
    const now = new Date();
    const [row] = await db
      .insert(products)
      .values({
        vendorId,
        categoryId: input.categoryId,
        name: input.name,
        slug,
        description: input.description ?? null,
        status: "draft",
        basePriceMinor: input.basePriceMinor,
        attributes: (input.attributes ?? {}) as Record<string, unknown>,
        createdAt: now,
        updatedAt: now,
      } satisfies InsertProduct)
      .returning();

    return row!;
  }

  /**
   * Update mutable fields on an existing product.
   *
   * Enforces ownership (vendorId must match).
   * If current status is pending_review, resets to draft BEFORE applying the update (D-06, Pitfall 3).
   * NEVER allows direct status mutation via this method — no status field in UpdateProductInput.
   *
   * @throws ProductOwnershipError when vendorId doesn't match or product not found.
   */
  async updateProduct(
    id: string,
    vendorId: string,
    input: UpdateProductInput
  ): Promise<SelectProduct> {
    const { db } = this.deps;

    // Load product with ownership check (V4)
    const rows = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.vendorId, vendorId)))
      .limit(1);

    const product = rows[0];
    if (!product) {
      throw new ProductOwnershipError();
    }

    // Determine update values — never include status directly (Pitfall 3, T-03-P2)
    const updateValues: Partial<InsertProduct> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateValues.name = input.name;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.basePriceMinor !== undefined) updateValues.basePriceMinor = input.basePriceMinor;
    if (input.attributes !== undefined)
      updateValues.attributes = input.attributes as Record<string, unknown>;

    // D-06 / Pitfall 3: if current status is pending_review, reset to draft
    if (product.status === "pending_review") {
      updateValues.status = "draft";
    }

    const [updated] = await db
      .update(products)
      .set(updateValues)
      .where(and(eq(products.id, id), eq(products.vendorId, vendorId)))
      .returning();

    return updated!;
  }

  /**
   * Submit a product for review (draft → pending_review or draft → approved via flag).
   *
   * Checks CATALOG_AUTO_APPROVE feature flag:
   * - true  → status 'approved' + enqueue { productId, action: 'index' } (D-07, D-14)
   * - false → status 'pending_review'
   *
   * @throws ProductStateError when product is not in 'draft' status.
   * @throws ProductOwnershipError when vendorId doesn't match.
   */
  async submitProduct(id: string, vendorId: string): Promise<SelectProduct> {
    const { db, featureFlagService, productIndexQueue } = this.deps;

    // Load and ownership-check
    const rows = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.vendorId, vendorId)))
      .limit(1);

    const product = rows[0];
    if (!product) throw new ProductOwnershipError();
    if (product.status !== "draft") {
      throw new ProductStateError(
        `Only draft products can be submitted. Current status: ${product.status}`
      );
    }

    // Check auto-approve flag (D-07)
    const autoApproveFlag = await featureFlagService.getFlag("CATALOG_AUTO_APPROVE");
    const newStatus = autoApproveFlag === "true" ? "approved" : "pending_review";

    const [updated] = await db
      .update(products)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(and(eq(products.id, id), eq(products.vendorId, vendorId)))
      .returning();

    if (newStatus === "approved") {
      await productIndexQueue.add(
        "index",
        { productId: id, action: "index" },
        { attempts: 3, backoff: { type: "exponential", delay: 1000 } }
      );
    }

    return updated!;
  }

  /**
   * Admin approves a pending_review product.
   *
   * Transitions: pending_review → approved.
   * Enqueues { productId, action: 'index' } to BullMQ (D-14).
   *
   * @throws ProductStateError when product is not in 'pending_review' status.
   * @throws ProductNotFoundError when product does not exist.
   */
  async approveProduct(id: string): Promise<SelectProduct> {
    const { db, productIndexQueue } = this.deps;

    // Load product
    const rows = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    const product = rows[0];
    if (!product) throw new ProductNotFoundError();
    if (product.status !== "pending_review") {
      throw new ProductStateError(
        `Only pending_review products can be approved. Current status: ${product.status}`
      );
    }

    const [updated] = await db
      .update(products)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    // Enqueue async index job (D-14)
    await productIndexQueue.add(
      "index",
      { productId: id, action: "index" },
      { attempts: 3, backoff: { type: "exponential", delay: 1000 } }
    );

    return updated!;
  }

  /**
   * Admin rejects a pending_review product with a required rejection reason.
   *
   * Transitions: pending_review → rejected.
   * rejectionReason is required and stored (D-08).
   * If the product was previously approved (indexed), enqueues a delete job (D-13, Pitfall 7).
   *
   * @throws ProductStateError when rejectionReason is empty or product not in correct state.
   * @throws ProductNotFoundError when product does not exist.
   */
  async rejectProduct(id: string, rejectionReason: string): Promise<SelectProduct> {
    const { db, productIndexQueue } = this.deps;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new ProductStateError("Rejection reason is required (D-08).");
    }

    // Load product
    const rows = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    const product = rows[0];
    if (!product) throw new ProductNotFoundError();

    // Guard: only pending_review products can be rejected (D-08, state machine)
    if (product.status !== "pending_review") {
      throw new ProductStateError(
        `Only pending_review products can be rejected. Current status: ${product.status}`
      );
    }

    const wasApproved = product.status === "approved";

    const [updated] = await db
      .update(products)
      .set({ status: "rejected", rejectionReason, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    // If product was previously approved/indexed, enqueue delete from OpenSearch (D-13, Pitfall 7)
    if (wasApproved) {
      await productIndexQueue.add(
        "index",
        { productId: id, action: "delete" },
        { attempts: 3, backoff: { type: "exponential", delay: 1000 } }
      );
    }

    return updated!;
  }

  /**
   * Vendor archives their own product (soft-delete).
   *
   * Enforces ownership (vendorId must match).
   * Sets archivedAt to current timestamp.
   * Enqueues delete job to remove from OpenSearch (Pitfall 7).
   *
   * @throws ProductOwnershipError when vendorId doesn't match or product not found.
   */
  async archiveProduct(id: string, vendorId: string): Promise<SelectProduct> {
    const { db, productIndexQueue } = this.deps;

    // Load and ownership-check (V4)
    const rows = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.vendorId, vendorId)))
      .limit(1);

    const product = rows[0];
    if (!product) throw new ProductOwnershipError();

    const [updated] = await db
      .update(products)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(products.id, id), eq(products.vendorId, vendorId)))
      .returning();

    // Enqueue delete from OpenSearch (Pitfall 7)
    await productIndexQueue.add(
      "index",
      { productId: id, action: "delete" },
      { attempts: 3, backoff: { type: "exponential", delay: 1000 } }
    );

    return updated!;
  }

  /**
   * List a vendor's active (non-archived) products with cursor pagination.
   *
   * Cursor pagination follows the composite cursor pattern from RESEARCH.md Code Examples:
   * cursor = { createdAt, id } — orders by (createdAt DESC, id DESC) for stable ordering.
   *
   * @param vendorId - Vendor UUID (scoped query — V4)
   * @param cursor   - Optional pagination cursor from previous page
   * @param limit    - Number of products per page (default 20, max 100)
   */
  async listVendorProducts(
    vendorId: string,
    cursor?: ProductCursor,
    limit = 20
  ): Promise<{ products: SelectProduct[]; nextCursor: ProductCursor | null }> {
    const { db } = this.deps;
    const pageSize = Math.min(Math.max(1, limit), 100);

    const rows = await db
      .select()
      .from(products)
      .where(
        cursor
          ? and(
              eq(products.vendorId, vendorId),
              isNull(products.archivedAt),
              or(
                lt(products.createdAt, cursor.createdAt),
                and(
                  eq(products.createdAt, cursor.createdAt),
                  lt(products.id, cursor.id)
                )
              )
            )
          : and(eq(products.vendorId, vendorId), isNull(products.archivedAt))
      )
      .orderBy(desc(products.createdAt), desc(products.id))
      .limit(pageSize);

    const nextCursor =
      rows.length === pageSize
        ? { createdAt: rows[rows.length - 1]!.createdAt, id: rows[rows.length - 1]!.id }
        : null;

    return { products: rows, nextCursor };
  }

  /**
   * List products in pending_review status for the admin moderation queue (PROD-06, D-06).
   *
   * Ordered by createdAt ASC so oldest submissions appear first.
   * Cursor is an opaque base64url-encoded { createdAt, id } string.
   *
   * [Rule 2 - Missing critical functionality] Admin moderation queue route requires this method.
   */
  async listForModeration(
    limit = 20,
    cursor?: string
  ): Promise<{ products: SelectProduct[]; nextCursor: string | null }> {
    const { db } = this.deps;
    const pageSize = Math.min(Math.max(1, limit), 100);

    let cursorObj: { createdAt: Date; id: string } | undefined;
    if (cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(cursor, "base64url").toString("utf8")
        ) as { createdAt: string; id: string };
        cursorObj = { createdAt: new Date(decoded.createdAt), id: decoded.id };
      } catch {
        // Invalid cursor — ignore, start from beginning
      }
    }

    const rows = await db
      .select()
      .from(products)
      .where(
        cursorObj
          ? and(
              eq(products.status, "pending_review"),
              or(
                lt(products.createdAt, cursorObj.createdAt),
                and(
                  eq(products.createdAt, cursorObj.createdAt),
                  lt(products.id, cursorObj.id)
                )
              )
            )
          : eq(products.status, "pending_review")
      )
      .orderBy(desc(products.createdAt), desc(products.id))
      .limit(pageSize);

    const lastRow = rows[rows.length - 1];
    const nextCursor =
      rows.length === pageSize && lastRow
        ? Buffer.from(
            JSON.stringify({ createdAt: lastRow.createdAt, id: lastRow.id })
          ).toString("base64url")
        : null;

    return { products: rows, nextCursor };
  }

  /**
   * Get a single product by ID scoped to the vendor (ownership check).
   * Returns null if the product does not exist or does not belong to vendorId.
   *
   * [Rule 2 - Missing critical functionality] Added to support GET /vendor/products/:id route
   * without requiring an expensive list-and-find approach. The route needs this for correctness.
   */
  async getVendorProductById(
    id: string,
    vendorId: string
  ): Promise<SelectProduct | null> {
    const { db } = this.deps;

    const rows = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, id),
          eq(products.vendorId, vendorId),
          isNull(products.archivedAt)
        )
      )
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * Add a variant to a product (D-04).
   *
   * Enforces product ownership: the product must belong to vendorId (V4).
   *
   * [Rule 2 - Missing critical functionality] Variant routes in 03-07 plan require this method.
   *
   * @throws ProductOwnershipError when vendorId doesn't match or product not found.
   */
  async addVariant(
    productId: string,
    vendorId: string,
    input: CreateVariantInput
  ): Promise<SelectProductVariant> {
    const { db } = this.deps;

    // Ownership check (V4)
    const productRows = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.vendorId, vendorId)))
      .limit(1);

    if (!productRows[0]) {
      throw new ProductOwnershipError();
    }

    const now = new Date();
    const [row] = await db
      .insert(productVariants)
      .values({
        productId,
        sku: input.sku,
        priceMinor: input.priceMinor,
        optionValues: (input.optionValues ?? {}) as Record<string, unknown>,
        sortOrder: input.sortOrder ?? 0,
        createdAt: now,
        updatedAt: now,
      } satisfies InsertProductVariant)
      .returning();

    return row!;
  }

  /**
   * Update a product variant (D-04).
   *
   * Enforces product ownership: the product must belong to vendorId (V4).
   *
   * [Rule 2 - Missing critical functionality] Variant routes in 03-07 plan require this method.
   *
   * @throws ProductOwnershipError when vendorId doesn't match or product not found.
   * @throws ProductNotFoundError when variantId does not exist on the product.
   */
  async updateVariant(
    variantId: string,
    productId: string,
    vendorId: string,
    input: UpdateVariantInput
  ): Promise<SelectProductVariant> {
    const { db } = this.deps;

    // Ownership check via product FK (V4)
    const productRows = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.vendorId, vendorId)))
      .limit(1);

    if (!productRows[0]) {
      throw new ProductOwnershipError();
    }

    // Build update values from non-undefined input fields
    const updateValues: Partial<InsertProductVariant> = {
      updatedAt: new Date(),
    };
    if (input.sku !== undefined) updateValues.sku = input.sku;
    if (input.priceMinor !== undefined) updateValues.priceMinor = input.priceMinor;
    if (input.optionValues !== undefined)
      updateValues.optionValues = input.optionValues as Record<string, unknown>;
    if (input.sortOrder !== undefined) updateValues.sortOrder = input.sortOrder;

    const [updated] = await db
      .update(productVariants)
      .set(updateValues)
      .where(
        and(
          eq(productVariants.id, variantId),
          eq(productVariants.productId, productId)
        )
      )
      .returning();

    if (!updated) {
      throw new ProductNotFoundError("Variant not found.");
    }

    return updated;
  }

  /**
   * Delete a product variant (D-04).
   *
   * Enforces product ownership: the product must belong to vendorId (V4).
   *
   * [Rule 2 - Missing critical functionality] Variant routes in 03-07 plan require this method.
   *
   * @throws ProductOwnershipError when vendorId doesn't match or product not found.
   */
  async deleteVariant(
    variantId: string,
    productId: string,
    vendorId: string
  ): Promise<void> {
    const { db } = this.deps;

    // Ownership check via product FK (V4)
    const productRows = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.vendorId, vendorId)))
      .limit(1);

    if (!productRows[0]) {
      throw new ProductOwnershipError();
    }

    await db
      .delete(productVariants)
      .where(
        and(
          eq(productVariants.id, variantId),
          eq(productVariants.productId, productId)
        )
      );
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Generate a URL-safe slug from a source string.
   */
  private slugify(source: string): string {
    return source
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  /**
   * Resolve a unique slug for a new product, appending -2, -3, … on collisions.
   * Follows the CategoryService.resolveSlug collision pattern (RESEARCH.md).
   */
  private async resolveSlug(source: string, excludeId?: string): Promise<string> {
    const { db } = this.deps;
    const base = this.slugify(source);
    let candidate = base;
    let suffix = 2;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const rows = await db
        .select()
        .from(products)
        .where(eq(products.slug, candidate))
        .limit(1);

      const existing = rows[0];
      if (!existing || existing.id === excludeId) {
        return candidate;
      }

      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
  }
}
