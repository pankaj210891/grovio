CREATE TYPE "order_status" AS ENUM('pending_payment', 'payment_received', 'processing', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "wallet_entry_type" AS ENUM('credit', 'debit', 'refund_credit');--> statement-breakpoint
CREATE TYPE "payment_provider" AS ENUM('stripe', 'razorpay');--> statement-breakpoint
CREATE TYPE "commission_status" AS ENUM('earned', 'reversed', 'net');--> statement-breakpoint
CREATE TYPE "return_status" AS ENUM('return_requested', 'approved', 'rejected', 'refunded');--> statement-breakpoint
CREATE TABLE "basket_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"customer_id" uuid,
	"guest_token" text UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "basket_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"basket_session_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_variant_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"product_variant_id" uuid,
	"product_id" uuid,
	"quantity_available" integer DEFAULT 0 NOT NULL,
	"quantity_reserved" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"basket_session_id" uuid,
	"customer_id" uuid,
	"inventory_item_id" uuid NOT NULL,
	"order_id" uuid,
	"quantity" integer NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"display_id" text NOT NULL UNIQUE,
	"customer_id" uuid NOT NULL,
	"address_id" uuid,
	"status" "order_status" DEFAULT 'pending_payment'::"order_status" NOT NULL,
	"subtotal_minor" bigint NOT NULL,
	"shipping_minor" bigint DEFAULT 0 NOT NULL,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"wallet_applied_minor" bigint DEFAULT 0 NOT NULL,
	"grand_total_minor" bigint NOT NULL,
	"coupon_code" text,
	"payment_provider" text,
	"provider_order_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'payment_received'::"order_status" NOT NULL,
	"vendor_subtotal_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"vendor_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_variant_id" uuid,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"line_subtotal_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"customer_id" uuid NOT NULL,
	"entry_type" "wallet_entry_type" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"idempotency_key" text NOT NULL UNIQUE,
	"reference_id" text,
	"reference_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"provider" "payment_provider" NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_events_provider_event_uniq" UNIQUE("provider","provider_event_id")
);
--> statement-breakpoint
CREATE TABLE "commission_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"scope" text NOT NULL,
	"vendor_id" uuid,
	"category_id" uuid,
	"rate_percent" numeric(5,2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_commission_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"vendor_order_id" uuid NOT NULL,
	"rate_percent" numeric(5,2) NOT NULL,
	"order_subtotal_minor" bigint NOT NULL,
	"commission_amount_minor" bigint NOT NULL,
	"status" "commission_status" DEFAULT 'earned'::"commission_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL UNIQUE,
	"discount_type" text NOT NULL,
	"discount_value" bigint NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" uuid,
	"min_order_minor" bigint DEFAULT 0 NOT NULL,
	"max_redemptions" integer,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"vendor_order_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_item_ids" jsonb NOT NULL,
	"reason" text NOT NULL,
	"refund_preference" text NOT NULL,
	"status" "return_status" DEFAULT 'return_requested'::"return_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_return_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"vendor_id" uuid NOT NULL UNIQUE,
	"return_window_days" integer DEFAULT 7 NOT NULL,
	"conditions" text,
	"is_returnable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "wallet_balance_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "basket_sessions" ADD CONSTRAINT "basket_sessions_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "basket_items" ADD CONSTRAINT "basket_items_basket_session_id_basket_sessions_id_fkey" FOREIGN KEY ("basket_session_id") REFERENCES "basket_sessions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "basket_items" ADD CONSTRAINT "basket_items_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "basket_items" ADD CONSTRAINT "basket_items_product_variant_id_product_variants_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_product_variant_id_product_variants_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_OHkouqnpwMNB_fkey" FOREIGN KEY ("basket_session_id") REFERENCES "basket_sessions"("id");--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id");--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_UGQwDJNi4QN3_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_customer_addresses_id_fkey" FOREIGN KEY ("address_id") REFERENCES "customer_addresses"("id");--> statement-breakpoint
ALTER TABLE "vendor_orders" ADD CONSTRAINT "vendor_orders_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "vendor_orders" ADD CONSTRAINT "vendor_orders_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_vendor_order_id_vendor_orders_id_fkey" FOREIGN KEY ("vendor_order_id") REFERENCES "vendor_orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_variant_id_product_variants_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id");--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id");--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id");--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id");--> statement-breakpoint
ALTER TABLE "vendor_commission_entries" ADD CONSTRAINT "vendor_commission_entries_vendor_order_id_vendor_orders_id_fkey" FOREIGN KEY ("vendor_order_id") REFERENCES "vendor_orders"("id");--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_vendor_order_id_vendor_orders_id_fkey" FOREIGN KEY ("vendor_order_id") REFERENCES "vendor_orders"("id");--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id");--> statement-breakpoint
ALTER TABLE "vendor_return_policies" ADD CONSTRAINT "vendor_return_policies_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id");