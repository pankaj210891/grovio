# Phase 5: Commerce Core - Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 47 new/modified files
**Analogs found:** 42 / 47

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/api/src/db/schema/basket-sessions.ts` | model | CRUD | `apps/api/src/db/schema/customers.ts` | role-match |
| `apps/api/src/db/schema/basket-items.ts` | model | CRUD | `apps/api/src/db/schema/customer-addresses.ts` | exact |
| `apps/api/src/db/schema/inventory-items.ts` | model | CRUD | `apps/api/src/db/schema/product-variants.ts` | exact |
| `apps/api/src/db/schema/inventory-reservations.ts` | model | CRUD | `apps/api/src/db/schema/customer-addresses.ts` | role-match |
| `apps/api/src/db/schema/orders.ts` | model | CRUD | `apps/api/src/db/schema/products.ts` | exact |
| `apps/api/src/db/schema/vendor-orders.ts` | model | CRUD | `apps/api/src/db/schema/products.ts` | role-match |
| `apps/api/src/db/schema/order-items.ts` | model | CRUD | `apps/api/src/db/schema/product-variants.ts` | role-match |
| `apps/api/src/db/schema/wallet-entries.ts` | model | CRUD | `apps/api/src/db/schema/customers.ts` | role-match |
| `apps/api/src/db/schema/payment-events.ts` | model | event-driven | `apps/api/src/db/schema/customers.ts` | role-match |
| `apps/api/src/db/schema/vendor-commission-entries.ts` | model | CRUD | `apps/api/src/db/schema/products.ts` | role-match |
| `apps/api/src/db/schema/commission-rules.ts` | model | CRUD | `apps/api/src/db/schema/feature-flags.ts` | role-match |
| `apps/api/src/db/schema/coupons.ts` | model | CRUD | `apps/api/src/db/schema/feature-flags.ts` | role-match |
| `apps/api/src/db/schema/return-requests.ts` | model | CRUD | `apps/api/src/db/schema/products.ts` | role-match |
| `apps/api/src/db/schema/vendor-return-policies.ts` | model | CRUD | `apps/api/src/db/schema/customer-addresses.ts` | role-match |
| `apps/api/src/modules/basket/BasketService.ts` | service | CRUD | `apps/api/src/modules/customer-auth/CustomerAuthService.ts` | exact |
| `apps/api/src/modules/inventory/InventoryService.ts` | service | CRUD | `apps/api/src/modules/catalog/ProductService.ts` | role-match |
| `apps/api/src/modules/checkout/CheckoutService.ts` | service | request-response | `apps/api/src/modules/catalog/ProductService.ts` | role-match |
| `apps/api/src/modules/payments/PaymentProvider.ts` | utility | request-response | no analog | none |
| `apps/api/src/modules/payments/StripeAdapter.ts` | service | request-response | no analog | none |
| `apps/api/src/modules/payments/RazorpayAdapter.ts` | service | request-response | no analog | none |
| `apps/api/src/modules/payments/PaymentService.ts` | service | request-response | `apps/api/src/modules/catalog/ProductService.ts` | role-match |
| `apps/api/src/modules/wallet/WalletService.ts` | service | CRUD | `apps/api/src/modules/customer-auth/CustomerAuthService.ts` | role-match |
| `apps/api/src/modules/orders/OrderService.ts` | service | CRUD | `apps/api/src/modules/catalog/ProductService.ts` | exact |
| `apps/api/src/modules/commissions/CommissionService.ts` | service | transform | `apps/api/src/modules/feature-flags/FeatureFlagService.ts` | role-match |
| `apps/api/src/modules/coupons/CouponService.ts` | service | CRUD | `apps/api/src/modules/feature-flags/FeatureFlagService.ts` | exact |
| `apps/api/src/modules/returns/ReturnService.ts` | service | CRUD | `apps/api/src/modules/catalog/ProductService.ts` | role-match |
| `apps/api/src/modules/jobs/release-reservation-job.ts` | utility | event-driven | `apps/api/src/modules/jobs/product-index-job.ts` | exact |
| `apps/api/src/modules/jobs/basket-expiry-job.ts` | utility | event-driven | `apps/api/src/modules/jobs/product-index-job.ts` | exact |
| `apps/api/src/modules/jobs/queues.ts` (updated) | config | event-driven | `apps/api/src/modules/jobs/queues.ts` | exact |
| `apps/api/src/modules/jobs/workers.ts` (updated) | config | event-driven | `apps/api/src/modules/jobs/workers.ts` | exact |
| `apps/api/src/routes/basket.ts` | route | CRUD | `apps/api/src/routes/account/addresses.ts` | exact |
| `apps/api/src/routes/checkout.ts` | route | request-response | `apps/api/src/routes/account/addresses.ts` | role-match |
| `apps/api/src/routes/webhooks/stripe.ts` | route | event-driven | `apps/api/src/routes/account/profile.ts` | partial |
| `apps/api/src/routes/webhooks/razorpay.ts` | route | event-driven | `apps/api/src/routes/account/profile.ts` | partial |
| `apps/api/src/routes/account/orders.ts` | route | CRUD | `apps/api/src/routes/account/addresses.ts` | exact |
| `apps/api/src/routes/account/wallet.ts` | route | CRUD | `apps/api/src/routes/account/profile.ts` | exact |
| `apps/api/src/routes/vendor/orders.ts` | route | CRUD | `apps/api/src/routes/account/addresses.ts` | role-match |
| `apps/api/src/container.ts` (updated) | config | — | `apps/api/src/container.ts` | exact |
| `packages/contracts/src/basket/types.ts` | utility | request-response | `packages/contracts/src/catalog/product.ts` | exact |
| `packages/contracts/src/orders/types.ts` | utility | request-response | `packages/contracts/src/catalog/product.ts` | exact |
| `packages/contracts/src/wallet/types.ts` | utility | request-response | `packages/contracts/src/catalog/product.ts` | role-match |
| `packages/contracts/src/payments/types.ts` | utility | request-response | `packages/contracts/src/auth.ts` | role-match |
| `apps/web-storefront/src/hooks/useBasket.ts` | hook | CRUD | `apps/web-storefront/src/hooks/useAuth.ts` | exact |
| `apps/web-storefront/src/hooks/useWallet.ts` | hook | CRUD | `apps/web-storefront/src/hooks/useProductSearch.ts` | role-match |
| `apps/web-storefront/src/pages/CartPage.tsx` | component | request-response | `apps/web-storefront/src/pages/account/AddressesPage.tsx` | exact |
| `apps/web-storefront/src/pages/checkout/*.tsx` | component | request-response | `apps/web-storefront/src/pages/account/AddressesPage.tsx` | role-match |
| `apps/web-storefront/src/pages/account/OrdersPage.tsx` | component | CRUD | `apps/web-storefront/src/pages/account/AddressesPage.tsx` | exact |

---

## Pattern Assignments

### `apps/api/src/db/schema/basket-sessions.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/customers.ts`

**Imports pattern** (lines 1-1):
```typescript
import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customers.js";
```

**Core table pattern** (lines 20-59, from `customers.ts`):
```typescript
export const basketSessions = pgTable("basket_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * Nullable FK to customer — null means guest basket.
   * On login merge, guest basket's customerId is set and guest token cleared.
   */
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),

  /**
   * Guest basket token (random UUID, stored in httpOnly cookie grovio_basket_token).
   * null for authenticated customer baskets. Unique so cookie cannot collide.
   */
  guestToken: text("guest_token").unique(),

  /**
   * TTL field: basket sessions expire after 30 days (D-03).
   * BasketExpiryJob deletes rows where expiresAt < NOW().
   */
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertBasketSession = typeof basketSessions.$inferInsert;
export type SelectBasketSession = typeof basketSessions.$inferSelect;
```

**Key constraint:** One of `customerId` or `guestToken` must be non-null (enforced at service layer, not DB level — mirrors how `rejectionReason` in products.ts is service-enforced).

---

### `apps/api/src/db/schema/basket-items.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/customer-addresses.ts`

**Imports pattern** (lines 1-9, from `customer-addresses.ts`):
```typescript
import {
  bigint,
  integer,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { basketSessions } from "./basket-sessions.js";
import { products } from "./products.js";
import { productVariants } from "./product-variants.js";
```

**Core table pattern** (from `customer-addresses.ts` lines 29-94):
```typescript
export const basketItems = pgTable("basket_items", {
  id: uuid("id").defaultRandom().primaryKey(),

  basketSessionId: uuid("basket_session_id")
    .notNull()
    .references(() => basketSessions.id, { onDelete: "cascade" }),

  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),

  /**
   * Nullable FK to product_variants — null for variant-free products (D-20).
   * Exactly one of productVariantId or null is valid per row.
   */
  productVariantId: uuid("product_variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" }),

  /** Quantity requested. Min 1. */
  quantity: integer("quantity").notNull().default(1),

  /**
   * Price snapshot at time of add-to-basket (BIGINT minor units per D-01).
   * Re-validated at checkout time (CHK-04) — snapshot is for display only.
   */
  unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

---

### `apps/api/src/db/schema/inventory-items.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/product-variants.ts`

**Imports pattern** (lines 1-10, from `product-variants.ts`):
```typescript
import { bigint, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { products } from "./products.js";
import { productVariants } from "./product-variants.js";
```

**Core table pattern** (from `product-variants.ts` lines 31-75, adapted per D-20/D-21):
```typescript
export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to product_variants — non-null for variant products (D-20).
   * Exactly one of productVariantId or productId is non-null per row.
   */
  productVariantId: uuid("product_variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" }),

  /**
   * FK to products — non-null for variant-free products (D-20).
   * Exactly one of productId or productVariantId is non-null per row.
   */
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" }),

  /**
   * Available stock not currently reserved (D-21).
   * Atomically decremented by InventoryService.reserveItems() via SELECT FOR UPDATE.
   */
  quantityAvailable: integer("quantity_available").notNull().default(0),

  /**
   * Stock currently held by active checkout reservations (D-21).
   * Incremented when reserved; decremented on payment success or reservation expiry.
   */
  quantityReserved: integer("quantity_reserved").notNull().default(0),

  /** Low-stock threshold for vendor warnings. Optional. */
  lowStockThreshold: integer("low_stock_threshold"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

---

### `apps/api/src/db/schema/orders.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/products.ts`

**Imports pattern** (lines 1-11, from `products.ts`):
```typescript
import {
  bigint,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./customers.js";
import { customerAddresses } from "./customer-addresses.js";
```

**pgEnum pattern** (lines 26-31, from `products.ts` — copy for order states):
```typescript
export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment",
  "payment_received",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);
```

**Core BIGINT money column pattern** (lines 100-101, from `products.ts`):
```typescript
// All monetary columns follow this exact BIGINT minor-unit pattern:
subtotalMinor: bigint("subtotal_minor", { mode: "number" }).notNull(),
shippingMinor: bigint("shipping_minor", { mode: "number" }).notNull().default(0),
discountMinor: bigint("discount_minor", { mode: "number" }).notNull().default(0),
walletAppliedMinor: bigint("wallet_applied_minor", { mode: "number" }).notNull().default(0),
grandTotalMinor: bigint("grand_total_minor", { mode: "number" }).notNull(),
```

**displayId pattern** — follow `products.slug` (line 79, `products.ts`): unique, text column, index:
```typescript
displayId: text("display_id").notNull().unique(), // e.g. "ORD-20240601-A3F9"
```

**Full type exports** (lines 154-157, from `products.ts`):
```typescript
export type InsertOrder = typeof orders.$inferInsert;
export type SelectOrder = typeof orders.$inferSelect;
```

---

### `apps/api/src/db/schema/wallet-entries.ts` (model, CRUD — append-only)

**Analog:** `apps/api/src/db/schema/customers.ts`

**Append-only + idempotency key pattern** (from RESEARCH.md Pattern 7):
```typescript
import { bigint, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customers.js";

export const walletEntryTypeEnum = pgEnum("wallet_entry_type", [
  "credit",
  "debit",
  "refund_credit",
]);

export const walletEntries = pgTable("wallet_entries", {
  id: uuid("id").defaultRandom().primaryKey(),

  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),

  entryType: walletEntryTypeEnum("entry_type").notNull(),

  /**
   * BIGINT minor units (paise/cents) per D-01.
   * Positive for credits; positive for debits (entry_type distinguishes direction).
   */
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),

  /**
   * Unique key for idempotent writes (WAL-03).
   * Pattern: "order:{orderId}:wallet-debit" or "return:{returnId}:refund-credit"
   * Prevents double-spend in concurrent checkout sessions (Pitfall 3).
   */
  idempotencyKey: text("idempotency_key").notNull().unique(),

  /** FK to the triggering order, return, or other reference. */
  referenceId: uuid("reference_id"),
  referenceType: text("reference_type"), // 'order' | 'return'

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
// NOTE: No updatedAt — append-only, rows are NEVER modified (WAL-03).
```

---

### `apps/api/src/db/schema/payment-events.ts` (model, event-driven)

**Analog:** `apps/api/src/db/schema/customers.ts`

**Idempotency unique constraint pattern** (from RESEARCH.md D-10 + Pattern 4):
```typescript
import { jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const paymentProviderEnum = pgEnum("payment_provider", ["stripe", "razorpay"]);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: paymentProviderEnum("provider").notNull(),
    /** Stripe event ID (e.g. "evt_xxx") or Razorpay event ID */
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    /** Full raw webhook payload for debugging (D-10 audit trail) */
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    /** D-10: unique on (provider, providerEventId) — prevents duplicate processing */
    unique("payment_events_provider_event_uniq").on(t.provider, t.providerEventId),
  ]
);
```

---

### `apps/api/src/db/schema/vendor-commission-entries.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/products.ts`

**Append-only status + BIGINT money pattern** (adapted from `products.ts` lines 86-101 + RESEARCH.md):
```typescript
import { bigint, numeric, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const commissionStatusEnum = pgEnum("commission_status", [
  "earned",
  "reversed",
  "net",
]);

export const vendorCommissionEntries = pgTable("vendor_commission_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  vendorOrderId: uuid("vendor_order_id").notNull().references(() => vendorOrders.id),
  ratePercent: numeric("rate_percent", { precision: 5, scale: 2 }).notNull(),
  orderSubtotalMinor: bigint("order_subtotal_minor", { mode: "number" }).notNull(),
  commissionAmountMinor: bigint("commission_amount_minor", { mode: "number" }).notNull(),
  status: commissionStatusEnum("status").notNull().default("earned"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
// NOTE: No updatedAt — append-only pattern (same as wallet_entries).
```

---

### `apps/api/src/modules/basket/BasketService.ts` (service, CRUD)

**Analog:** `apps/api/src/modules/customer-auth/CustomerAuthService.ts`

**Imports pattern** (lines 1-13, from `CustomerAuthService.ts`):
```typescript
import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import {
  basketSessions,
  basketItems,
  inventoryItems,
  customers,
  type SelectBasketSession,
  type SelectBasketItem,
} from "../../db/schema/index.js";
```

**Domain error class pattern** (lines 23-30, from `CustomerAuthService.ts`):
```typescript
export class BasketNotFoundError extends Error {
  readonly code = "BASKET_NOT_FOUND";
  constructor(message = "Basket session not found or expired.") {
    super(message);
    this.name = "BasketNotFoundError";
  }
}

export class InsufficientStockError extends Error {
  readonly code = "INSUFFICIENT_STOCK";
  constructor(public readonly itemId: string) {
    super(`Insufficient stock for item ${itemId}`);
    this.name = "InsufficientStockError";
  }
}
```

**Deps interface pattern** (lines 67-73, from `CustomerAuthService.ts`):
```typescript
interface BasketServiceDeps {
  db: NodePgDatabase<any>;
  redis: Redis; // for basket TTL cache if needed
  env: Env;
}

export class BasketService {
  constructor(private deps: BasketServiceDeps) {}
  // ... methods
}
```

**DB query pattern** (lines 196-200, from `CustomerAuthService.ts`):
```typescript
const rows = await db
  .select()
  .from(basketSessions)
  .where(eq(basketSessions.guestToken, guestToken))
  .limit(1);
const session = rows[0];
if (!session) throw new BasketNotFoundError();
```

---

### `apps/api/src/modules/inventory/InventoryService.ts` (service, CRUD)

**Analog:** `apps/api/src/modules/catalog/ProductService.ts`

**Imports pattern** (lines 1-4, from `ProductService.ts`):
```typescript
import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Queue } from "bullmq";
import { inventoryItems, inventoryReservations } from "../../db/schema/index.js";
```

**SELECT FOR UPDATE transaction pattern** (from RESEARCH.md Pattern 2 — no existing analog, copy from research):
```typescript
async reserveItems(params: {
  basketId: string;
  customerId: string;
  items: Array<{ inventoryItemId: string; quantity: number }>;
}): Promise<string[]> {
  const reservationIds: string[] = [];

  for (const item of params.items) {
    await this.deps.db.transaction(async (tx) => {
      const [invRow] = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, item.inventoryItemId))
        .for('update'); // Row-level lock — Drizzle community pattern (Pitfall 2)

      if (!invRow || invRow.quantityAvailable < item.quantity) {
        throw new InsufficientStockError(item.inventoryItemId);
      }

      await tx.update(inventoryItems)
        .set({
          quantityAvailable: invRow.quantityAvailable - item.quantity,
          quantityReserved: invRow.quantityReserved + item.quantity,
        })
        .where(eq(inventoryItems.id, item.inventoryItemId));

      const [reservation] = await tx.insert(inventoryReservations)
        .values({ /* ... */ })
        .returning({ id: inventoryReservations.id });

      reservationIds.push(reservation.id);
    });
  }

  // Enqueue expiry jobs AFTER all transactions commit
  for (const reservationId of reservationIds) {
    await this.deps.reservationQueue.add(
      'release-reservation',
      { reservationId },
      {
        jobId: `release-reservation:${reservationId}`, // deterministic — prevents duplicates
        delay: 15 * 60 * 1000,
        removeOnComplete: true,
        removeOnFail: { count: 3 },
      }
    );
  }

  return reservationIds;
}
```

---

### `apps/api/src/modules/payments/PaymentProvider.ts` (utility, request-response)

**No existing analog in the codebase.** Use the interface definition from RESEARCH.md Pattern 1 directly:

```typescript
// apps/api/src/modules/payments/PaymentProvider.ts
export interface CreatePaymentOrderParams {
  amountMinor: bigint;
  currency: string;
  orderId: string;
  customerId: string;
  description?: string;
}

export interface ProviderPaymentOrder {
  providerOrderId: string;
  clientSecret: string | null;   // Stripe: PaymentIntent client_secret
  providerKey: string | null;    // Razorpay: key_id for checkout options
  providerOrderRef: string | null; // Razorpay: order_id
}

export interface WebhookEvent {
  type: 'PAYMENT_CAPTURED' | 'PAYMENT_FAILED' | 'REFUND_SUCCEEDED' | 'REFUND_FAILED';
  providerEventId: string;
  orderId: string;
  amountMinor: bigint;
  provider: 'stripe' | 'razorpay';
  rawPayload: unknown;
}

export interface PaymentProvider {
  createPaymentOrder(params: CreatePaymentOrderParams): Promise<ProviderPaymentOrder>;
  handleWebhook(rawBody: Buffer, signature: string): Promise<WebhookEvent>;
  initiateRefund(params: { providerOrderId: string; amountMinor: bigint }): Promise<void>;
}
```

**CRITICAL:** No other file in Phase 5 may import `stripe` or `razorpay` packages except `StripeAdapter.ts` and `RazorpayAdapter.ts` (PAY-01, Pitfall 9).

---

### `apps/api/src/modules/commissions/CommissionService.ts` (service, transform)

**Analog:** `apps/api/src/modules/feature-flags/FeatureFlagService.ts`

**Redis-first read pattern** (lines 39-58, from `FeatureFlagService.ts`):
```typescript
// Commission rate resolution mirrors feature flag lookup: Redis cache → DB fallback
async resolveRate(vendorId: string, categoryId: string): Promise<number> {
  const { db, redis, env } = this.deps;
  const cacheKey = `commission:vendor:${vendorId}:cat:${categoryId}`;

  const cached = await redis.get(cacheKey);
  if (cached !== null) return parseFloat(cached);

  // Priority chain: vendor > category > global (D-14)
  const vendorRate = await db.select()
    .from(commissionRules)
    .where(and(eq(commissionRules.vendorId, vendorId), isNull(commissionRules.categoryId)))
    .limit(1);
  if (vendorRate[0]) {
    await redis.setex(cacheKey, env.FEATURE_FLAG_TTL_SECONDS, vendorRate[0].ratePercent);
    return parseFloat(vendorRate[0].ratePercent);
  }
  // ... category fallback then global fallback
}
```

**allocate() usage pattern** (from RESEARCH.md Pattern 6):
```typescript
import { allocate } from "@grovio/contracts/money";

// BIGINT arithmetic via allocate() — no float multiplication for commissions (Pitfall 1)
const rateInt = Math.round(ratePercent); // e.g. 10 for 10%
const [commissionMinor, netVendorMinor] = allocate(
  BigInt(subtotalMinor),
  [rateInt, 100 - rateInt]
);
```

---

### `apps/api/src/modules/wallet/WalletService.ts` (service, CRUD)

**Analog:** `apps/api/src/modules/customer-auth/CustomerAuthService.ts`

**Append-only ledger write pattern** (from RESEARCH.md Pattern 7):
```typescript
async debitWallet(params: {
  customerId: string;
  amountMinor: bigint;
  orderId: string;
}): Promise<void> {
  const idempotencyKey = `order:${params.orderId}:wallet-debit`;

  await this.deps.db.transaction(async (tx) => {
    await tx.insert(walletEntries).values({
      customerId: params.customerId,
      entryType: 'debit',
      amountMinor: Number(params.amountMinor),
      idempotencyKey,
      referenceId: params.orderId,
      referenceType: 'order',
    });

    // Update cached balance column on customers row (WAL-01 fast read)
    await tx.update(customers)
      .set({ walletBalanceMinor: sql`${customers.walletBalanceMinor} - ${Number(params.amountMinor)}` })
      .where(eq(customers.id, params.customerId));
  });
}
```

**Domain error pattern** (lines 23-30 from `CustomerAuthService.ts`):
```typescript
export class InsufficientWalletBalanceError extends Error {
  readonly code = "INSUFFICIENT_WALLET_BALANCE";
  constructor(message = "Wallet balance is insufficient for this transaction.") {
    super(message);
    this.name = "InsufficientWalletBalanceError";
  }
}
```

---

### `apps/api/src/modules/coupons/CouponService.ts` (service, CRUD)

**Analog:** `apps/api/src/modules/feature-flags/FeatureFlagService.ts`

**Redis-first + feature flag check pattern** (lines 39-58, from `FeatureFlagService.ts`):
```typescript
interface CouponServiceDeps {
  db: NodePgDatabase<any>;
  redis: Redis;
  env: Env;
  featureFlagService: FeatureFlagService;
}

export class CouponService {
  constructor(private deps: CouponServiceDeps) {}

  async validateCoupon(code: string, orderSubtotalMinor: bigint): Promise<CouponDiscount> {
    // Feature flag check first — short circuit if disabled (D-17, CHK-06)
    const flag = await this.deps.featureFlagService.getFlag('COUPONS_ENABLED');
    if (!flag || flag !== 'true') {
      throw new CouponDisabledError();
    }

    // Redis cache check (same pattern as FeatureFlagService.getFlag())
    const cacheKey = `coupon:${code}`;
    const cached = await this.deps.redis.get(cacheKey);
    // ...
  }
}
```

---

### `apps/api/src/modules/jobs/release-reservation-job.ts` (utility, event-driven)

**Analog:** `apps/api/src/modules/jobs/product-index-job.ts`

**Job payload type + pure processor pattern** (lines 17-28, from `product-index-job.ts`):
```typescript
// Mirrors ProductIndexJobData pattern exactly
export interface ReleaseReservationJobData {
  reservationId: string;
}

// Mirrors ProductIndexJobDeps pattern — inject db only (no opensearch)
interface ReleaseReservationJobDeps {
  db: NodePgDatabase<any>;
}

// Mirrors processProductIndexJob — pure function, idempotent, no side-effect on already-consumed
export async function processReleaseReservationJob(
  job: Job,
  deps: ReleaseReservationJobDeps
): Promise<void> {
  const { reservationId } = job.data as ReleaseReservationJobData;

  // Idempotent check before any mutation (pattern from product-index-job.ts lines 133-146)
  const rows = await deps.db.select()
    .from(inventoryReservations)
    .where(eq(inventoryReservations.id, reservationId))
    .limit(1);

  if (!rows[0] || rows[0].status !== 'reserved') {
    return; // Already consumed or released — no-op (Pitfall D-07)
  }
  // ... transaction to release stock
}
```

---

### `apps/api/src/modules/jobs/queues.ts` (config update — add new queues)

**Analog:** `apps/api/src/modules/jobs/queues.ts` (self)

**Queue registration pattern** (lines 54-56, from `queues.ts`):
```typescript
// Add alongside existing productIndexQueue — same connection, same options
export const reservationQueue = new Queue("reservation-expiry-queue", {
  connection: bullMqConnection, // MUST reuse bullMqConnection (Don't Hand-Roll note in RESEARCH.md)
});

export const basketCleanupQueue = new Queue("basket-cleanup-queue", {
  connection: bullMqConnection,
});
```

---

### `apps/api/src/modules/jobs/workers.ts` (config update — add new workers)

**Analog:** `apps/api/src/modules/jobs/workers.ts` (self)

**Worker factory pattern** (lines 41-63, from `workers.ts`):
```typescript
// Mirror startProductIndexWorker exactly — same concurrency + error logging pattern
export function startReservationWorker(deps: ReservationWorkerDeps): Worker {
  const worker = new Worker(
    "reservation-expiry-queue",
    async (job: Job) => {
      await processReleaseReservationJob(job, deps);
    },
    {
      connection: bullMqConnection,
      concurrency: 5, // Higher than product index — reservation expiry is time-critical
    }
  );

  worker.on("failed", (job, err) => {
    deps.logger.error(
      { jobId: job?.id, error: err.message },
      "[ReservationWorker] Job failed"
    );
  });

  return worker;
}
```

---

### `apps/api/src/routes/basket.ts` (route, CRUD)

**Analog:** `apps/api/src/routes/account/addresses.ts`

**Imports + auth guard pattern** (lines 1-7, from `addresses.ts`):
```typescript
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireCustomerAuth } from "../middleware/customerAuth.js";
import type { BasketService } from "../modules/basket/index.js";
```

**Plugin structure with preHandler + DI resolve pattern** (lines 64-79, from `addresses.ts`):
```typescript
export async function basketRoutes(fastify: FastifyInstance): Promise<void> {
  // Guest basket routes (no auth) vs authenticated basket routes
  // Guest routes: GET /basket, POST /basket/items — cookie-based session
  // Auth routes: POST /basket/merge — requires customer JWT

  function getBasketService(): BasketService {
    return fastify.diContainer.resolve<BasketService>("basketService");
  }

  // GET /basket — public, reads from cookie grovio_basket_token OR auth cookie
  fastify.get("/basket", async (request, reply) => {
    const basketService = getBasketService();
    // ...
  });
}
```

**Runtime customerId guard pattern** (lines 27-32, from `addresses.ts`):
```typescript
function getCustomerId(request: import('fastify').FastifyRequest): string {
  if (!request.customerId) {
    throw new Error('requireCustomerAuth must run before this handler');
  }
  return request.customerId;
}
```

**Zod body validation pattern** (lines 38-48, from `addresses.ts`):
```typescript
const AddToBasketInputSchema = z.object({
  productId: z.string().uuid(),
  productVariantId: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(100),
});
```

**Success/error response envelope pattern** (lines 75-80, from `addresses.ts`):
```typescript
return reply.status(201).send({ success: true, data: item });
// Error:
return reply.status(404).send({
  success: false,
  error: { code: "BASKET_NOT_FOUND", message: "Basket not found" },
});
```

---

### `apps/api/src/routes/webhooks/stripe.ts` (route, event-driven)

**Analog:** `apps/api/src/routes/account/profile.ts` (partial — route plugin structure)

**Plugin structure** (lines 39-42, from `profile.ts`):
```typescript
export async function stripeWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  // CRITICAL: Override JSON parser for this route scope ONLY (RESEARCH.md Pattern 4)
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body); // Pass raw Buffer — Stripe needs exact bytes (Pitfall 1)
    }
  );

  fastify.post('/webhooks/stripe', async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;
    const rawBody = request.body as Buffer;
    // ... constructEvent → payment_events upsert → canonical dispatch
  });
}
```

**onConflictDoNothing idempotency pattern** (from RESEARCH.md Pattern 4):
```typescript
const inserted = await fastify.db.insert(paymentEvents)
  .values({ provider: 'stripe', providerEventId: event.id, /* ... */ })
  .onConflictDoNothing({ target: [paymentEvents.provider, paymentEvents.providerEventId] })
  .returning({ id: paymentEvents.id });

