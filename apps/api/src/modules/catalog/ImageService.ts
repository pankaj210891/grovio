import { S3Client, PutObjectCommand, type S3ClientConfig } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import type { Env } from "../../config/env.js";
import {
  productImages,
  products,
  type InsertProductImage,
  type SelectProductImage,
} from "../../db/schema/index.js";
import type { ConfirmImageUploadInput, PresignImageInput, PresignImageResponse } from "@grovio/contracts";

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

/**
 * Thrown when MAX_IMAGES_PER_PRODUCT is reached at presign time (D-11).
 */
export class ImageLimitError extends Error {
  readonly code = "IMAGE_LIMIT_EXCEEDED";

  constructor(message = "Maximum number of images per product has been reached.") {
    super(message);
    this.name = "ImageLimitError";
  }
}

/**
 * Thrown when a vendor attempts to manage images for a product they do not own (V4).
 */
export class ImageOwnershipError extends Error {
  readonly code = "IMAGE_OWNERSHIP_ERROR";

  constructor(message = "You do not have permission to manage images for this product.") {
    super(message);
    this.name = "ImageOwnershipError";
  }
}

/**
 * Thrown when fileSizeBytes > MAX_IMAGE_SIZE_BYTES at presign time (D-11, T-03-P5).
 */
export class ImageSizeError extends Error {
  readonly code = "IMAGE_TOO_LARGE";

  constructor(message: string) {
    super(message);
    this.name = "ImageSizeError";
  }
}

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

interface ImageServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  env: Env;
}

// ---------------------------------------------------------------------------
// ImageService
// ---------------------------------------------------------------------------

/**
 * ImageService
 *
 * Owns the S3-compatible presigned upload flow for product images (D-09 through D-12).
 *
 * Two-step flow:
 *   1. generatePresignedUpload() — verifies ownership + constraints → generates presigned PUT URL
 *      and the resulting CDN URL. Writes NOTHING to the DB (Pitfall 4).
 *   2. confirmUpload() — the ONLY method that writes to product_images.
 *
 * Constraint enforcement at presign time (D-11):
 *   - MAX_IMAGE_SIZE_BYTES (default 5MB): throws ImageSizeError if exceeded
 *   - MAX_IMAGES_PER_PRODUCT (default 8): throws ImageLimitError if at limit
 *
 * Every method verifies product ownership: the product must belong to vendorId (V4).
 *
 * S3 client is initialized lazily from env vars (D-10):
 *   S3_BUCKET_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION
 * Compatible with Cloudflare R2 (default), AWS S3, DigitalOcean Spaces, MinIO.
 *
 * Covers PROD-05, D-09 through D-12, T-03-P5, T-03-P6.
 */
export class ImageService {
  private s3Client: S3Client | null = null;

