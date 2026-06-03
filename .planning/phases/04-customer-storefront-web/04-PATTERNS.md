# Phase 4: Customer Storefront (Web) — Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 27 new/modified files
**Analogs found:** 25 / 27

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `apps/api/src/db/schema/customers.ts` | model | CRUD | `apps/api/src/db/schema/vendors.ts` | exact |
| `apps/api/src/db/schema/password-reset-tokens.ts` | model | CRUD | `apps/api/src/db/schema/vendors.ts` | role-match |
| `apps/api/src/db/schema/customer-addresses.ts` | model | CRUD | `apps/api/src/db/schema/vendors.ts` | role-match |
| `apps/api/src/db/schema/homepage-blocks.ts` | model | CRUD | `apps/api/src/db/schema/products.ts` (JSONB col) | role-match |
| `apps/api/src/modules/customer-auth/CustomerAuthService.ts` | service | request-response | `apps/api/src/modules/vendor-auth/VendorAuthService.ts` | exact |
| `apps/api/src/modules/customer-auth/CustomerAuthService.test.ts` | test | request-response | `apps/api/src/modules/vendor-auth/VendorAuthService.test.ts` | exact |
| `apps/api/src/modules/customer-addresses/CustomerAddressService.ts` | service | CRUD | `apps/api/src/modules/categories/CategoryService.ts` | role-match |
| `apps/api/src/modules/customer-addresses/CustomerAddressService.test.ts` | test | CRUD | `apps/api/src/modules/categories/CategoryService.test.ts` | role-match |
| `apps/api/src/modules/homepage/HomepageService.ts` | service | request-response | `apps/api/src/modules/feature-flags/FeatureFlagService.ts` | exact (Redis-first read) |
| `apps/api/src/modules/homepage/HomepageService.test.ts` | test | request-response | `apps/api/src/modules/feature-flags/FeatureFlagService.test.ts` | role-match |
| `apps/api/src/routes/customer/auth.ts` | route | request-response | `apps/api/src/routes/vendor/auth.ts` | exact |
| `apps/api/src/routes/account/profile.ts` | route | CRUD | `apps/api/src/routes/vendor/products.ts` | role-match (auth-gated) |
| `apps/api/src/routes/account/addresses.ts` | route | CRUD | `apps/api/src/routes/vendor/products.ts` | role-match (auth-gated) |
| `apps/api/src/routes/homepage.ts` | route | request-response | `apps/api/src/routes/categories.ts` | exact |
| `apps/api/src/middleware/customerAuth.ts` | middleware | request-response | `apps/api/src/middleware/vendorAuth.ts` | exact |
| `apps/api/src/config/env.ts` (modify) | config | — | self (add STOREFRONT_ORIGIN, SMTP_* vars) | self |
| `apps/api/src/app.ts` (modify) | config | — | self (register cors + cookie + new routes) | self |
| `apps/api/src/container.ts` (modify) | config | — | self (register 3 new services) | self |
| `packages/contracts/src/category/blocks.ts` (modify) | config | — | self (add FeaturedCategoriesBlockSchema) | self |
| `apps/web-storefront/src/main.tsx` (replace) | config | — | self | self |
| `apps/web-storefront/src/router.tsx` | config | — | `apps/web-storefront/src/App.tsx` | role-match |
| `apps/web-storefront/src/lib/api-client.ts` | utility | request-response | no close analog | no analog |
| `apps/web-storefront/src/lib/query-client.ts` | utility | request-response | no close analog | no analog |
| `apps/web-storefront/src/store/ui-store.ts` | store | event-driven | no close analog in codebase | no analog |
| `apps/web-storefront/src/hooks/useAuth.ts` | hook | request-response | no close analog | no analog |
| `apps/web-storefront/src/hooks/useProductSearch.ts` | hook | request-response | no close analog | no analog |
| `apps/web-storefront/src/hooks/useFilterState.ts` | hook | request-response | no close analog | no analog |
| `apps/web-storefront/src/hooks/useInfiniteScroll.ts` | hook | event-driven | no close analog | no analog |
| `apps/web-storefront/src/components/layout/Header.tsx` | component | request-response | `apps/web-storefront/src/App.tsx` | partial |
| `apps/web-storefront/src/components/layout/Footer.tsx` | component | — | `apps/web-storefront/src/App.tsx` | partial |
| `apps/web-storefront/src/components/layout/PageTransition.tsx` | component | — | `apps/web-storefront/src/App.tsx` (motion import) | partial |
| `apps/web-storefront/src/components/ui/ProductCard.tsx` | component | request-response | `apps/web-storefront/src/App.tsx` (motion) | partial |
| `apps/web-storefront/src/components/ui/Skeleton.tsx` | component | — | `apps/web-storefront/src/App.tsx` (Tailwind) | partial |
| `apps/web-storefront/src/components/ui/FilterChip.tsx` | component | event-driven | `apps/web-storefront/src/App.tsx` | partial |
| `apps/web-storefront/src/components/ui/Toast.tsx` | component | event-driven | `apps/web-storefront/src/App.tsx` (motion) | partial |
| `apps/web-storefront/src/components/ui/Button.tsx` | component | event-driven | `apps/web-storefront/src/App.tsx` | partial |
| `apps/web-storefront/src/components/ui/Input.tsx` | component | event-driven | `apps/web-storefront/src/App.tsx` | partial |
| `apps/web-storefront/src/components/blocks/BannerBlock.tsx` | component | request-response | `apps/web-storefront/src/App.tsx` | partial |
| `apps/web-storefront/src/components/blocks/ProductGridBlock.tsx` | component | request-response | `apps/web-storefront/src/App.tsx` | partial |
| `apps/web-storefront/src/components/blocks/TextBlock.tsx` | component | request-response | `apps/web-storefront/src/App.tsx` | partial |
| `apps/web-storefront/src/components/blocks/FeaturedCategoriesBlock.tsx` | component | request-response | `apps/web-storefront/src/App.tsx` | partial |
| `apps/web-storefront/src/pages/HomePage.tsx` | component | request-response | `apps/web-storefront/src/App.tsx` | partial |
| `apps/web-storefront/src/pages/CategoryPage.tsx` | component | request-response | `apps/web-storefront/src/App.tsx` | partial |
| `apps/web-storefront/src/pages/SearchPage.tsx` | component | request-response | `apps/web-storefront/src/App.tsx` | partial |
| `apps/web-storefront/src/pages/ProductDetailPage.tsx` | component | request-response | `apps/web-storefront/src/App.tsx` | partial |
| `apps/web-storefront/src/pages/auth/*.tsx` | component | request-response | `apps/web-storefront/src/App.tsx` | partial |
| `apps/web-storefront/src/pages/account/*.tsx` | component | request-response | `apps/web-storefront/src/App.tsx` | partial |
| `apps/web-storefront/src/components/PlacesAutocompleteInput.tsx` | component | event-driven | no close analog | no analog |