if (inserted.length === 0) {
  return reply.status(200).send({ received: true }); // Duplicate delivery — D-10 no-op
}
```

---

### `apps/api/src/routes/account/orders.ts` (route, CRUD)

**Analog:** `apps/api/src/routes/account/addresses.ts`

**Full auth-guarded account route pattern** (lines 64-79, from `addresses.ts`):
```typescript
export async function accountOrderRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireCustomerAuth); // protects all routes in plugin

  function getOrderService(): OrderService {
    return fastify.diContainer.resolve<OrderService>("orderService");
  }

  // GET /account/orders — list all orders for authenticated customer
  fastify.get("/account/orders", async (request, reply) => {
    const orders = await getOrderService().listOrdersForCustomer(getCustomerId(request));
    return reply.send({ success: true, data: { orders } });
  });

  // GET /account/orders/:id — single order detail
  fastify.get<{ Params: { id: string } }>("/account/orders/:id", async (request, reply) => {
    const order = await getOrderService().getOrderById(request.params.id, getCustomerId(request));
    if (!order) {
      return reply.status(404).send({
        success: false,
        error: { code: "ORDER_NOT_FOUND", message: "Order not found" },
      });
    }
    return reply.send({ success: true, data: order });
  });
}
```

---

### `apps/api/src/container.ts` (config update)

**Analog:** `apps/api/src/container.ts` (self)

**Service registration pattern** (lines 58-76, from `container.ts`):
```typescript
// Phase 5 infrastructure values — add alongside existing registrations
container.register({
  // ... existing values ...
  reservationQueue: asValue(reservationQueue),  // BullMQ Queue (new in Phase 5)
  basketCleanupQueue: asValue(basketCleanupQueue),
});

