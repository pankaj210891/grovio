import { z } from "zod";

/**
 * Zod schema for all environment variables required by the API.
 * Any missing or malformed variable causes a parse error at startup — fail fast.
 */
export const envSchema = z.object({
  /** Application environment. Defaults to "development". */
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** Port the HTTP server listens on. Defaults to 3001. */
  PORT: z.coerce.number().default(3001),

  /**
   * PostgreSQL connection string — pooled endpoint for the application server.
   * Neon format: postgresql://USER:PASSWORD@ep-xxx-pooler.neon.tech/DBNAME?sslmode=require
   * Local format: postgresql://USER:PASSWORD@localhost:5432/DBNAME
   *
   * TLS is enabled automatically when the URL contains `.neon.tech` or `sslmode=require`
   * (see requiresSsl() in plugins/drizzle.ts). No code change required when switching
   * between local and cloud — only the URL needs to change.
   *
   * Obtain: Create a Neon project at neon.tech and copy the pooled connection string.
   */
  DATABASE_URL: z.string().url(),

  /**
   * PostgreSQL direct (non-pooled) connection string — used exclusively by drizzle-kit
   * for schema migrations and the db:generate / db:migrate commands.
   *
   * Neon format: postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/DBNAME?sslmode=require
   * (no `-pooler` in the hostname — a direct connection bypasses PgBouncer)
   *
   * Why separate from DATABASE_URL: Neon's pooler runs PgBouncer in transaction mode,
   * which does not support the SET statements and session-level state that drizzle-kit
   * migrations rely on. Using the pooled URL for migrations causes hangs or errors.
   *
   * Optional: backend boots without it. Required only when running pnpm db:migrate.
   * Local Postgres does not need a separate direct URL — omit this var locally.
   *
   * Obtain: In Neon dashboard, copy the "Direct connection" string (not the pooled one).
   */
  DATABASE_DIRECT_URL: z.string().url().optional(),

  /**
   * Redis connection string — TLS-enabled endpoint for Upstash or any rediss:// provider.
   * Upstash format: rediss://:TOKEN@HOST.upstash.io:6380
   * Local format:   redis://localhost:6379
   *
   * TLS is enabled automatically when the URL starts with `rediss://`
   * (see detectRedisTls() in plugins/redis.ts). No code change required when switching
   * between local and cloud — only the URL needs to change.
   *
   * Obtain: Create an Upstash Redis database at upstash.com and copy the rediss:// URL.
   */
  REDIS_URL: z.string().url(),

  /**
   * OpenSearch / Bonsai connection URL including credentials.
   * Bonsai format: https://USER:PASSWORD@CLUSTER.bonsai.io
   *
   * Credentials are embedded in the URL (Basic Auth). Bonsai uses publicly trusted CA
   * certificates — do not set rejectUnauthorized: false.
   *
   * Optional: backend boots without it. Required only when OpenSearch client is
   * initialized (Phase 3 — Catalog & Search).
   *
   * Obtain: Create a Bonsai Sandbox cluster at bonsai.io and copy the access URL.
   */
  OPENSEARCH_URL: z.string().url().optional(),

  /**
   * HS256 JWT signing secret. Minimum 32 characters.
   * Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   * Never reuse across environments.
   */
  JWT_SECRET: z.string().min(32),

  /**
   * Redis TTL in seconds for cached feature flag values.
   * Controls how quickly feature flag changes propagate. Defaults to 60 seconds.
   * Per architecture decision D-05: feature flags are DB-backed + Redis-cached.
   */
  FEATURE_FLAG_TTL_SECONDS: z.coerce.number().default(60),

  /**
   * Redis TTL in seconds for the cached category tree (the "cat:tree" key).
   * Controls how quickly category tree changes propagate to consumers on a Redis miss.
   * Defaults to 300 seconds (5 minutes).
   *
   * Note: CategoryService uses write-through invalidation — every admin mutation
   * (create, update, archive, reorder) calls redis.del("cat:tree") immediately after
   * the DB write. This TTL is therefore a safety net only (handles rare crash/gap
   * scenarios), not the primary propagation mechanism (D-03).
   */
  CATEGORY_TREE_TTL_SECONDS: z.coerce.number().default(300),

  // ---------------------------------------------------------------------------
  // S3 / Cloudflare R2 — image upload flow (Phase 3, D-09 through D-11)
  // ---------------------------------------------------------------------------

  /**
   * S3-compatible endpoint URL for the bucket.
   * Cloudflare R2: https://<account-id>.r2.cloudflarestorage.com
   * AWS S3: https://s3.<region>.amazonaws.com
   * Local MinIO: http://localhost:9000
   *
   * Optional: backend boots without it. Required only when generating presigned upload
   * URLs. ImageService returns a 503 when this and related S3 vars are not configured.
   */
  S3_BUCKET_URL: z.string().url().optional(),

  /**
   * S3 / R2 access key ID for API authentication.
   * For Cloudflare R2: obtain from R2 API Tokens page in the Cloudflare dashboard.
   * For AWS S3: IAM access key with s3:PutObject permission on the bucket.
   *
   * Optional (see S3_BUCKET_URL note above).
   */
  S3_ACCESS_KEY_ID: z.string().optional(),

  /**
   * S3 / R2 secret access key paired with S3_ACCESS_KEY_ID.
   * Never logged or returned in any API response.
   *
   * Optional (see S3_BUCKET_URL note above).
   */
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  /**
   * AWS region for the bucket. Defaults to "auto" which is the correct value
   * for Cloudflare R2 (R2 is region-agnostic). For AWS S3, set to the bucket's
   * region (e.g., "us-east-1", "ap-south-1").
   */
  S3_REGION: z.string().default("auto"),

  /**
   * S3 bucket name used for all product image uploads.
   * For R2: the bucket name created in the Cloudflare dashboard.
   *
   * Optional (see S3_BUCKET_URL note above).
   */
  S3_BUCKET_NAME: z.string().optional(),

  /**
   * Public CDN base URL for images served to the storefront (D-10).
   * Cloudflare R2: https://<bucket-name>.<subdomain>.r2.dev (or custom domain)
   * AWS S3: https://<bucket-name>.s3.<region>.amazonaws.com
   *
   * The final image URL stored in product_images.url is constructed as:
   *   `${S3_PUBLIC_URL}/${key}`
   *
   * Optional (see S3_BUCKET_URL note above).
   */
  S3_PUBLIC_URL: z.string().url().optional(),

  // ---------------------------------------------------------------------------
  // Image upload constraints (Phase 3, D-11)
  // ---------------------------------------------------------------------------

  /**
   * Maximum number of images allowed per product.
   * Enforced at presigned URL generation time — if the product already has
   * MAX_IMAGES_PER_PRODUCT images, the presign request is rejected (429).
   * Defaults to 8.
   */
  MAX_IMAGES_PER_PRODUCT: z.coerce.number().default(8),

  /**
   * Maximum allowed image file size in bytes.
   * Passed as ContentLength on the PutObjectCommand so R2/S3 rejects oversized
   * PUT requests at the storage layer without proxying through the backend.
   * Defaults to 5242880 (5MB).
   */
  MAX_IMAGE_SIZE_BYTES: z.coerce.number().default(5242880),

  // ---------------------------------------------------------------------------
  // Filter schema cache TTL (Phase 3, SRCH-02)
  // ---------------------------------------------------------------------------

  /**
   * Redis TTL in seconds for the cached category filter schema
   * (the "category_filter_schema:{categoryId}" key).
   * Controls how quickly filter schema changes propagate after admin edits.
   * Defaults to 300 seconds (5 minutes).
   *
   * Note: FilterSchemaService uses write-through invalidation — replaceFilterSchema()
   * calls redis.del(`category_filter_schema:${categoryId}`) after the DB write.
   * This TTL is therefore a safety net, not the primary propagation mechanism.
   */
  FILTER_SCHEMA_TTL_SECONDS: z.coerce.number().default(300),

  // ---------------------------------------------------------------------------
  // Phase 4 — Customer Storefront vars
  // ---------------------------------------------------------------------------

  /**
   * Allowed CORS origin for the customer storefront (D-09 httpOnly cookie flow).
   * Must be the exact storefront origin — never "*" — because credentials: true
   * requires a specific origin when cookies are included in cross-origin requests.
   * Consumed by @fastify/cors with `credentials: true` (registered in Plan 04-04).
   * Defaults to http://localhost:5173 (Vite dev server default).
   */
  STOREFRONT_ORIGIN: z.string().url().default("http://localhost:5173"),

  /**
   * Nodemailer SMTP host for transactional email (e.g. smtp.gmail.com).
   * Required by brief: Google SMTP for all transactional email (password reset,
   * order/payout updates). Optional — API boots without it; CustomerAuthService
   * logs the reset link to console when SMTP is not configured (dev fallback).
   */
  SMTP_HOST: z.string().optional(),

  /**
   * Nodemailer SMTP user — the Google account email used for authentication.
   * Optional (see SMTP_HOST note above).
   */
  SMTP_USER: z.string().optional(),

  /**
   * Nodemailer SMTP app password — the Google app-specific password.
   * Never log or return this value. Optional (see SMTP_HOST note above).
   *
   * Generate: Google Account → Security → 2-Step Verification → App passwords.
   */
  SMTP_PASS: z.string().optional(),

  /**
   * From address shown on all transactional emails sent by the platform.
   * Example: "Grovio <noreply@example.com>"
   * Optional (see SMTP_HOST note above).
   */
  SMTP_FROM: z.string().optional(),

  /**
   * Redis TTL in seconds for the homepage blocks cache ("homepage:blocks" key).
   * Controls how quickly homepage content changes propagate after admin edits.
   * Defaults to 300 seconds (5 minutes).
   *
   * Note: HomepageService uses write-through invalidation — admin mutations
   * (Phase 6) call invalidateBlocks() after the DB write. This TTL is a safety
   * net, not the primary propagation mechanism (consistent with CATEGORY_TREE_TTL_SECONDS).
   */
  HOMEPAGE_BLOCKS_TTL_SECONDS: z.coerce.number().default(300),

  // ---------------------------------------------------------------------------
  // Phase 5 — Commerce Core: Payment Provider credentials (all optional)
  // API boots without these; payment routes return 503 when provider not configured.
  // PAY-02: buyers enable one or both providers via configuration.
  // ---------------------------------------------------------------------------

  /**
   * Stripe secret key for server-side Stripe API calls (PaymentIntents, refunds).
   * Obtain: dashboard.stripe.com → Developers → API Keys.
   * Use test mode keys (sk_test_...) for development and staging.
   * Optional: API boots without it; Stripe routes return 503 when absent.
   */
  STRIPE_SECRET_KEY: z.string().optional(),

  /**
   * Stripe publishable key — sent to the storefront for Stripe.js / Elements init.
   * Obtain: dashboard.stripe.com → Developers → API Keys (Publishable key).
   * Optional (see STRIPE_SECRET_KEY note above).
   */
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  /**
   * Stripe webhook signing secret for constructEvent() signature verification (PAY-03, D-10).
   * Obtain: dashboard.stripe.com → Developers → Webhooks → endpoint → Signing secret.
   * For local dev: `stripe listen --forward-to localhost:3001/webhooks/stripe`
   * Optional (see STRIPE_SECRET_KEY note above).
   */
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  /**
   * Razorpay key ID for API authentication and checkout modal initialization.
   * Obtain: dashboard.razorpay.com → Settings → API Keys → Generate Key.
   * Use test mode keys (rzp_test_...) for development.
   * Optional: API boots without it; Razorpay routes return 503 when absent.
   */
  RAZORPAY_KEY_ID: z.string().optional(),

  /**
   * Razorpay key secret for order creation and webhook HMAC verification (PAY-03, D-10).
   * Never expose to the frontend. Pairs with RAZORPAY_KEY_ID.
   * Optional (see RAZORPAY_KEY_ID note above).
   */
  RAZORPAY_KEY_SECRET: z.string().optional(),

  /**
   * Razorpay webhook secret for HMAC-SHA256 signature verification (PAY-03, D-10).
   * Obtain: dashboard.razorpay.com → Settings → Webhooks → endpoint → Secret.
   * Optional (see RAZORPAY_KEY_ID note above).
   */
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  /**
   * Inventory reservation TTL in minutes (D-07).
   * BullMQ ReleaseReservationJob fires after this delay to return reserved stock
   * to quantity_available if payment has not been received.
   * Default: 15 minutes. Consistent with CONTEXT.md D-07.
   */
  RESERVATION_TTL_MINUTES: z.coerce.number().default(15),
});

/** TypeScript type inferred from envSchema */
export type Env = z.infer<typeof envSchema>;

/**
 * Parsed and validated environment configuration.
 * Throws a ZodError at module load time if any variable is missing or invalid.
 * Import this object instead of reading process.env directly.
 */
export const env: Env = envSchema.parse(process.env);
