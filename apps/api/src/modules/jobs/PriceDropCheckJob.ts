import type { Job } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { products } from "../../db/schema/index.js";
import { WishlistService } from "../wishlist/WishlistService.js";
import { NotificationService } from "../notifications/customer/NotificationService.js";

// ---------------------------------------------------------------------------
// Job payload type
// ---------------------------------------------------------------------------

/**
 * PriceDropCheckJob payload.
 *
 * Enqueued by PATCH /vendor/products/:productId/pricing when new price < old price.
 */
export interface PriceDropCheckJobPayload {
  productId: string;
  newPriceMinor: number;
}

// ---------------------------------------------------------------------------
// Processor deps
// ---------------------------------------------------------------------------

interface PriceDropCheckJobDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  logger: FastifyBaseLogger;
}

// ---------------------------------------------------------------------------
// processPriceDropCheckJob
// ---------------------------------------------------------------------------

/**
 * Processes a price drop check job.
 *
 * When a vendor lowers a product price:
 *   1. Find all customers with this product wishlisted where price_at_wishlist_minor > newPriceMinor
 *   2. Insert price_drop notifications for each eligible customer (respecting preferences)
 *   3. Update wishlists.price_at_wishlist_minor = newPriceMinor for all rows
 *
 * Plan 11-05 T4 (PriceDropCheckJob).
 */
export async function processPriceDropCheckJob(
  job: Job<PriceDropCheckJobPayload>,
  deps: PriceDropCheckJobDeps
): Promise<void> {
  const { productId, newPriceMinor } = job.data;
  const { db, logger } = deps;

  logger.info(
    { jobId: job.id, productId, newPriceMinor },
    "[PriceDropCheckJob] Processing price drop check"
  );

  // Fetch product name for notification body
  const [product] = await db
    .select({ name: products.name })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    logger.warn({ productId }, "[PriceDropCheckJob] Product not found — skipping");
    return;
  }

  const wishlistService = new WishlistService({ db });
  const notificationService = new NotificationService({ db });

  // Find customers eligible for price drop notification
  const eligibleCustomerIds = await wishlistService.getWishlistersEligibleForDrop(
    productId,
    newPriceMinor
  );

  logger.info(
    { productId, eligibleCount: eligibleCustomerIds.length },
    "[PriceDropCheckJob] Found eligible customers"
  );

  if (eligibleCustomerIds.length > 0) {
    // Insert price_drop notifications (filters by preferences internally)
    await notificationService.insertBulkPriceDropNotifications({
      customerIds: eligibleCustomerIds,
      productId,
      productName: product.name,
      newPriceMinor,
    });
  }

  // Update all wishlist rows for this product to new price
  // (prevents re-notification on future drops relative to already-notified price)
  await wishlistService.updateWishlistPrices(productId, newPriceMinor);

  logger.info(
    { productId, notifiedCount: eligibleCustomerIds.length },
    "[PriceDropCheckJob] Price drop check complete"
  );
}