// Phase 5 domain services — add alongside existing class registrations
container.register({
  // ... existing services ...
  basketService: asClass(BasketService).singleton(),
  inventoryService: asClass(InventoryService).singleton(),
  checkoutService: asClass(CheckoutService).singleton(),
  paymentService: asClass(PaymentService).singleton(),
  walletService: asClass(WalletService).singleton(),
  orderService: asClass(OrderService).singleton(),
  commissionService: asClass(CommissionService).singleton(),
  couponService: asClass(CouponService).singleton(),
  returnService: asClass(ReturnService).singleton(),
});
```

---

### `packages/contracts/src/basket/types.ts` (utility, request-response)

**Analog:** `packages/contracts/src/catalog/product.ts`

**Zod schema + inferred type pattern** (lines 1-68, from `catalog/product.ts`):
```typescript
import { z } from "zod";

// Mirror ProductSchema pattern: zod schema → z.infer type export
export const BasketItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  productVariantId: z.string().uuid().nullable(),
  quantity: z.number().int(),
  /**
   * Unit price as number (minor units — never float, always integer per D-01).
   * bigint is NOT used in contracts — JSON serialization uses number (Pitfall 5).
   */
  unitPriceMinor: z.number().int(),
  productName: z.string(),
  vendorId: z.string().uuid(),
  vendorName: z.string(),
  createdAt: z.string().datetime(),
});
export type BasketItem = z.infer<typeof BasketItemSchema>;