---

## Pattern Assignments

### `apps/api/src/db/schema/customers.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/vendors.ts`

**Imports pattern** (lines 1-1):
```typescript
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
```

**Core pattern** (lines 20-58):
```typescript
export const vendors = pgTable("vendors", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertVendor = typeof vendors.$inferInsert;
export type SelectVendor = typeof vendors.$inferSelect;
```

**Instructions:** Copy verbatim, replace `vendors` → `customers`, `"vendors"` table name, same column set. The `customers` table also needs a `phone` column (`text('phone')` nullable) for address association. Export `InsertCustomer` and `SelectCustomer` types using `.$inferInsert` / `.$inferSelect`.

---

### `apps/api/src/db/schema/password-reset-tokens.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/vendors.ts`

**Core pattern** — derive a minimal table:
```typescript
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customers.js";

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),   // SHA-256 of the raw UUID token
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**Notes:** No `updatedAt` — tokens are insert-once, deleted on use/expiry. No soft delete (`archivedAt`) — hard-delete on use per D-10. Uses FK to `customers.id` with `onDelete: "cascade"`.

---

### `apps/api/src/db/schema/customer-addresses.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/vendors.ts`

**Core pattern** — structured address columns from CONTEXT.md Specific Ideas:
```typescript
import { boolean, doublePrecision, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customers.js";

export const customerAddresses = pgTable("customer_addresses", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  label: text("label"),           // e.g. "Home", "Work"
  street: text("street").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  country: text("country").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  placeId: text("place_id"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

---

### `apps/api/src/db/schema/homepage-blocks.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/products.ts` (JSONB column pattern)

**Imports pattern** (products.ts lines 1-10):
```typescript
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
```

**Core pattern** — from CONTEXT.md Specifics and RESEARCH.md Pattern 7:
```typescript
export const homepageBlocks = pgTable("homepage_blocks", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(),           // 'banner' | 'product_grid' | 'text_block' | 'featured_categories'
  payload: jsonb("payload").notNull(),    // validated against MerchandisingBlockSchema at service layer
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**Note:** No pgEnum for `type` — Zod validates at the application layer (same pattern as `products.attributes` JSONB). Admin write-side is Phase 6; only `getBlocks()` read path built in Phase 4.

---

### `apps/api/src/modules/customer-auth/CustomerAuthService.ts` (service, request-response)

**Analog:** `apps/api/src/modules/vendor-auth/VendorAuthService.ts` — direct structural copy

**Imports pattern** (lines 1-7):
```typescript
import * as argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Env } from "../../config/env.js";
import { customers, type SelectCustomer } from "../../db/schema/index.js";
```

**Domain error pattern** (lines 17-39):
```typescript
export class CustomerAlreadyExistsError extends Error {
  readonly code = "CUSTOMER_ALREADY_EXISTS";
  constructor(message = "A customer account with this email already exists.") {
    super(message);
    this.name = "CustomerAlreadyExistsError";
  }
}

export class InvalidCredentialsError extends Error {
  readonly code = "INVALID_CREDENTIALS";
  constructor(message = "Invalid email or password.") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}
```

**Deps interface pattern** (lines 45-49):
```typescript
interface CustomerAuthServiceDeps {
  db: NodePgDatabase<any>;
  env: Env;
  // Phase 4 addition vs VendorAuthService: nodemailer transport for password reset
  mailer: nodemailer.Transporter;  // injected via Awilix
}
```

**Core JWT signing pattern** (VendorAuthService.ts lines 176-187):
```typescript
const secret = new TextEncoder().encode(env.JWT_SECRET);
const accessToken = await new SignJWT({
  sub: vendor.id,
  role: "vendor" as const,   // ← change to "customer" for CustomerAuthService
  vendorId: vendor.id,       // ← remove; not needed for customer role
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime(`${this.TTL_SECONDS}s`)
  .sign(secret);
```

**Error mapping — 23505 unique violation pattern** (lines 126-134):
```typescript
const pgCode =
  (err as { code?: string })?.code ??
  ((err as { cause?: { code?: string } })?.cause?.code);
if (pgCode === "23505") {
  throw new CustomerAlreadyExistsError();
}
throw err;
```

**Token verification pattern** (lines 197-214):
```typescript
async verifyToken(token: string): Promise<CustomerTokenPayload> {
  const { env } = this.deps;
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const { payload } = await jwtVerify(token, secret);
  if (payload["role"] !== "customer") {        // ← guard: customer role only
    throw new Error("Token does not carry customer role.");
  }
  return {
    sub: payload["sub"] as string,
    role: "customer",
    customerId: payload["sub"] as string,
    iat: payload["iat"] as number,
    exp: payload["exp"] as number,
  };
}
```

**Key differences from VendorAuthService:**
- Role is `"customer"` not `"vendor"`, no `vendorId` claim in JWT
- TTL constants: `ACCESS_TTL_SECONDS = 3600` (1h access), `REFRESH_TTL_SECONDS = 604800` (7d refresh)
- Login returns `{ accessToken, refreshToken, expiresIn }` — route handler sets cookies (D-09)
- Extra methods: `forgotPassword()`, `resetPassword()`, `refreshTokens()`
- Extra dep: `mailer` for nodemailer transport

---

### `apps/api/src/modules/customer-auth/CustomerAuthService.test.ts` (test, request-response)

**Analog:** `apps/api/src/modules/vendor-auth/VendorAuthService.test.ts` — direct copy structure

**Mock setup pattern** (lines 1-34):
```typescript
import { describe, expect, it, vi } from "vitest";
import type { SelectCustomer } from "../../db/schema/index.js";

vi.mock("argon2", () => ({
  hash: vi.fn().mockResolvedValue("$argon2id$hashed"),
  verify: vi.fn().mockResolvedValue(true),
}));

vi.mock("jose", () => {
  class MockSignJWT {
    setProtectedHeader() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    async sign() { return "mock.jwt.token"; }
  }
  return {
    SignJWT: MockSignJWT,
    jwtVerify: vi.fn().mockResolvedValue({
      payload: {
        sub: "customer-uuid-1",
        role: "customer",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    }),
  };
});
```

**DB mock helper pattern** (lines 46-72):
```typescript
function makeDbMock(rows: Partial<SelectCustomer>[]) {
  const awaitableChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        then: (resolve: (v: Partial<SelectCustomer>[]) => void) => resolve(rows),
        catch: vi.fn(),
        finally: vi.fn(),
      }),
    }),
  };
  return { select: vi.fn().mockReturnValue(awaitableChain) };
}
```

**Test coverage requirements** (from RESEARCH.md Validation Architecture):
- `register()` hashes password + inserts customer + throws `CustomerAlreadyExistsError` on 23505
- `login()` verifies argon2 + issues JWT role="customer" + throws `InvalidCredentialsError` (both unknown email and wrong password — same error message, no enumeration)
- `verifyToken()` rejects non-customer role tokens
- `forgotPassword()` generates token, stores hash, triggers email
- `resetPassword()` rejects expired/used tokens

---

### `apps/api/src/modules/homepage/HomepageService.ts` (service, request-response)

**Analog:** `apps/api/src/modules/feature-flags/FeatureFlagService.ts` — Redis-first read pattern

**Imports pattern** (FeatureFlagService.ts lines 1-6):
```typescript
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import type { Env } from "../../config/env.js";
import { homepageBlocks, type SelectHomepageBlock } from "../../db/schema/index.js";
```

**Redis-first read pattern** (FeatureFlagService.ts lines 39-58):
```typescript
async getBlocks(): Promise<MerchandisingBlock[]> {
  const { db, redis, env } = this.deps;

  // Redis-first: return cached result immediately on a hit.
  const cached = await redis.get("homepage:blocks");
  if (cached !== null) return JSON.parse(cached) as MerchandisingBlock[];

  // DB fallback: only active blocks, ordered by sort_order ascending.
  const rows = await db
    .select()
    .from(homepageBlocks)
    .where(eq(homepageBlocks.isActive, true))
    .orderBy(asc(homepageBlocks.sortOrder));

  // Parse JSONB payload through MerchandisingBlockSchema (Zod validates at read).
  const blocks = rows.map(row => MerchandisingBlockSchema.parse({ ...row.payload, type: row.type }));

  // Populate cache. TTL driven by env var (consistent with CATEGORY_TREE_TTL_SECONDS pattern).
  await redis.setex("homepage:blocks", env.HOMEPAGE_BLOCKS_TTL_SECONDS, JSON.stringify(blocks));

  return blocks;
}

