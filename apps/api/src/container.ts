import { asClass, asValue, createContainer, InjectionMode } from "awilix";
import type { FastifyInstance } from "fastify";
import { env } from "./config/env.js";
import { AttributeDefinitionService } from "./modules/attribute-definitions/index.js";
import { ImageService, ProductService } from "./modules/catalog/index.js";
import { CategoryMetadataService } from "./modules/category-metadata/index.js";
import { CategoryService } from "./modules/categories/index.js";
import { CustomerAddressService } from "./modules/customer-addresses/index.js";
import { CustomerAuthService } from "./modules/customer-auth/index.js";
import { FeatureFlagService } from "./modules/feature-flags/index.js";
import { FilterSchemaService } from "./modules/filter-schema/index.js";
import { HomepageService } from "./modules/homepage/index.js";
import { productIndexQueue, reservationQueue, basketCleanupQueue, priceDropQueue, popularSearchesQueue } from "./modules/jobs/queues.js";
import { createMailerTransport } from "./modules/mailer/mailer.js";
import { ProductTemplateService } from "./modules/product-templates/index.js";
import { SearchService } from "./modules/search/index.js";
import { VendorAuthService } from "./modules/vendor-auth/index.js";
import { VendorRestrictionService } from "./modules/vendor-restrictions/index.js";
// Phase 5 service imports
import { BasketService } from "./modules/basket/index.js";
import { InventoryService } from "./modules/inventory/index.js";
import { CheckoutService } from "./modules/checkout/index.js";
import { PaymentService } from "./modules/payments/index.js";
import { WalletService } from "./modules/wallet/index.js";
import { OrderService } from "./modules/orders/index.js";
import { CommissionService } from "./modules/commissions/index.js";
import { CouponService } from "./modules/coupons/index.js";
import { ReturnService } from "./modules/returns/index.js";
// Phase 6 service imports
import { AdminAuthService } from "./modules/admin-auth/index.js";
// Phase 11 service imports
import { AdminService } from "./modules/admin/index.js";
import { storageClient } from "./infrastructure/storage/StorageClient.js";
import { SettingsService } from "./modules/settings/index.js";
import { AuditService } from "./modules/audit/index.js";
import { VendorManagementService } from "./modules/vendor-management/index.js";
import { VendorProfileService } from "./modules/vendor-profile/index.js";
import { VendorStaffService } from "./modules/vendor-staff/index.js";
import { AnalyticsService } from "./modules/analytics/index.js";
import { PayoutService } from "./modules/payouts/index.js";
// Phase 11-05 new feature services
import { WishlistService } from "./modules/wishlist/index.js";
import { ReviewService } from "./modules/reviews/index.js";
import { NotificationService } from "./modules/notifications/customer/index.js";
import { PersonalizationService } from "./modules/personalization/index.js";
import { SupportService } from "./modules/support/index.js";
import { InvoiceService } from "./modules/orders/InvoiceService.js";

/**
 * Create the Awilix DI container for the application.
 *
 * Uses PROXY injection mode — resolvers receive a proxy object whose
 * property accesses trigger lazy resolution from the container.
 * No decorator metadata (`reflect-metadata`) required.
 *
 * The container is pre-populated with core infrastructure values derived
 * from the Fastify instance. Domain service registrations are added in
 * subsequent plans (feature flags in 01-06, auth in 02-x, etc.).
 *
 * Registration order:
 *   1. Infrastructure values (db, redis, logger, env, opensearch, queues, mailer)
 *   2. Domain services (singleton classes — Awilix injects via PROXY)
 *
 * @param fastify - The fully-initialised Fastify instance (after plugin registration)
 */
