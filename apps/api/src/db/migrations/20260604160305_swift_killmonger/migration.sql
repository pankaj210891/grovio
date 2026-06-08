DO $$ BEGIN
  CREATE TYPE "vendor_onboarding_status" AS ENUM('pending', 'approved', 'suspended');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "vendor_user_role" AS ENUM('owner', 'manager', 'staff');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"vendor_id" uuid NOT NULL,
	"email" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"role" "vendor_user_role" NOT NULL,
	"invited_by" uuid,
	"accepted_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_staff_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"vendor_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "vendor_user_role" NOT NULL,
	"invite_token" text NOT NULL UNIQUE,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_payout_info" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"vendor_id" uuid NOT NULL UNIQUE,
	"account_holder_name" text NOT NULL,
	"bank_account_number" text NOT NULL,
	"ifsc_or_routing_code" text NOT NULL,
	"bank_name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"vendor_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"settlement_reference" text NOT NULL,
	"note" text,
	"settled_by_admin_email" text NOT NULL,
	"settled_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketplace_settings" (
	"key" text PRIMARY KEY,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "store_name" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "store_description" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "logo_url" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "banner_url" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "contact_email" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "contact_phone" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "address" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "onboarding_status" "vendor_onboarding_status" DEFAULT 'approved'::"vendor_onboarding_status" NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "created_by_type" text;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "created_by_id" text;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vendor_users" ADD CONSTRAINT "vendor_users_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vendor_staff_invites" ADD CONSTRAINT "vendor_staff_invites_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vendor_payout_info" ADD CONSTRAINT "vendor_payout_info_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vendor_payouts" ADD CONSTRAINT "vendor_payouts_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;
