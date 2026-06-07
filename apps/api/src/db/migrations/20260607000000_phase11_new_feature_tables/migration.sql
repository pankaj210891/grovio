-- Phase 11, Plan 11-05: New feature backend tables
-- wishlists, product_reviews, customer_notifications, customer_notification_preferences,
-- customer_product_views, support_tickets, support_ticket_replies, search_query_log
-- + avg_rating, review_count, sold_count columns on products table

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "customer_notification_type" AS ENUM (
  'order_update',
  'price_drop',
  'return_update',
  'promotion'
);

CREATE TYPE "support_ticket_status" AS ENUM (
  'open',
  'in_progress',
  'resolved',
  'closed'
);

-- ─── wishlists ───────────────────────────────────────────────────────────────

CREATE TABLE "wishlists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "price_at_wishlist_minor" bigint NOT NULL DEFAULT 0,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "wishlists_customer_product_unique" UNIQUE ("customer_id", "product_id")
);

-- ─── product_reviews ─────────────────────────────────────────────────────────

CREATE TABLE "product_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "rating" smallint NOT NULL,
  "title" text,
  "body" text NOT NULL,
  "verified_purchase" boolean NOT NULL DEFAULT false,
  "vendor_reply" text,
  "vendor_replied_at" timestamptz,
  "moderated" boolean NOT NULL DEFAULT false,
  "moderated_by_admin_email" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "product_reviews_customer_product_unique" UNIQUE ("customer_id", "product_id"),
  CONSTRAINT "product_reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5)
);

-- ─── customer_notifications ──────────────────────────────────────────────────

CREATE TABLE "customer_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "type" "customer_notification_type" NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "reference_id" text,
  "reference_type" text,
  "dismissed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

-- ─── customer_notification_preferences ───────────────────────────────────────

CREATE TABLE "customer_notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL UNIQUE REFERENCES "customers"("id") ON DELETE CASCADE,
  "order_updates" boolean NOT NULL DEFAULT true,
  "price_drops" boolean NOT NULL DEFAULT true,
  "promotions" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

-- ─── customer_product_views ──────────────────────────────────────────────────

CREATE TABLE "customer_product_views" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "viewed_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "customer_product_views_customer_time_idx"
  ON "customer_product_views" ("customer_id", "viewed_at");

CREATE INDEX "customer_product_views_product_time_idx"
  ON "customer_product_views" ("product_id", "viewed_at");

-- ─── support_tickets ─────────────────────────────────────────────────────────

CREATE TABLE "support_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submitted_by_type" text NOT NULL,
  "submitted_by_id" uuid NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "status" "support_ticket_status" NOT NULL DEFAULT 'open',
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

-- ─── support_ticket_replies ──────────────────────────────────────────────────

CREATE TABLE "support_ticket_replies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
  "reply_by_type" text NOT NULL,
  "reply_by_id" uuid NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

-- ─── search_query_log ────────────────────────────────────────────────────────

CREATE TABLE "search_query_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "query" text NOT NULL,
  "customer_id" uuid,
  "searched_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "search_query_log_searched_at_idx"
  ON "search_query_log" ("searched_at");

CREATE INDEX "search_query_log_query_idx"
  ON "search_query_log" ("query");

-- ─── products table: add cached aggregate columns ─────────────────────────────

ALTER TABLE "products"
  ADD COLUMN "avg_rating" double precision NOT NULL DEFAULT 0,
  ADD COLUMN "review_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN "sold_count" integer NOT NULL DEFAULT 0;