async invalidateBlocks(): Promise<void> {
  await this.deps.redis.del("homepage:blocks");
}
```

**Deps interface** — mirrors FeatureFlagServiceDeps exactly, uses same `{ db, redis, env }` shape.

---

### `apps/api/src/modules/customer-addresses/CustomerAddressService.ts` (service, CRUD)

**Analog:** `apps/api/src/modules/categories/CategoryService.ts` — CRUD service with DB reads/writes

**Imports pattern** (CategoryService.ts lines 1-11):
```typescript
import { asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Env } from "../../config/env.js";
import { customerAddresses, type SelectCustomerAddress } from "../../db/schema/index.js";
```

**CRUD method pattern** (CategoryService.ts lines 136-146):
```typescript
async listAddresses(customerId: string): Promise<SelectCustomerAddress[]> {
  const { db } = this.deps;
  return db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, customerId))
    .orderBy(asc(customerAddresses.createdAt));
}
```

**Insert pattern** (CategoryService.ts lines 183-192):
```typescript
const [row] = await db
  .insert(customerAddresses)
  .values(insertValues)
  .returning();
return row!;
```

**Update pattern** (CategoryService.ts lines 215-220):
```typescript
const rows = await db
  .update(customerAddresses)
  .set(updateValues)
  .where(eq(customerAddresses.id, id))
  .returning();
