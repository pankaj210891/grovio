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
import { productIndexQueue } from "./modules/jobs/queues.js";
import { createMailerTransport } from "./modules/mailer/mailer.js";
import { ProductTemplateService } from "./modules/product-templates/index.js";
import { SearchService } from "./modules/search/index.js";
import { VendorAuthService } from "./modules/vendor-auth/index.js";
import { VendorRestrictionService } from "./modules/vendor-restrictions/index.js";

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
 *   1. Infrastructure values (db, redis, logger, env, opensearch, productIndexQueue)
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
  });

  return container;
}

export type AppContainer = ReturnType<typeof createAppContainer>;
