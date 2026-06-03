-- Fix migration: create feature_flags table that was missing from previous migrations.
-- The table was defined in the Drizzle schema (apps/api/src/db/schema/feature-flags.ts)
-- and included in snapshots, but the CREATE TABLE SQL was never applied to the live database.
-- This migration creates it idempotently using IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"key" text NOT NULL UNIQUE,
	"value" text NOT NULL,
	"description" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