return rows[0] ?? null;
```

**No Redis cache** — address data is customer-specific, not shared/global. No invalidation logic needed.

---

### `apps/api/src/routes/customer/auth.ts` (route, request-response)

**Analog:** `apps/api/src/routes/vendor/auth.ts` — exact plugin structure

**Imports + Zod schema pattern** (lines 1-29):
```typescript
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import {
  type CustomerAuthService,
  InvalidCredentialsError,
  CustomerAlreadyExistsError,
} from "../../modules/customer-auth/index.js";

const RegisterInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
```

**Route handler pattern** (vendor/auth.ts lines 36-83):
```typescript
export async function customerAuthRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /auth/signup — creates a new customer account
  fastify.post("/auth/signup", async (request, reply) => {
    const body = RegisterInputSchema.parse(request.body);
    const customerAuthService =
      fastify.diContainer.resolve<CustomerAuthService>("customerAuthService");
    try {
      const customer = await customerAuthService.register(body.email, body.password, body.name);
      return reply.status(201).send({ success: true, data: customer });
    } catch (err) {
      if (err instanceof CustomerAlreadyExistsError) {
        return reply.status(409).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });
```

**httpOnly cookie pattern for login** (D-09 — not in vendor routes, from RESEARCH.md Pattern 2):
```typescript
  // POST /auth/login — authenticates and sets httpOnly cookies
  fastify.post("/auth/login", async (request, reply) => {
    const body = LoginInputSchema.parse(request.body);
    const customerAuthService =
      fastify.diContainer.resolve<CustomerAuthService>("customerAuthService");
    try {
      const result = await customerAuthService.login(body.email, body.password);
      return reply
        .setCookie("access_token", result.accessToken, {
          httpOnly: true,
          secure: process.env["NODE_ENV"] === "production",
          sameSite: "lax",
          path: "/",
          maxAge: result.expiresIn,
        })
        .setCookie("refresh_token", result.refreshToken, {
          httpOnly: true,
          secure: process.env["NODE_ENV"] === "production",
          sameSite: "lax",
          path: "/auth/refresh",   // scoped — not sent to all API routes (Pitfall 7)
          maxAge: 604800,
        })
        .send({ success: true, data: { expiresIn: result.expiresIn } });
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return reply.status(401).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });
```

---

### `apps/api/src/routes/account/profile.ts` and `addresses.ts` (route, CRUD, auth-gated)

**Analog:** `apps/api/src/routes/vendor/products.ts` (auth-gated plugin pattern)

**Auth guard pattern** (vendor/products.ts lines 44-48):
```typescript
export async function accountProfileRoutes(fastify: FastifyInstance): Promise<void> {
  // Customer JWT guard — protects ALL routes in this plugin (same as requireVendorAuth pattern)
  fastify.addHook("preHandler", requireCustomerAuth);
  // ...routes below
}
```

**DI resolution pattern** (vendor/products.ts lines 50-56):
```typescript
function getCustomerAddressService(): CustomerAddressService {
  return fastify.diContainer.resolve<CustomerAddressService>("customerAddressService");
}
```

---

### `apps/api/src/routes/homepage.ts` (route, request-response)

**Analog:** `apps/api/src/routes/categories.ts` — public Fastify route plugin

**Plugin structure** (categories.ts lines 27-35):
```typescript
export async function homepageRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /homepage ─────────────────────────────────────────────────────────
  // Returns ordered active blocks. Redis-cached (STORE-01, D-04).
  fastify.get("/homepage", async (_request, reply) => {
    const homepageService =
      fastify.diContainer.resolve<HomepageService>("homepageService");
    const blocks = await homepageService.getBlocks();
    return reply.send({ success: true, data: { blocks } });
  });
}
```

**Response envelope** — matches categories.ts: `{ success: true, data: { ... } }` using `ApiSuccess` from `@grovio/contracts`.

---

### `apps/api/src/middleware/customerAuth.ts` (middleware, request-response)

**Analog:** `apps/api/src/middleware/vendorAuth.ts` — exact copy, swap role guard

**Full pattern** (vendorAuth.ts lines 1-64):
```typescript
import { jwtVerify } from "jose";
import type { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env.js";

export async function requireCustomerAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Read token from httpOnly cookie (D-09) instead of Bearer header
  const token = request.cookies?.["access_token"];    // ← key difference vs vendorAuth

  if (!token) {
    return reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  const secret = new TextEncoder().encode(env.JWT_SECRET);
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload["role"] !== "customer") {       // ← customer role guard
      throw new Error("Token does not carry customer role.");
    }
    request.customerId = payload["sub"] as string;   // ← set customerId (not vendorId)
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
    });
  }
}
```

**Key difference from `requireVendorAuth`:** Reads from `request.cookies.access_token` (httpOnly cookie) rather than `Authorization: Bearer` header. Requires `@fastify/cookie` registered before this middleware runs.

---

### `apps/api/src/config/env.ts` (modify — add new env vars)

**Analog:** self — `apps/api/src/config/env.ts` lines 7-192 (existing schema)

**Extension pattern** (follow existing field documentation style, lines 83-96):
```typescript
// Add to envSchema:

