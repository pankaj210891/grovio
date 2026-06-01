-- Phase 2 Category Engine Migration
-- Generated from Drizzle ORM schema (apps/api/src/db/schema/)
-- Tables: categories, attribute_definitions, filter_schema_definitions,
--         product_templates, vendor_category_restrictions, category_metadata
-- Enums: attr_type, filter_display_type

--> statement-breakpoint

-- ── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE "public"."attr_type" AS ENUM(
  'text',
  'textarea',
  'number',
  'boolean',
  'enum',
  'multi_select'
);
--> statement-breakpoint

CREATE TYPE "public"."filter_display_type" AS ENUM(
  'checkbox',
  'radio',
  'range_slider',
  'toggle'
);
--> statement-breakpoint

-- ── categories ─────────────────────────────────────────────────────────────
-- Adjacency list for 3-level category taxonomy (D-01, D-02).
-- parentId self-referential FK with ON DELETE RESTRICT prevents orphan subtrees (T-02-04).
-- archivedAt soft-delete: null = active; non-null = archived (FK safety for Phase 3+).

CREATE TABLE IF NOT EXISTS "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "parent_id" uuid,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_restricted" boolean NOT NULL DEFAULT false,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_parent_id_categories_id_fk"
  FOREIGN KEY ("parent_id")
  REFERENCES "public"."categories"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint

-- ── attribute_definitions ──────────────────────────────────────────────────
-- Per-category attribute schema registry. JSONB + schema registry pattern
-- (NOT EAV — Anti-Pattern 3 / Pitfall 8 from ARCHITECTURE.md).
-- attr_type constrained at DB level by pgEnum (T-02-03).
-- Composite unique (category_id, key) prevents duplicate attribute keys per category.

CREATE TABLE IF NOT EXISTS "attribute_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" uuid NOT NULL,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "attr_type" "attr_type" NOT NULL,
  "options" jsonb,
  "is_required" boolean NOT NULL DEFAULT false,
  "is_filterable" boolean NOT NULL DEFAULT false,
  "is_searchable" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "attribute_definitions"
  ADD CONSTRAINT "attribute_definitions_category_id_categories_id_fk"
  FOREIGN KEY ("category_id")
  REFERENCES "public"."categories"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "attribute_definitions"
  ADD CONSTRAINT "attribute_definitions_category_id_key_unique"
  UNIQUE ("category_id", "key");
--> statement-breakpoint

-- ── filter_schema_definitions ──────────────────────────────────────────────
-- Maps attribute definitions to storefront filter widgets (CAT-04).
-- display_type constrained at DB level by pgEnum (T-02-03).
-- Composite unique (category_id, attribute_def_id) prevents duplicate filter entries.

CREATE TABLE IF NOT EXISTS "filter_schema_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" uuid NOT NULL,
  "attribute_def_id" uuid NOT NULL,
  "display_type" "filter_display_type" NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "filter_schema_definitions"
  ADD CONSTRAINT "filter_schema_definitions_category_id_categories_id_fk"
  FOREIGN KEY ("category_id")
  REFERENCES "public"."categories"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "filter_schema_definitions"
  ADD CONSTRAINT "filter_schema_definitions_attribute_def_id_attribute_definitions_id_fk"
  FOREIGN KEY ("attribute_def_id")
  REFERENCES "public"."attribute_definitions"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "filter_schema_definitions"
  ADD CONSTRAINT "filter_schema_definitions_category_id_attribute_def_id_unique"
  UNIQUE ("category_id", "attribute_def_id");
--> statement-breakpoint

-- ── product_templates ──────────────────────────────────────────────────────
-- One product template per category (UNIQUE on category_id).
-- templateFields uses attribute key (text) not UUID — survives attribute delete+recreate.

CREATE TABLE IF NOT EXISTS "product_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" uuid NOT NULL,
  "template_fields" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_templates_category_id_unique" UNIQUE("category_id")
);
--> statement-breakpoint

ALTER TABLE "product_templates"
  ADD CONSTRAINT "product_templates_category_id_categories_id_fk"
  FOREIGN KEY ("category_id")
  REFERENCES "public"."categories"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

-- ── vendor_category_restrictions ───────────────────────────────────────────
-- Records which vendors are approved for restricted categories (D-10).
-- vendorId and createdByAdminId are uuid WITHOUT FK (deferred: vendors/users tables
-- don't exist until Phase 3/4 respectively — T-02-05, Pitfall 6).
-- FK constraints will be added in Phase 3 and Phase 4 migrations.

CREATE TABLE IF NOT EXISTS "vendor_category_restrictions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" uuid NOT NULL,
  "vendor_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by_admin_id" uuid NOT NULL
);
--> statement-breakpoint

ALTER TABLE "vendor_category_restrictions"
  ADD CONSTRAINT "vendor_category_restrictions_category_id_categories_id_fk"
  FOREIGN KEY ("category_id")
  REFERENCES "public"."categories"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "vendor_category_restrictions"
  ADD CONSTRAINT "vendor_category_restrictions_category_id_vendor_id_unique"
  UNIQUE ("category_id", "vendor_id");
--> statement-breakpoint

-- ── category_metadata ──────────────────────────────────────────────────────
-- One metadata row per category (UNIQUE on category_id).
-- Flat SEO columns per D-13; blocks JSONB array per D-12.
-- Lazy-created on first PUT /admin/categories/:id/metadata.

CREATE TABLE IF NOT EXISTS "category_metadata" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" uuid NOT NULL,
  "seo_title" text,
  "seo_description" text,
  "seo_keywords" text,
  "canonical_url" text,
  "blocks" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "description" text,
  "image_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "category_metadata_category_id_unique" UNIQUE("category_id")
);
--> statement-breakpoint

ALTER TABLE "category_metadata"
  ADD CONSTRAINT "category_metadata_category_id_categories_id_fk"
  FOREIGN KEY ("category_id")
  REFERENCES "public"."categories"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
