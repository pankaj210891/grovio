ALTER TABLE "products" ADD COLUMN "avg_rating" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "review_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sold_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "return_requests" ADD COLUMN "rejection_reason" text;