/** Allowed origin for CORS with credentials (D-09 httpOnly cookie flow). */
STOREFRONT_ORIGIN: z.string().url().default("http://localhost:5173"),

/** Nodemailer SMTP host (e.g. smtp.gmail.com) for password reset email. */
SMTP_HOST: z.string().optional(),

/** Nodemailer SMTP user (Google account email). */
SMTP_USER: z.string().optional(),

/** Nodemailer SMTP app password. */
SMTP_PASS: z.string().optional(),

/** From address shown on transactional emails. */
SMTP_FROM: z.string().optional(),

/** Redis TTL in seconds for homepage block cache. Defaults to 300s (5 min). */
HOMEPAGE_BLOCKS_TTL_SECONDS: z.coerce.number().default(300),
```

---

### `apps/api/src/app.ts` (modify — register new plugins + routes)

**Analog:** self — `apps/api/src/app.ts` lines 32-109

**Plugin registration order pattern** (lines 44-59):
```typescript
// Register @fastify/cors BEFORE all routes (D-09 + RESEARCH.md Pattern 2):
await fastify.register(cors, {
  origin: env.STOREFRONT_ORIGIN,
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
});
// Register @fastify/cookie BEFORE customer auth routes:
await fastify.register(cookiePlugin);

// --- Routes (Phase 4) ---
await fastify.register(customerAuthRoutes);  // POST /auth/* (public — no JWT guard)
await fastify.register(accountProfileRoutes); // /account/profile (customer role guard)
await fastify.register(accountAddressRoutes); // /account/addresses (customer role guard)
await fastify.register(homepageRoutes);       // GET /homepage (public)
```

---

### `apps/api/src/container.ts` (modify — register 3 new services)

**Analog:** self — `apps/api/src/container.ts` lines 53-66

**Registration pattern** (lines 53-66):
```typescript
// Phase 4 services (new — plan 04-xx):
customerAuthService: asClass(CustomerAuthService).singleton(),
customerAddressService: asClass(CustomerAddressService).singleton(),
homepageService: asClass(HomepageService).singleton(),
```

**Infrastructure value additions** — mailer transport registered as `asValue`:
```typescript
// In infrastructure values block, after redis:
mailer: asValue(createMailerTransport(env)),  // nodemailer transport, null-safe if SMTP not configured
```

---

### `packages/contracts/src/category/blocks.ts` (modify — add FeaturedCategoriesBlock)

**Analog:** self — `packages/contracts/src/category/blocks.ts` lines 1-71

**Extension pattern** — non-breaking addition to discriminated union (lines 64-68):
```typescript
// Add new schema (mirrors BannerBlockSchema / ProductGridBlockSchema pattern):
export const FeaturedCategoriesBlockSchema = z.object({
  type: z.literal("featured_categories"),
  title: z.string(),
  categoryIds: z.array(z.string().uuid()),
  layout: z.enum(["grid", "row"]),
});

export type FeaturedCategoriesBlock = z.infer<typeof FeaturedCategoriesBlockSchema>;