  constructor(private deps: ImageServiceDeps) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Generate a presigned S3 PUT URL for a product image upload.
   *
   * Verifies product ownership and enforces image count + file size constraints.
   * Returns { uploadUrl, cdnUrl, key } — writes NOTHING to the DB (Pitfall 4).
   *
   * cdnUrl is pre-constructed as `${env.S3_PUBLIC_URL}/${key}` (Pattern 6) —
   * the vendor client should store this URL after upload and pass `key` to confirmUpload().
   *
   * @throws ImageOwnershipError when product doesn't belong to vendorId.
   * @throws ImageSizeError when fileSizeBytes > MAX_IMAGE_SIZE_BYTES.
   * @throws ImageLimitError when image count >= MAX_IMAGES_PER_PRODUCT.
   */
  async generatePresignedUpload(
    productId: string,
    vendorId: string,
    input: PresignImageInput
  ): Promise<PresignImageResponse> {
    const { db, env } = this.deps;

    // 1. Ownership check — product must belong to vendorId (V4)
    const productRows = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.vendorId, vendorId)))
      .limit(1);

    if (!productRows[0]) {
      throw new ImageOwnershipError();
    }

    // 2. Size constraint (D-11, T-03-P5)
    if (input.fileSizeBytes > env.MAX_IMAGE_SIZE_BYTES) {
      throw new ImageSizeError(
        `File size ${input.fileSizeBytes} bytes exceeds the maximum allowed ${env.MAX_IMAGE_SIZE_BYTES} bytes.`
      );
    }

    // 3. Count constraint — check BEFORE generating the URL (D-11, Pitfall 4)
    const existingImages = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .limit(env.MAX_IMAGES_PER_PRODUCT + 1);

    if (existingImages.length >= env.MAX_IMAGES_PER_PRODUCT) {
      throw new ImageLimitError(
        `Product already has ${existingImages.length} images (maximum: ${env.MAX_IMAGES_PER_PRODUCT}).`
      );
    }

    // 4. Generate the S3 object key
    const imageId = randomUUID();
    const key = `products/${productId}/${imageId}`;

    // 5. Build presigned PUT URL (Pattern 6)
    const s3 = this.getS3Client();
    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET_NAME!,
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.fileSizeBytes, // enforced at S3 level — R2/S3 rejects larger PUTs (T-03-P5)
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min TTL

    // 6. Pre-construct the CDN URL (Pattern 6)
    const cdnUrl = `${env.S3_PUBLIC_URL}/${key}`;

    return { uploadUrl, cdnUrl, key };
  }

  /**
   * Confirm a completed image upload and persist the image record to the DB.
   *
   * This is the ONLY method that writes to product_images (Pitfall 4).
   * cdnUrl is reconstructed from `${env.S3_PUBLIC_URL}/${key}`.
   *
   * @throws ImageOwnershipError when product doesn't belong to vendorId.
   */
  async confirmUpload(
    productId: string,
    vendorId: string,
    input: ConfirmImageUploadInput
  ): Promise<SelectProductImage> {
    const { db, env } = this.deps;

    // Ownership check (V4)
    const productRows = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.vendorId, vendorId)))
      .limit(1);

    if (!productRows[0]) {
      throw new ImageOwnershipError();
    }

    // Construct final CDN URL from key (Pattern 6)
    const url = `${env.S3_PUBLIC_URL}/${input.key}`;

    const [row] = await db
      .insert(productImages)
      .values({
        productId,
        url,
        sortOrder: 0,
        altText: input.altText ?? null,
      } satisfies InsertProductImage)
      .returning();

    return row!;
  }

  /**
   * Reorder product images by updating their sortOrder.
   *
   * orderedImageIds: array of image IDs in the desired display order.
   * Each image receives sortOrder = its index in the array.
   *
   * @throws ImageOwnershipError when product doesn't belong to vendorId.
   */
  async reorderImages(
    productId: string,
    vendorId: string,
    orderedImageIds: string[]
  ): Promise<void> {
    const { db } = this.deps;

    // Ownership check (V4)
    const productRows = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.vendorId, vendorId)))
      .limit(1);

    if (!productRows[0]) {
      throw new ImageOwnershipError();
    }

    // Update sortOrder for each image
    for (let i = 0; i < orderedImageIds.length; i++) {
      await db
        .update(productImages)
        .set({ sortOrder: i })
        .where(
          and(
            eq(productImages.id, orderedImageIds[i]!),
            eq(productImages.productId, productId)
          )
        );
    }
  }

  /**
   * Delete a product image.
   *
   * Hard-deletes the product_images row. The S3/R2 object is not deleted here —
   * cleanup of orphaned objects is a separate background concern.
   *
   * @throws ImageOwnershipError when product doesn't belong to vendorId.
   */
  async deleteImage(
    imageId: string,
    productId: string,
    vendorId: string
  ): Promise<void> {
    const { db } = this.deps;

    // Ownership check via the product FK (V4)
    const productRows = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.vendorId, vendorId)))
      .limit(1);

    if (!productRows[0]) {
      throw new ImageOwnershipError();
    }

    await db
      .delete(productImages)
      .where(
        and(
          eq(productImages.id, imageId),
          eq(productImages.productId, productId)
        )
      );
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Lazily initialize the S3Client from env vars.
   * Returns a shared instance on subsequent calls.
   * If S3 env vars are not configured, the client is constructed with undefined values
   * (routes should guard against this — ImageService docs say it requires S3 config).
   */
  private getS3Client(): S3Client {
    if (!this.s3Client) {
      const { env } = this.deps;
      // Build config object, omitting optional properties when they are undefined
      // to satisfy exactOptionalPropertyTypes: true in the tsconfig.
      const config: S3ClientConfig = {
        region: env.S3_REGION ?? "auto",
        ...(env.S3_BUCKET_URL ? { endpoint: env.S3_BUCKET_URL } : {}),
        ...(env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
          ? {
              credentials: {
                accessKeyId: env.S3_ACCESS_KEY_ID,
                secretAccessKey: env.S3_SECRET_ACCESS_KEY,
              },
            }
          : {}),
      };
      this.s3Client = new S3Client(config);
    }
    return this.s3Client;
  }
}