export function createAppContainer(fastify: FastifyInstance) {
  const container = createContainer({ injectionMode: InjectionMode.PROXY });

  // ── Infrastructure values ────────────────────────────────────────────────
  // Registered first so all domain services can receive them via PROXY injection.
  container.register({
    db: asValue(fastify.db),
    redis: asValue(fastify.redis),
    logger: asValue(fastify.log),
    env: asValue(env),
    // Phase 3: OpenSearch client (null when OPENSEARCH_URL not set — graceful degradation)
    opensearch: asValue(fastify.opensearch),
    // Phase 3: BullMQ product index queue (separate ioredis connection — Pitfall 1)
    productIndexQueue: asValue(productIndexQueue),
    // Phase 4: nodemailer transport — null-safe if SMTP not configured (dev fallback)
    mailer: asValue(createMailerTransport(env)),
    // Phase 5: BullMQ queues for reservation expiry and basket cleanup
    reservationQueue: asValue(reservationQueue),
    basketCleanupQueue: asValue(basketCleanupQueue),
    // Phase 11-05: BullMQ queues for price drop check and popular searches
    priceDropQueue: asValue(priceDropQueue),
    popularSearchesQueue: asValue(popularSearchesQueue),
    // Phase 11: S3-compatible storage client (Cloudflare R2 or Supabase Storage)
    storageClient: asValue(storageClient),
    // productIndexQueue is already registered above (Phase 3); also available for Phase 6 InventoryService pricing updates
  });

  // ── Domain services ──────────────────────────────────────────────────────
  // Registered as classes so Awilix handles instantiation and injects
  // constructor dependencies via PROXY injection mode (no reflect-metadata needed).
  container.register({
    // Phase 1-2 services (existing)
    featureFlagService: asClass(FeatureFlagService).singleton(),
    categoryService: asClass(CategoryService).singleton(),
    attributeDefinitionService: asClass(AttributeDefinitionService).singleton(),
    filterSchemaService: asClass(FilterSchemaService).singleton(),
    productTemplateService: asClass(ProductTemplateService).singleton(),
    vendorRestrictionService: asClass(VendorRestrictionService).singleton(),
    categoryMetadataService: asClass(CategoryMetadataService).singleton(),
    // Phase 3 services (new — plan 03-07)
    vendorAuthService: asClass(VendorAuthService).singleton(),
    productService: asClass(ProductService).singleton(),
    imageService: asClass(ImageService).singleton(),
    searchService: asClass(SearchService).singleton(),
    // Phase 4 services (new — plan 04-05)
    customerAuthService: asClass(CustomerAuthService).singleton(),
    customerAddressService: asClass(CustomerAddressService).singleton(),
    homepageService: asClass(HomepageService).singleton(),
    // Phase 5 services (new — plan 05-10)
    basketService: asClass(BasketService).singleton(),
    inventoryService: asClass(InventoryService).singleton(),
    checkoutService: asClass(CheckoutService).singleton(),
    paymentService: asClass(PaymentService).singleton(),
    walletService: asClass(WalletService).singleton(),
    orderService: asClass(OrderService).singleton(),
    commissionService: asClass(CommissionService).singleton(),
    couponService: asClass(CouponService).singleton(),
    returnService: asClass(ReturnService).singleton(),
    // Phase 6 services (plan 06-08 — full set registered for route wiring)
    adminAuthService: asClass(AdminAuthService).singleton(),
    settingsService: asClass(SettingsService).singleton(),
    auditService: asClass(AuditService).singleton(),
    vendorManagementService: asClass(VendorManagementService).singleton(),
    vendorProfileService: asClass(VendorProfileService).singleton(),
    vendorStaffService: asClass(VendorStaffService).singleton(),
    analyticsService: asClass(AnalyticsService).singleton(),
    payoutService: asClass(PayoutService).singleton(),
    // Phase 11 services (plan 11-02)
    adminService: asClass(AdminService).singleton(),
    // Phase 11-05 new feature services
    wishlistService: asClass(WishlistService).singleton(),
    reviewService: asClass(ReviewService).singleton(),
    notificationService: asClass(NotificationService).singleton(),
    personalizationService: asClass(PersonalizationService).singleton(),
    supportService: asClass(SupportService).singleton(),
    invoiceService: asClass(InvoiceService).singleton(),
  });

  return container;
}

export type AppContainer = ReturnType<typeof createAppContainer>;