// Update union — add to array, DO NOT change existing members:
export const MerchandisingBlockSchema = z.discriminatedUnion("type", [
  BannerBlockSchema,
  ProductGridBlockSchema,
  TextBlockSchema,
  FeaturedCategoriesBlockSchema,   // ← Phase 4 addition
]);
```

---

### `apps/web-storefront/src/main.tsx` (replace — add providers)

**Analog:** self — `apps/web-storefront/src/main.tsx` lines 1-10

**Replacement pattern** (wraps existing `ReactDOM.createRoot` with QueryClientProvider + RouterProvider):
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { queryClient } from './lib/query-client';
import { router } from './router';
import './app.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

---

### `apps/web-storefront/src/router.tsx` (config)

**Analog:** `apps/web-storefront/src/App.tsx` (motion import confirmed here)

**Motion import pattern** (App.tsx line 1):
```typescript
import { motion } from 'motion/react';   // ← always 'motion/react', never 'framer-motion/react'
```

**React Router v7 router pattern** (from RESEARCH.md Pattern 5):
```typescript
import { createBrowserRouter } from 'react-router';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,      // Header + AnimatePresence(Outlet) + Footer
    children: [
      { index: true, element: <HomePage /> },
      { path: 'category/:slug', element: <CategoryPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'products/:slug', element: <ProductDetailPage /> },
      { path: 'auth/signup', element: <SignupPage /> },
      { path: 'auth/login', element: <LoginPage /> },
      { path: 'auth/forgot-password', element: <ForgotPasswordPage /> },
      { path: 'auth/reset-password', element: <ResetPasswordPage /> },
      {
        path: 'account',
        element: <ProtectedRoute />,   // redirects to /auth/login if not authenticated
        children: [
          { path: 'profile', element: <ProfilePage /> },
          { path: 'addresses', element: <AddressesPage /> },
        ],
      },
    ],
  },
]);
```

---

### `apps/web-storefront/src/components/layout/PageTransition.tsx` (component)

**Analog:** `apps/web-storefront/src/App.tsx` (motion.div usage, lines 7-13)

**Motion pattern** (App.tsx lines 1, 7-12):
```typescript
import { motion } from 'motion/react';

// App.tsx uses initial/animate/transition — PageTransition extends with exit:
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: 8 }}
  transition={{ duration: 0.25, ease: 'easeOut' }}
>
  {children}
</motion.div>
```

**Critical:** Every page component must use `<PageTransition>` as its root element for AnimatePresence exit animations to fire. See RESEARCH.md Pitfall 3.

---

### `apps/web-storefront/src/components/ui/ProductCard.tsx` (component, request-response)

**Analog:** `apps/web-storefront/src/App.tsx` (Tailwind + motion patterns)

**Tailwind class pattern** (App.tsx lines 13-21):
```typescript
// Use design tokens via Tailwind v4 CSS variables (from packages/ui/src/tokens/tokens.css):
// bg-grovio-primary, text-grovio-text, border-grovio-border
// rounded-xl, shadow-lg — from existing usage in App.tsx

// Hover lift animation (Framer Motion whileHover):
import { motion } from 'motion/react';

<motion.div
  className="rounded-xl bg-white shadow-sm border border-grovio-border overflow-hidden"
  whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
>
  {/* product image, name, price */}
</motion.div>
```

---

### `apps/web-storefront/src/lib/api-client.ts` (utility, request-response)

**No close analog in codebase** — storefront has no existing API client.

**Pattern from RESEARCH.md Code Examples:**
```typescript
const BASE_URL = import.meta.env['VITE_API_URL'] as string;

export const apiClient = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      credentials: 'include',    // D-09: sends httpOnly cookies with every request
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new ApiError(res.status, await res.json());
    return res.json();
  },
  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new ApiError(res.status, await res.json());
    return res.json();
  },
  // patch, delete follow same pattern
};
```

**`import.meta.env['VITE_API_URL']`** — matches existing App.tsx line 4 env access pattern.

---

### `apps/web-storefront/src/lib/query-client.ts` (utility, request-response)

**No close analog in codebase.**

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,     // 2 min — balances freshness vs API calls
      retry: (failureCount, error) => {
        // Don't retry on 401/403/404 — these are definitive
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return false;
        return failureCount < 2;
      },
    },
  },
});
```

---

### `apps/web-storefront/src/store/ui-store.ts` (store, event-driven)

**No close analog in codebase** — no Zustand stores exist yet.

**Pattern from RESEARCH.md Architecture (D-06 boundary rule):**
```typescript
import { create } from 'zustand';

interface UiState {
  filterDrawerOpen: boolean;
  setFilterDrawerOpen: (open: boolean) => void;
  toasts: Toast[];
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  filterDrawerOpen: false,
  setFilterDrawerOpen: (open) => set({ filterDrawerOpen: open }),
  toasts: [],
  addToast: (toast) => set((s) => ({ toasts: [...s.toasts, toast] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));
```

**Critical boundary:** Zustand holds ONLY `filterDrawerOpen` and `toasts`. All filter values, sort, categoryId, and search query live in `useSearchParams` (URL). See RESEARCH.md Pitfall 1.

---

### `apps/web-storefront/src/hooks/useFilterState.ts` (hook, request-response)

**No close analog in codebase.**

**Pattern from RESEARCH.md Pattern 4 (URL-serialized filter state):**
```typescript
import { useSearchParams } from 'react-router';
import { useMemo, useCallback } from 'react';

export function useFilterState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => ({
    q: searchParams.get('q') ?? '',
    categoryId: searchParams.get('categoryId') ?? '',
    sort: searchParams.get('sort') ?? 'relevance',
    activeFilters: JSON.parse(searchParams.get('filters') ?? '{}') as Record<string, string[]>,
  }), [searchParams]);

  const setFilter = useCallback((key: string, value: string | string[]) => {
    setSearchParams(prev => {
      const current = JSON.parse(prev.get('filters') ?? '{}');
      current[key] = value;
      prev.set('filters', JSON.stringify(current));
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams(prev => { prev.delete('filters'); return prev; });
  }, [setSearchParams]);

  return { filters, setFilter, clearFilters };
}
```