export const BasketSchema = z.object({
  sessionId: z.string().uuid(),
  items: z.array(BasketItemSchema),
  itemCount: z.number().int(),
  subtotalMinor: z.number().int(), // number, not bigint — JSON boundary (Pitfall 5)
});
export type Basket = z.infer<typeof BasketSchema>;
```

**Status enum pattern** (lines 21-26, from `catalog/product.ts`):
```typescript
export const OrderStatusSchema = z.enum([
  "pending_payment",
  "payment_received",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
```

---

### `apps/web-storefront/src/hooks/useBasket.ts` (hook, CRUD)

**Analog:** `apps/web-storefront/src/hooks/useAuth.ts`

**useQuery + useMutation pattern** (lines 50-135, from `useAuth.ts`):
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client.js';
import type { Basket, BasketItem } from '@grovio/contracts';

export function useBasket() {
  const qc = useQueryClient();

  // Session probe pattern from useAuth.ts: staleTime + retry: false
  const { data: basket, isLoading } = useQuery<Basket | null>({
    queryKey: ['basket'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ success: boolean; data: Basket }>('/basket');
        return res.data;
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    staleTime: 1000 * 30, // 30s — basket changes frequently
  });

  // Optimistic mutation pattern from RESEARCH.md Pattern 8
  const addItemMutation = useMutation({
    mutationFn: (vars: { productId: string; variantId?: string; quantity: number }) =>
      apiClient.post('/basket/items', vars),

    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['basket'] });
      const previous = qc.getQueryData(['basket']);
      // Optimistic: increment item count in header
      qc.setQueryData(['basket'], (old: Basket | undefined) =>
        old ? { ...old, itemCount: old.itemCount + vars.quantity } : old
      );
      return { previous };
    },

    onError: (_err, _vars, context) => {
      qc.setQueryData(['basket'], context?.previous);
    },

    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['basket'] });
    },
  });

  return { basket, isLoading, addItem: addItemMutation.mutateAsync };
}
```

---

### `apps/web-storefront/src/pages/CartPage.tsx` (component, request-response)

**Analog:** `apps/web-storefront/src/pages/account/AddressesPage.tsx`

**Imports pattern** (lines 1-14, from `AddressesPage.tsx`):
```typescript
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { PageTransition } from '../../components/layout/PageTransition.js';
import { Button } from '../../components/ui/Button.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { apiClient, ApiError } from '../../lib/api-client.js';
import { useUiStore } from '../../store/ui-store.js';
import { useBasket } from '../../hooks/useBasket.js';
```

**Loading/error/empty state pattern** (lines 479-515, from `AddressesPage.tsx`):
```typescript
{/* Loading skeleton */}
{isLoading && (
  <div aria-busy="true" aria-label="Loading cart…" className="flex flex-col gap-4">
    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
  </div>
)}
{/* Error state */}
{isError && (
  <p className="text-sm text-grovio-error" role="alert">
    We're having trouble loading your cart. Please refresh and try again.
  </p>
)}
```

**AnimatePresence + motion pattern for cart item removal** (lines 566-592, from `AddressesPage.tsx`):
```typescript
<AnimatePresence>
  {basket?.items.map((item) => (
    <motion.div
      key={item.id}
      initial={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}  // Collapse on remove (cart-specific)
      transition={{ duration: 0.2 }}
    >
      {/* item content */}
    </motion.div>
  ))}
</AnimatePresence>
```

**Success toast pattern** (lines 369-374, from `AddressesPage.tsx`):
```typescript
const addToast = useUiStore((s) => s.addToast);
// On successful mutation:
addToast({ id: crypto.randomUUID(), message: 'Item removed from cart.', variant: 'info' });
```

**PageTransition wrapper** (line 459, from `AddressesPage.tsx`):
```typescript
return (
  <PageTransition>
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* content */}
    </div>
  </PageTransition>
);
```

---

### `apps/web-storefront/src/pages/checkout/*.tsx` (components, request-response)

**Analog:** `apps/web-storefront/src/pages/account/AddressesPage.tsx`

**Multi-step wizard URL pattern** (D-05 — React Router v6):
```typescript
// Each step is a distinct route — follow useQuery pattern from useProductSearch.ts
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';

// Step guard: redirect if previous step not complete
// Follow useAuth.ts pattern — check data from React Query, not localStorage
```

**Motion page transition between checkout steps** (from `AddressesPage.tsx` lines 569-578):
```typescript
// CheckoutProgress.tsx step animation
<motion.div
  key={currentStep}
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -20 }}
  transition={{ duration: 0.2, ease: 'easeInOut' }}
>
  {/* Step content */}
</motion.div>
```

**Dialog / overlay pattern for payment methods** (lines 257-297, from `AddressesPage.tsx` — DeleteDialog):
```typescript
// Reuse the motion.div overlay pattern for wallet credit modal/panel
<motion.div
  initial={{ opacity: 0, scale: 0.97, y: -4 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.97, y: -4 }}
  transition={{ duration: 0.15 }}
  className="w-full max-w-sm rounded-lg bg-grovio-surface-raised border border-grovio-border p-6 shadow-lg"
>
```

---

### `apps/web-storefront/src/pages/account/OrdersPage.tsx` (component, CRUD)

**Analog:** `apps/web-storefront/src/pages/account/AddressesPage.tsx`

**useQuery + list + loading pattern** (lines 320-332, from `AddressesPage.tsx`):
```typescript
const { data: orders, isLoading, isError } = useQuery({
  queryKey: ['account', 'orders'],
  queryFn: async () => {
    const res = await apiClient.get<OrderListResponse>('/account/orders');
    return res.data.orders;
  },
});
```

---

## Shared Patterns

### Authentication Middleware
**Source:** `apps/api/src/middleware/customerAuth.ts` lines 40-80
**Apply to:** All basket, checkout, account/orders, account/wallet route plugins

```typescript
// In every customer-guarded route plugin:
fastify.addHook("preHandler", requireCustomerAuth);

// In every handler, use the runtime guard (WR-01 pattern):
function getCustomerId(request: import('fastify').FastifyRequest): string {
  if (!request.customerId) {
    throw new Error('requireCustomerAuth must run before this handler');
  }
  return request.customerId;
}
```

### Awilix Service Resolution
**Source:** `apps/api/src/routes/account/addresses.ts` lines 69-71
**Apply to:** All Phase 5 route plugins

```typescript
// Resolve service inside handler, not at plugin level (lazy — avoids startup race)
function getBasketService(): BasketService {
  return fastify.diContainer.resolve<BasketService>("basketService");
}
```

### Zod Body Validation
**Source:** `apps/api/src/routes/account/addresses.ts` lines 38-62 (schema) + line 88 (parse call)
**Apply to:** All POST/PATCH handlers in basket, checkout, order, wallet routes

```typescript
const SomeInputSchema = z.object({ /* fields */ });
// In handler:
const body = SomeInputSchema.parse(request.body);
// ZodError is caught by app.ts setErrorHandler → automatic 400 (lines 97-113 of app.ts)
```

### API Response Envelope
**Source:** `apps/api/src/routes/account/profile.ts` lines 67-68, 99-103
**Apply to:** All Phase 5 API responses

```typescript
// Success:
return reply.send({ success: true, data: result });
// Error:
return reply.status(404).send({
  success: false,
  error: { code: "ORDER_NOT_FOUND", message: "Order not found" },
});
```

### Service Domain Errors
**Source:** `apps/api/src/modules/customer-auth/CustomerAuthService.ts` lines 23-61
**Apply to:** All Phase 5 service classes

```typescript
export class SomeDomainError extends Error {
  readonly code = "SOME_CODE";  // Always typed as readonly string literal
  constructor(message = "Default message") {
    super(message);
    this.name = "SomeDomainError";
  }
}
```

### BIGINT Minor-Unit Money
**Source:** `apps/api/src/db/schema/products.ts` line 100; `packages/contracts/src/money/types.ts`
**Apply to:** All Phase 5 schema files with money columns

```typescript
// DB schema: always bigint with mode "number" (for Drizzle TS safety)
priceMinor: bigint("price_minor", { mode: "number" }).notNull(),
// Naming convention: always suffix _minor (e.g. subtotal_minor, commission_amount_minor)
// Never: FLOAT, DECIMAL, NUMERIC for money columns
```

### BigInt Serialization at API Boundary
**Source:** RESEARCH.md Pitfall 5 code example
**Apply to:** All Phase 5 service methods that return data containing DB bigint values

```typescript
// Convert bigint → number at the service/route boundary before reply.send()
function serializeOrderSummary(order: SelectOrder) {
  return {
    id: order.id,
    subtotalMinor: Number(order.subtotalMinor),
    grandTotalMinor: Number(order.grandTotalMinor),
    // ... all bigint fields become Number()
  };
}
```

### Contracts: Zod Schema + Inferred Type
**Source:** `packages/contracts/src/catalog/product.ts` lines 21-29, 35-68
**Apply to:** All `packages/contracts/src/` new type files

```typescript
// Always: schema definition → z.infer<typeof Schema> type → both exported
export const FooSchema = z.object({ /* ... */ });
export type Foo = z.infer<typeof FooSchema>;
```

### React Query Credentialed API Call
**Source:** `apps/web-storefront/src/lib/api-client.ts` lines 37-75 + `useAuth.ts` lines 54-77
**Apply to:** All Phase 5 storefront hooks (useBasket, useWallet, useCheckout)

```typescript
// All API calls use apiClient (credentials: 'include' hardcoded — D-09)
import { apiClient, ApiError } from '../lib/api-client.js';
// queryFn pattern: try/catch for specific statuses, re-throw others
```

### BullMQ Queue Connection Reuse
**Source:** `apps/api/src/modules/jobs/queues.ts` lines 31-36
**Apply to:** All new BullMQ queues (reservationQueue, basketCleanupQueue)

```typescript
// MUST reuse bullMqConnection — never create a new connection object
// Reason: maxRetriesPerRequest: null + TLS config + enableReadyCheck: false
import { bullMqConnection } from "./queues.js";
const myQueue = new Queue("my-queue", { connection: bullMqConnection });
```

### Framer Motion (motion/react) Animation
**Source:** `apps/web-storefront/src/pages/account/AddressesPage.tsx` lines 1-4, 263-296
**Apply to:** CartPage item removal, CheckoutProgress step transitions, OrderConfirmation entrance

```typescript
import { AnimatePresence, motion } from 'motion/react'; // NOT 'framer-motion' (v12 import)
// List exit animations: <AnimatePresence> wraps items, motion.div has exit prop
// Dialog entrance: initial={{ opacity: 0, scale: 0.97, y: -4 }}, animate={{ opacity: 1, scale: 1, y: 0 }}
// Page transitions: initial={{ opacity: 0, x: 20 }}, animate={{ opacity: 1, x: 0 }}
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/api/src/modules/payments/PaymentProvider.ts` | interface | request-response | No payment abstraction layer exists yet; use RESEARCH.md Pattern 1 |
| `apps/api/src/modules/payments/StripeAdapter.ts` | service | request-response | No external payment SDK adapters exist; follow PaymentProvider interface + RESEARCH.md |
| `apps/api/src/modules/payments/RazorpayAdapter.ts` | service | request-response | No external payment SDK adapters exist; follow PaymentProvider interface + RESEARCH.md |
| `apps/web-storefront/src/components/checkout/StripePaymentForm.tsx` | component | request-response | No Stripe Elements component exists; use `@stripe/react-stripe-js` `<Elements>` + `<PaymentElement>` per RESEARCH.md |
| `apps/web-storefront/src/components/checkout/RazorpayButton.tsx` | component | event-driven | No Razorpay CDN script integration exists; use `window.Razorpay` modal pattern per RESEARCH.md |

---

## Metadata

**Analog search scope:** `apps/api/src/`, `apps/web-storefront/src/`, `packages/contracts/src/`
**Files scanned:** 22 analog source files read in full
**Pattern extraction date:** 2026-06-02