**Import from `react-router`** (not `react-router-dom`) — see RESEARCH.md Pitfall 8.

---

### `apps/web-storefront/src/hooks/useProductSearch.ts` (hook, request-response)

**No close analog in codebase.**

**Pattern from RESEARCH.md Pattern 3 (infinite scroll):**
```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { apiClient } from '../lib/api-client';
import type { SearchResponse } from '@grovio/contracts';

export function useProductSearch() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const filters = searchParams.get('filters') ?? '';
  const sort = searchParams.get('sort') ?? 'relevance';
  const categoryId = searchParams.get('categoryId') ?? '';

  return useInfiniteQuery({
    // All URL params in queryKey — changes auto-reset to page 1 (RESEARCH.md Pitfall 1)
    queryKey: ['search', q, filters, sort, categoryId],
    queryFn: ({ pageParam }) =>
      apiClient.get<{ data: SearchResponse }>(
        `/search?q=${encodeURIComponent(q)}&filters=${encodeURIComponent(filters)}&sort=${sort}&categoryId=${categoryId}&limit=24&cursor=${pageParam ?? ''}`
      ).then(r => r.data),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
```

---

### `apps/web-storefront/src/hooks/useInfiniteScroll.ts` (hook, event-driven)

**No close analog in codebase.**

**Pattern from RESEARCH.md Pattern 3:**
```typescript
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

export function useInfiniteScroll(
  fetchNextPage: () => void,
  hasNextPage: boolean,
  isFetchingNextPage: boolean,
) {
  const { ref, inView } = useInView({ threshold: 0.1 });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { sentinelRef: ref };
}
```

---

### All page components (`pages/*.tsx`, `pages/auth/*.tsx`, `pages/account/*.tsx`)

**Analog:** `apps/web-storefront/src/App.tsx` (motion import, Tailwind, env access)

**Page shell pattern** (every page must use `PageTransition` as root):
```typescript
import { motion } from 'motion/react';                          // always this import path
import { PageTransition } from '../components/layout/PageTransition';

export default function HomePage() {
  return (
    <PageTransition>
      {/* page content using Tailwind v4 classes + design token classes */}
      {/* bg-grovio-surface, text-grovio-text, border-grovio-border */}
    </PageTransition>
  );
}
```

**Skeleton loading pattern** (App.tsx Tailwind class style):
```typescript
// Use Tailwind animate-pulse (CSS-only — no JS) per RESEARCH.md "Don't Hand-Roll" table:
<div className="h-48 w-full rounded-xl bg-grovio-surface animate-pulse" />
```

**Disabled button pattern for Add to Cart** (D-13):
```typescript
<button
  disabled
  data-phase="5"          // ← required by D-13 for Phase 5 handoff identification
  className="w-full rounded-lg bg-grovio-primary px-6 py-3 text-white
             opacity-50 cursor-not-allowed"
>
  Add to Cart
</button>
```

---

### `apps/web-storefront/src/components/PlacesAutocompleteInput.tsx` (component, event-driven)

**No close analog in codebase.**

**Pattern from RESEARCH.md Pattern 6:**
```typescript
import { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

interface StructuredAddress {
  street: string; city: string; state: string;
  pincode: string; country: string;
  lat: number | null; lng: number | null; placeId: string;
}

export function PlacesAutocompleteInput({ apiKey, onAddressSelect, value, onChange }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    const loader = new Loader({ apiKey, version: 'weekly', libraries: ['places'] });
    loader.load().then((google) => {
      if (!inputRef.current) return;
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        fields: ['address_components', 'geometry', 'place_id'],
      });
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current!.getPlace();
        onAddressSelect(parseAddressComponents(place));
      });
    });
    // Cleanup: remove listeners to prevent stacking on remount (RESEARCH.md Pitfall 4)
    return () => {
      if (autocompleteRef.current) {
        google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [apiKey]);

  return <input ref={inputRef} value={value} onChange={e => onChange(e.target.value)} />;
}
```

**Fallback:** If `VITE_GOOGLE_MAPS_API_KEY` env var is not set, render a plain `<input type="text">` with a console warning. Follows RESEARCH.md Environment Availability graceful degradation note.

---

## Shared Patterns

### Pattern A: Zod Body Validation Before Service Call
**Source:** `apps/api/src/routes/vendor/auth.ts` (lines 25-29 + 39-40)
**Apply to:** All new API route files in Phase 4

```typescript
// Inline Zod schema at file top (not imported from contracts — routes own their input shape)
const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// In handler: parse before reaching service
const body = LoginInputSchema.parse(request.body);  // throws ZodError → app.ts → 400
```

### Pattern B: Domain Error → HTTP Status Mapping
**Source:** `apps/api/src/routes/vendor/auth.ts` (lines 44-59)
**Apply to:** All new API route files in Phase 4

```typescript
try {
  const result = await service.method(args);
  return reply.status(201).send({ success: true, data: result });
} catch (err) {
  if (err instanceof KnownDomainError) {
    return reply.status(409).send({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }
  throw err;   // re-throw unknown errors → app.ts setErrorHandler → 500
}
```

### Pattern C: Response Envelope
**Source:** `apps/api/src/routes/categories.ts` (lines 34, 55-57)
**Apply to:** All new API routes (success and error both)

```typescript
// Success:
return reply.send({ success: true, data: { ... } });
// or with status:
return reply.status(201).send({ success: true, data: result });

// Error:
return reply.status(404).send({
  success: false,
  error: { code: "RESOURCE_NOT_FOUND", message: "Not found" },
});
```

### Pattern D: Awilix DI Container Resolution in Route Handlers
**Source:** `apps/api/src/routes/categories.ts` (lines 31-33)
**Apply to:** All new route files

```typescript
// Resolve inside handler (not at plugin top-level) to avoid stale refs across hot reloads:
const myService = fastify.diContainer.resolve<MyService>("myService");
```

### Pattern E: Fastify Route Plugin Export
**Source:** `apps/api/src/routes/vendor/auth.ts` (line 36) and `apps/api/src/routes/categories.ts` (line 27)
**Apply to:** All new route files

```typescript
// All route plugins are named async functions that take FastifyInstance:
export async function myRoutes(fastify: FastifyInstance): Promise<void> {
  // routes here
}
// Registered in app.ts via: await fastify.register(myRoutes);
```

### Pattern F: Drizzle Schema Column Naming Conventions
**Source:** `apps/api/src/db/schema/vendors.ts` (all columns)
**Apply to:** All new schema files in Phase 4

- `id`: `uuid('id').defaultRandom().primaryKey()`
- Timestamps: `timestamp('created_at', { withTimezone: true }).defaultNow().notNull()`
- Soft delete: `timestamp('archived_at', { withTimezone: true })` — nullable, no default
- TypeScript camelCase to SQL snake_case (e.g. `passwordHash` → `'password_hash'`)
- Inferred types: `export type InsertX = typeof table.$inferInsert`

### Pattern G: Schema Index Barrel Export Order
**Source:** `apps/api/src/db/schema/index.ts` (all lines)
**Apply to:** After adding new schema files

```typescript
// New Phase 4 exports — add after existing catalog domain block:
// customers before password_reset_tokens and customer_addresses (FK dependency):
export * from "./customers.js";
export * from "./password-reset-tokens.js";
export * from "./customer-addresses.js";
export * from "./homepage-blocks.js";
```

### Pattern H: env.ts Extension for New Env Vars
**Source:** `apps/api/src/config/env.ts` (existing field pattern, e.g. lines 83-96)
**Apply to:** `env.ts` modification task

- Use `z.coerce.number().default(N)` for numeric TTLs (consistent with `FEATURE_FLAG_TTL_SECONDS`, `CATEGORY_TREE_TTL_SECONDS`)
- Use `.optional()` for infrastructure vars that degrade gracefully (e.g., `SMTP_HOST`, `S3_BUCKET_URL`)
- Use `.default("value")` for values with safe dev fallbacks (e.g., `STOREFRONT_ORIGIN`)
- Add JSDoc comment above each new field matching existing documentation style

### Pattern I: Framer Motion Import Path
**Source:** `apps/web-storefront/src/App.tsx` (line 1)
**Apply to:** All new frontend component files that use animation

```typescript
import { motion, AnimatePresence } from 'motion/react';  // always 'motion/react', never 'framer-motion'
```

### Pattern J: Tailwind v4 CSS Variable Classes
**Source:** `apps/web-storefront/src/App.tsx` (line 19), `packages/ui/src/tokens/index.ts`
**Apply to:** All new frontend components

```typescript
// Design token classes (from packages/ui/src/tokens/tokens.css @theme block):
// bg-grovio-primary, bg-grovio-surface, bg-grovio-surface-raised
// text-grovio-text, text-grovio-text-muted
// border-grovio-border
// Already confirmed working in App.tsx line 19: "bg-grovio-primary"
```

### Pattern K: `import.meta.env` Access Pattern
**Source:** `apps/web-storefront/src/App.tsx` (line 4)
**Apply to:** All new frontend files that need env vars

```typescript
const apiUrl = import.meta.env['VITE_API_URL'] as string;  // bracket access, not dot access
```

---

## No Analog Found

Files with no close match in the existing codebase (planner should use RESEARCH.md patterns directly):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web-storefront/src/lib/api-client.ts` | utility | request-response | No existing API client in the storefront; cookies-first pattern (D-09) is new |
| `apps/web-storefront/src/lib/query-client.ts` | utility | request-response | No existing React Query config in the storefront |
| `apps/web-storefront/src/store/ui-store.ts` | store | event-driven | No Zustand stores exist yet anywhere in the monorepo |
| `apps/web-storefront/src/hooks/use*.ts` | hook | various | No React hooks exist yet in the storefront |
| `apps/web-storefront/src/components/PlacesAutocompleteInput.tsx` | component | event-driven | No Google Maps integration exists anywhere in the monorepo |

For all "no analog" files, the RESEARCH.md Code Examples and pattern sections provide the authoritative implementation guide.

---

## Metadata

**Analog search scope:** `apps/api/src/`, `apps/web-storefront/src/`, `packages/contracts/src/`, `packages/ui/src/`
**Files scanned:** 18 source files read directly (plus directory listings)
**Pattern extraction date:** 2026-06-01
