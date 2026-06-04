# Phase 6: Vendor & Admin Tools — Pattern Map

**Mapped:** 2026-06-04
**Files analyzed:** 42 (new/modified files derived from CONTEXT.md decisions and RESEARCH.md structure)
**Analogs found:** 42 / 42

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/api/src/db/schema/vendor-users.ts` | schema | CRUD | `apps/api/src/db/schema/vendor-commission-entries.ts` | exact (pgEnum + uuid + timestamps) |
| `apps/api/src/db/schema/vendor-staff-invites.ts` | schema | CRUD | `apps/api/src/db/schema/vendor-commission-entries.ts` | role-match |
| `apps/api/src/db/schema/vendor-payout-info.ts` | schema | CRUD | `apps/api/src/db/schema/vendors.ts` | role-match |
| `apps/api/src/db/schema/vendor-payouts.ts` | schema | append-only | `apps/api/src/db/schema/wallet-entries.ts` | exact (append-only, BIGINT, no updatedAt) |
| `apps/api/src/db/schema/admin-users.ts` | schema | CRUD | `apps/api/src/db/schema/vendors.ts` | exact (id/email/passwordHash/createdAt) |
| `apps/api/src/db/schema/marketplace-settings.ts` | schema | CRUD | `apps/api/src/db/schema/feature-flags.ts` | exact (key TEXT PK, value JSONB, updatedAt) |
| `apps/api/src/db/schema/audit-log.ts` | schema | append-only | `apps/api/src/db/schema/wallet-entries.ts` | role-match (append-only, no updatedAt) |
| `apps/api/src/db/schema/vendors.ts` (EXTEND) | schema | CRUD | self | — |
| `apps/api/src/db/schema/coupons.ts` (EXTEND) | schema | CRUD | self | — |
| `apps/api/src/modules/vendor-auth/VendorAuthService.ts` (UPDATE) | service | request-response | self | — |
| `apps/api/src/modules/admin-auth/AdminAuthService.ts` | service | request-response | `apps/api/src/modules/vendor-auth/VendorAuthService.ts` | exact |
| `apps/api/src/modules/settings/SettingsService.ts` | service | CRUD | `apps/api/src/modules/feature-flags/FeatureFlagService.ts` | exact (Redis-first, JSONB key-value) |
| `apps/api/src/modules/audit/AuditService.ts` | service | append-only | `apps/api/src/modules/wallet/WalletService.ts` | role-match (append-only insert) |
| `apps/api/src/modules/vendor-management/VendorManagementService.ts` | service | CRUD | `apps/api/src/modules/categories/CategoryService.ts` | role-match |
| `apps/api/src/modules/vendor-staff/VendorStaffService.ts` | service | CRUD | `apps/api/src/modules/customer-auth/CustomerAuthService.ts` | role-match (email invite, token) |
| `apps/api/src/modules/analytics/AnalyticsService.ts` | service | request-response | `apps/api/src/modules/commissions/CommissionService.ts` | role-match (SQL aggregation, Redis) |
| `apps/api/src/modules/vendor-profile/VendorProfileService.ts` | service | CRUD | `apps/api/src/modules/categories/CategoryService.ts` | role-match |
| `apps/api/src/middleware/adminAuth.ts` | middleware | request-response | `apps/api/src/middleware/vendorAuth.ts` | exact |
| `apps/api/src/routes/admin/auth.ts` | route | request-response | `apps/api/src/routes/vendor/auth.ts` | exact |
| `apps/api/src/routes/admin/vendors.ts` | route | CRUD | `apps/api/src/routes/admin/categories.ts` | exact |
| `apps/api/src/routes/admin/commission-rules.ts` | route | CRUD | `apps/api/src/routes/admin/categories.ts` | exact |
| `apps/api/src/routes/admin/payouts.ts` | route | append-only | `apps/api/src/routes/admin/categories.ts` | role-match |
| `apps/api/src/routes/admin/homepage-blocks.ts` | route | CRUD | `apps/api/src/routes/admin/categories.ts` | exact |
| `apps/api/src/routes/admin/feature-flags.ts` | route | CRUD | `apps/api/src/routes/vendor/auth.ts` | role-match |
| `apps/api/src/routes/admin/settings.ts` | route | CRUD | `apps/api/src/routes/admin/categories.ts` | role-match |
| `apps/api/src/routes/admin/audit-log.ts` | route | request-response | `apps/api/src/routes/admin/categories.ts` | role-match |
| `apps/api/src/routes/admin/analytics.ts` | route | request-response | `apps/api/src/routes/admin/categories.ts` | role-match |
| `apps/api/src/routes/vendor/team.ts` | route | CRUD | `apps/api/src/routes/vendor/auth.ts` | role-match |
| `apps/api/src/routes/vendor/profile.ts` | route | CRUD | `apps/api/src/routes/vendor/orders.ts` | exact |
| `apps/api/src/routes/vendor/inventory.ts` | route | CRUD | `apps/api/src/routes/vendor/orders.ts` | exact |
| `apps/api/src/routes/vendor/returns.ts` | route | CRUD | `apps/api/src/routes/vendor/orders.ts` | exact |
| `apps/api/src/routes/vendor/earnings.ts` | route | request-response | `apps/api/src/routes/vendor/orders.ts` | exact |
| `apps/api/src/routes/vendor/coupons.ts` | route | CRUD | `apps/api/src/routes/vendor/orders.ts` | exact |
| `apps/api/src/container.ts` (UPDATE) | config | — | self | — |
| `apps/web-vendor/src/lib/apiClient.ts` | utility | request-response | `apps/web-storefront/src/lib/api-client.ts` | exact |
| `apps/web-vendor/src/lib/queryClient.ts` | utility | — | `apps/web-storefront/src/lib/query-client.ts` | exact |
| `apps/web-vendor/src/stores/vendorAuthStore.ts` | store | request-response | `apps/web-storefront/src/hooks/useAuth.ts` | role-match |
| `apps/web-vendor/src/stores/uiStore.ts` | store | event-driven | `apps/web-storefront/src/store/ui-store.ts` | exact |
| `apps/web-vendor/src/components/layout/PanelLayout.tsx` | component | request-response | `apps/web-storefront/src/components/layout/AppLayout.tsx` | role-match |
| `apps/web-vendor/src/components/layout/ProtectedVendorRoute.tsx` | component | request-response | `apps/web-storefront/src/components/layout/ProtectedRoute.tsx` | exact |
| `apps/web-vendor/src/router.tsx` | config | — | `apps/web-storefront/src/router.tsx` | exact |
| `apps/web-vendor/src/pages/auth/LoginPage.tsx` | component | request-response | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | role-match |
| `apps/web-vendor/src/pages/DashboardPage.tsx` | component | request-response | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | role-match |
| `apps/web-vendor/src/pages/ProductsPage.tsx` | component | CRUD | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | role-match |
| `apps/web-vendor/src/pages/InventoryPage.tsx` | component | CRUD | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | role-match |
| `apps/web-vendor/src/pages/OrdersPage.tsx` | component | CRUD | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | role-match |
| `apps/web-vendor/src/pages/ReturnsPage.tsx` | component | CRUD | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | role-match |
| `apps/web-vendor/src/pages/EarningsPage.tsx` | component | request-response | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | role-match |
| `apps/web-vendor/src/pages/CouponsPage.tsx` | component | CRUD | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | role-match |
| `apps/web-vendor/src/pages/TeamPage.tsx` | component | CRUD | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | role-match |
| `apps/web-vendor/src/pages/StoreProfilePage.tsx` | component | CRUD | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | role-match |
| `apps/web-vendor/src/pages/SettingsPage.tsx` | component | CRUD | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | role-match |
| `apps/web-admin/src/lib/apiClient.ts` (UPDATE) | utility | request-response | `apps/web-storefront/src/lib/api-client.ts` | exact |
| `apps/web-admin/src/stores/adminAuthStore.ts` | store | request-response | `apps/web-storefront/src/hooks/useAuth.ts` | role-match |
| `apps/web-admin/src/components/layout/PanelLayout.tsx` | component | — | `apps/web-storefront/src/components/layout/AppLayout.tsx` | role-match |
| `apps/web-admin/src/components/layout/ProtectedAdminRoute.tsx` | component | request-response | `apps/web-storefront/src/components/layout/ProtectedRoute.tsx` | exact |
| `apps/web-admin/src/pages/auth/LoginPage.tsx` | component | request-response | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | role-match |
| `apps/web-admin/src/pages/DashboardPage.tsx` | component | request-response | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | role-match |
| `apps/web-admin/src/pages/VendorsPage.tsx` | component | CRUD | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | exact |
| `apps/web-admin/src/pages/CommissionRulesPage.tsx` | component | CRUD | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | exact |
| `apps/web-admin/src/pages/PayoutManagementPage.tsx` | component | append-only | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | exact |
| `apps/web-admin/src/pages/CmsPage.tsx` | component | CRUD | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | exact |
| `apps/web-admin/src/pages/FeatureFlagsPage.tsx` | component | CRUD | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | exact |
| `apps/web-admin/src/pages/SettingsPage.tsx` | component | CRUD | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | exact |
| `apps/web-admin/src/pages/AuditLogPage.tsx` | component | request-response | `apps/web-admin/src/pages/categories/CategoryListPage.tsx` | exact |
| `apps/web-admin/src/App.tsx` (UPDATE) | config | — | self (extend existing) | — |

---

## Pattern Assignments

### `apps/api/src/db/schema/vendor-users.ts` (schema, CRUD)

**Analog:** `apps/api/src/db/schema/vendor-commission-entries.ts` (pgEnum pattern), `apps/api/src/db/schema/vendors.ts` (soft-delete/timestamps)

**Imports pattern** (lines 1-8 of vendor-commission-entries.ts):
```typescript
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { vendors } from "./vendors.js";
```

**pgEnum pattern** (lines 21-25 of vendor-commission-entries.ts):
```typescript
export const commissionStatusEnum = pgEnum("commission_status", [
  "earned",
  "reversed",
  "net",
]);
// ADAPT: vendorUserRoleEnum = pgEnum("vendor_user_role", ["owner","manager","staff"])
```

**Table structure** — copy from vendors.ts lines 20-52, add:
- `vendorId uuid FK → vendors.id NOT NULL`
- `role vendorUserRoleEnum NOT NULL`
- `invitedBy uuid nullable` (self-referential, add FK after table creation)
- `acceptedAt timestamp nullable`
- `archivedAt timestamp nullable` (soft-delete, same as `vendors.archivedAt`)
- NO `email UNIQUE` on vendors; here `email TEXT NOT NULL UNIQUE` across the whole table

**Type exports pattern** (lines 54-58 of vendors.ts):
```typescript
export type InsertVendorUser = typeof vendorUsers.$inferInsert;
export type SelectVendorUser = typeof vendorUsers.$inferSelect;
```

---

### `apps/api/src/db/schema/vendor-payouts.ts` (schema, append-only)

**Analog:** `apps/api/src/db/schema/wallet-entries.ts`

**Append-only indicators to copy** (lines 42-47 and 104-107 of wallet-entries.ts):
```typescript
// NO updatedAt column — entries are append-only. Existing rows are NEVER modified.
// This makes the ledger tamper-evident and audit-friendly.
createdAt: timestamp("created_at", { withTimezone: true })
  .defaultNow()
  .notNull(),
// NO updatedAt — intentionally absent (append-only constraint)
```

**BIGINT money column pattern** (lines 74-75 of wallet-entries.ts):
```typescript
amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
// ADAPT: amountMinor for vendor_payouts.amount_minor
```

**Additional columns for vendor_payouts** (from D-07): `vendorId FK`, `settlementReference TEXT`, `note TEXT nullable`, `settledByAdminEmail TEXT`, `settledAt TIMESTAMP NOT NULL`, `createdAt` (no `updatedAt`).

---

### `apps/api/src/db/schema/marketplace-settings.ts` (schema, CRUD)

**Analog:** `apps/api/src/db/schema/feature-flags.ts`

**Full analog** (lines 1-24 of feature-flags.ts):
```typescript
import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  ...
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**Adapt for marketplace_settings** — key becomes the PRIMARY KEY (no `id` column needed), `value` is `jsonb` (not `text`), no `isEnabled` column, no `description`:
```typescript
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
export const marketplaceSettings = pgTable("marketplace_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

---

### `apps/api/src/db/schema/audit-log.ts` (schema, append-only)

**Analog:** `apps/api/src/db/schema/wallet-entries.ts`

**Append-only table pattern** (no `updatedAt` — same as wallet-entries.ts and vendor-commission-entries.ts):
```typescript
// NO updatedAt — append-only. Consistent with wallet_entries.
createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
```

**JSONB for before/after** (line 1 of feature-flags.ts for jsonb import):
```typescript
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
// before/after columns: jsonb("before"), jsonb("after") — both nullable
```

Columns from D-13: `id UUID PK`, `actorType TEXT`, `actorId TEXT`, `actorEmail TEXT`, `action TEXT`, `entityType TEXT`, `entityId TEXT`, `before JSONB nullable`, `after JSONB nullable`, `ipAddress TEXT nullable`, `createdAt TIMESTAMP NOT NULL`. No `updatedAt`.

---

### `apps/api/src/modules/vendor-auth/VendorAuthService.ts` (UPDATE — service, request-response)

**Analog (base to migrate from):** `apps/api/src/modules/vendor-auth/VendorAuthService.ts`

**Current login query** (lines 156-163) — REPLACE `vendors` with `vendorUsers`:
```typescript
// BEFORE (Phase 3):
const rows = await db
  .select()
  .from(vendors)
  .where(eq(vendors.email, email))
  .limit(1);
const vendor = rows[0];

// AFTER (Phase 6): authenticate against vendor_users
const rows = await db
  .select()
  .from(vendorUsers)
  .where(and(eq(vendorUsers.email, email), isNull(vendorUsers.archivedAt)))
  .limit(1);
const vendorUser = rows[0];
```

**Current JWT payload** (lines 177-182) — EXTEND with `role` and `email` from D-06:
```typescript
// BEFORE:
const accessToken = await new SignJWT({
  sub: vendor.id,
  role: "vendor" as const,
  vendorId: vendor.id,
})
// AFTER (Phase 6):
const accessToken = await new SignJWT({
  sub: vendorUser.id,          // vendor_users.id (NOT vendors.id)
  role: vendorUser.role,       // "owner" | "manager" | "staff"
  vendorId: vendorUser.vendorId, // FK to vendors.id
  email: vendorUser.email,
})
```

**Updated VendorTokenPayload** (lines 65-71) — change `role: "vendor"` to union:
```typescript
export interface VendorTokenPayload {
  sub: string;           // vendor_users.id
  role: "owner" | "manager" | "staff";
  vendorId: string;      // vendors.id FK
  email: string;
  iat: number;
  exp: number;
}
```

**Suspended vendor check** — add after `vendorUser` lookup (from RESEARCH.md Pattern 2):
```typescript
const vendorRows = await db
  .select({ status: vendors.onboardingStatus })
  .from(vendors)
  .where(eq(vendors.id, vendorUser.vendorId))
  .limit(1);
if (vendorRows[0]?.status === "suspended") throw new InvalidCredentialsError();
```

---

### `apps/api/src/modules/admin-auth/AdminAuthService.ts` (service, request-response)

**Analog:** `apps/api/src/modules/vendor-auth/VendorAuthService.ts` — copy entire file, adapt names

**Imports pattern** (lines 1-6 of VendorAuthService.ts):
```typescript
import * as argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Env } from "../../config/env.js";
import { adminUsers } from "../../db/schema/index.js";
```

**Domain errors** (lines 17-39 of VendorAuthService.ts) — copy verbatim, rename class prefix to `Admin`:
```typescript
export class InvalidCredentialsError extends Error {
  readonly code = "INVALID_CREDENTIALS";
  constructor(message = "Invalid email or password.") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}
```

**Deps interface** (lines 46-49 of VendorAuthService.ts) — same shape, different name:
```typescript
interface AdminAuthServiceDeps {
  db: NodePgDatabase<any>;
  env: Env;
}
```

**login() method** (lines 153-188 of VendorAuthService.ts) — replace `vendors` with `adminUsers`, JWT payload:
```typescript
const accessToken = await new SignJWT({
  sub: admin.id,
  role: "admin" as const,
  email: admin.email,
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime(`${this.TTL_SECONDS}s`)
  .sign(secret);
```

**verifyToken()** (lines 197-214 of VendorAuthService.ts) — same pattern, check `role === "admin"`:
```typescript
async verifyToken(token: string): Promise<AdminTokenPayload> {
  const { env } = this.deps;
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const { payload } = await jwtVerify(token, secret);
  if (payload["role"] !== "admin") {
    throw new Error("Token does not carry admin role.");
  }
  return { sub: payload["sub"] as string, role: "admin", email: payload["email"] as string, ... };
}
```

**TTL_SECONDS** — use 28800 (8h) for admin sessions vs. 3600 (1h) for vendor (line 92 of VendorAuthService.ts shows the pattern).

---

### `apps/api/src/modules/settings/SettingsService.ts` (service, CRUD)

**Analog:** `apps/api/src/modules/feature-flags/FeatureFlagService.ts` — near-exact copy

**Imports pattern** (lines 1-5 of FeatureFlagService.ts):
```typescript
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import type { Env } from "../../config/env.js";
import { marketplaceSettings } from "../../db/schema/index.js";
```

**Redis key pattern** (lines 31-33 of FeatureFlagService.ts) — change prefix from `"ff:"` to `"settings:"`:
```typescript
private redisKey(key: string): string {
  return "settings:" + key;
}
```

**getSetting() — Redis-first read** (lines 39-58 of FeatureFlagService.ts) — copy the `getFlag()` structure:
```typescript
async getSetting(key: string): Promise<unknown | null> {
  const { db, redis, env } = this.deps;
  const cached = await redis.get(this.redisKey(key));
  if (cached !== null) return JSON.parse(cached);
  const rows = await db
    .select()
    .from(marketplaceSettings)
    .where(eq(marketplaceSettings.key, key))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  await redis.setex(this.redisKey(key), env.FEATURE_FLAG_TTL_SECONDS, JSON.stringify(row.value));
  return row.value;
}
```

**updateSetting() — UPSERT + invalidate** (from RESEARCH.md Pattern 3):
```typescript
async updateSetting(key: string, value: unknown): Promise<void> {
  await db.insert(marketplaceSettings).values({ key, value }).onConflictDoUpdate({
    target: marketplaceSettings.key,
    set: { value, updatedAt: new Date() },
  });
  await this.deps.redis.del(this.redisKey(key));
}
```

**invalidateSetting()** (lines 85-87 of FeatureFlagService.ts) — copy `invalidateFlag()`:
```typescript
async invalidateSetting(key: string): Promise<void> {
  await this.deps.redis.del(this.redisKey(key));
}
```

---

### `apps/api/src/modules/audit/AuditService.ts` (service, append-only)

**Analog:** Append-only insert pattern from `apps/api/src/modules/wallet/WalletService.ts` (insert-only, no updates)

**Service skeleton** (follows CommissionService/FeatureFlagService DI pattern, lines 45-68 of CommissionService.ts):
```typescript
interface AuditServiceDeps {
  db: NodePgDatabase<any>;
}

export class AuditService {
  constructor(private deps: AuditServiceDeps) {}

  async log(params: {
    actorType: "admin" | "vendor" | "system";
    actorId: string;
    actorEmail: string;
    action: string;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    ipAddress?: string;
  }): Promise<void> {
    await this.deps.db.insert(auditLog).values({
      ...params,
      createdAt: new Date(),
    });
  }
}
```

**No Redis dependency** — AuditService only writes (append-only), never reads with caching. Unlike FeatureFlagService, no `redis` in deps.

---

### `apps/api/src/middleware/adminAuth.ts` (middleware, request-response)

**Analog:** `apps/api/src/middleware/vendorAuth.ts` — near-exact copy

**Full analog** (lines 1-64 of vendorAuth.ts):
```typescript
import { jwtVerify } from "jose";
import type { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env.js";

export async function requireAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "Bearer token required" } });
  }
  const token = authHeader.slice(7);
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload["role"] !== "admin") {
      throw new Error("Token does not carry admin role.");
    }
    request.adminId = payload["sub"] as string;
    request.adminEmail = payload["email"] as string;
  } catch {
    return reply.status(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } });
  }
}
```

**Key difference from vendorAuth.ts line 44**: check `role !== "admin"` instead of `role !== "vendor"`. Set `request.adminId` and `request.adminEmail` instead of `request.vendorId`.

---

### `apps/api/src/routes/admin/auth.ts` (route, request-response)

**Analog:** `apps/api/src/routes/vendor/auth.ts` — exact structure

**Full plugin structure** (lines 1-84 of vendor/auth.ts):
```typescript
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { type AdminAuthService, InvalidCredentialsError } from "../../modules/admin-auth/index.js";

const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function adminAuthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post("/admin/auth/login", async (request, reply) => {
    const body = LoginInputSchema.parse(request.body);
    const adminAuthService = fastify.diContainer.resolve<AdminAuthService>("adminAuthService");
    try {
      const result = await adminAuthService.login(body.email, body.password);
      // Set httpOnly cookie (Phase 4 D-09 pattern)
      void reply.setCookie("admin_token", result.accessToken, {
        httpOnly: true, sameSite: "lax", path: "/",
        maxAge: result.expiresIn,
      });
      return reply.status(200).send({ success: true, data: { expiresIn: result.expiresIn } });
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return reply.status(401).send({ success: false, error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });
}
```

---

### `apps/api/src/routes/vendor/orders.ts` and new vendor routes pattern (route, CRUD)

**Analog:** `apps/api/src/routes/vendor/orders.ts` — exact preHandler + diContainer.resolve pattern

**Vendor preHandler guard** (lines 30-32 of vendor/orders.ts):
```typescript
export async function vendorXRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireVendorAuth);
  // All routes here are automatically guarded
}
```

**Role check for owner-only routes** (extends the base middleware with an additional role guard):
```typescript
fastify.addHook("preHandler", async (request, reply) => {
  await requireVendorAuth(request, reply);
  if (request.vendorUser?.role !== "owner") {
    return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Owner access required" } });
  }
});
```

**Service resolution pattern** (lines 34-43 of vendor/orders.ts):
```typescript
function getService(): SomeService {
  return fastify.diContainer.resolve<SomeService>("someService");
}
function getVendorId(request: FastifyRequest): string {
  if (!request.vendorId) throw new Error("requireVendorAuth must run before this handler");
  return request.vendorId;
}
```

**Error envelope** (lines 44-60 of vendor/orders.ts) — consistent response shape:
```typescript
return reply.send({ success: true, data: { orders } });
// Error:
return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "..." } });
```

---

### `apps/api/src/routes/admin/categories.ts` admin pattern (route, CRUD)

**Analog:** `apps/api/src/routes/admin/categories.ts`

**Admin guard preHandler** (lines 59-82 of admin/categories.ts) — ALL new admin routes replace the old `X-Internal-Admin-Token` placeholder with the real `requireAdminAuth` middleware:
```typescript
// PHASE 6: Replace the placeholder preHandler with real JWT middleware:
fastify.addHook("preHandler", requireAdminAuth);
// Remove all X-Internal-Admin-Token logic — it is now dead code.
```

**Zod body validation pattern** (lines 86-101 of admin/categories.ts):
```typescript
fastify.post("/admin/vendors", async (request, reply) => {
  const body = SomeInputSchema.parse(request.body);
  const service = fastify.diContainer.resolve<SomeService>("someService");
  try {
    const result = await service.doSomething(body);
    return reply.status(201).send({ success: true, data: result });
  } catch (err) {
    if (err instanceof KnownError) {
      return reply.status(422).send({ success: false, error: { code: err.code, message: err.message } });
    }
    throw err;
  }
});
```

---

### `apps/api/src/container.ts` (UPDATE — config)

**Analog:** `apps/api/src/container.ts` lines 68-99

**Registration pattern** (lines 71-99 of container.ts) — add Phase 6 services in a new `// Phase 6 services` block:
```typescript
// Phase 6 services (new — plan 06-xx)
adminAuthService: asClass(AdminAuthService).singleton(),
settingsService: asClass(SettingsService).singleton(),
auditService: asClass(AuditService).singleton(),
vendorManagementService: asClass(VendorManagementService).singleton(),
vendorStaffService: asClass(VendorStaffService).singleton(),
analyticsService: asClass(AnalyticsService).singleton(),
vendorProfileService: asClass(VendorProfileService).singleton(),
```

**Import additions** (lines 1-28 of container.ts) — follow the same grouping:
```typescript
// Phase 6 service imports
import { AdminAuthService } from "./modules/admin-auth/index.js";
import { SettingsService } from "./modules/settings/index.js";
import { AuditService } from "./modules/audit/index.js";
// ... etc
```

---

### `apps/web-vendor/src/lib/apiClient.ts` (utility, request-response)

**Analog:** `apps/web-storefront/src/lib/api-client.ts` — exact copy with renamed variable

**Full pattern** (lines 1-74 of api-client.ts):
```typescript
const BASE_URL: string =
  (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(`API request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      credentials: 'include',        // httpOnly cookie auth (D-09 pattern)
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<T>(res);
  },
  // ... post, patch, delete follow same pattern
};
```

**Critical:** `credentials: 'include'` on EVERY method — this is the httpOnly cookie pattern (lines 40-43, 46-53, 57-64, 67-72 of api-client.ts).

---

### `apps/web-admin/src/lib/apiClient.ts` (UPDATE — utility, request-response)

**Analog:** `apps/web-storefront/src/lib/api-client.ts`

**Lines to REMOVE** from existing `apps/web-admin/src/lib/apiClient.ts` (lines 21-26 and 71-73):
```typescript
// REMOVE these lines — they are the Phase 2 dev-only placeholder:
const ADMIN_TOKEN = import.meta.env['VITE_INTERNAL_ADMIN_TOKEN'] ?? '';
if (!ADMIN_TOKEN) { console.warn(...) }
// and: if (ADMIN_TOKEN) { headers['X-Internal-Admin-Token'] = ADMIN_TOKEN; }
```

**Lines to ADD** — `credentials: 'include'` on every fetch call (lines 37-43 of api-client.ts):
```typescript
const response = await fetch(url, {
  ...options,
  credentials: 'include',   // ADD: httpOnly cookie auth
  headers,
});
```

The existing `ApiError` class, `request()` wrapper, and `get/post/patch/put/del` helpers are kept — only the auth mechanism changes.

---

### `apps/web-vendor/src/lib/queryClient.ts` (utility)

**Analog:** `apps/web-storefront/src/lib/query-client.ts` — exact copy

**Full pattern** (lines 1-28 of query-client.ts):
```typescript
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './apiClient.js';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});
```

---

### `apps/web-vendor/src/stores/uiStore.ts` (store, event-driven)

**Analog:** `apps/web-storefront/src/store/ui-store.ts` — extend with sidebar state

**Base pattern** (lines 1-39 of ui-store.ts):
```typescript
import { create } from 'zustand';

interface UiState {
  filterDrawerOpen: boolean;         // keep for mobile sidebar
  setFilterDrawerOpen: (open: boolean) => void;
  toasts: Toast[];
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
}

export const useUiStore = create<UiState>((set) => ({ ... }));
```

**EXTEND for panel** — add sidebar collapsed state (Claude's Discretion):
```typescript
interface UiState {
  sidebarCollapsed: boolean;         // ADD: tablet/mobile sidebar collapse
  setSidebarCollapsed: (collapsed: boolean) => void;
  toasts: Toast[];
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
}
```

---

### `apps/web-vendor/src/stores/vendorAuthStore.ts` (store, request-response)

**Analog:** `apps/web-storefront/src/hooks/useAuth.ts` — adapt to Zustand store + session probe

**Session probe pattern** (lines 50-77 of useAuth.ts):
```typescript
// Session probe: GET /vendor/auth/me — 200 = authenticated, 401 = unauthenticated.
const { data: sessionData, isLoading } = useQuery({
  queryKey: ['vendorSession'],
  queryFn: async () => {
    try {
      const res = await apiClient.get<VendorProfileResponse>('/vendor/auth/me');
      return res.data;
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },
  staleTime: 1000 * 60 * 5,
  retry: false,
});
```

**Login mutation** (lines 84-94 of useAuth.ts):
```typescript
const loginMutation = useMutation({
  mutationFn: (input: LoginInput) =>
    apiClient.post<{ success: boolean; data: { expiresIn: number } }>('/vendor/auth/login', input),
  onSuccess: () => {
    void qc.invalidateQueries({ queryKey: ['vendorSession'] });
  },
});
```

**Zustand store for role-aware state** (extends ui-store pattern, lines 31-39 of ui-store.ts):
```typescript
interface VendorAuthState {
  vendorUser: VendorUser | null;
  setVendorUser: (user: VendorUser | null) => void;
  role: "owner" | "manager" | "staff" | null;
}
export const useVendorAuthStore = create<VendorAuthState>((set) => ({
  vendorUser: null,
  setVendorUser: (user) => set({ vendorUser: user, role: user?.role ?? null }),
  role: null,
}));
```

---

### `apps/web-vendor/src/components/layout/ProtectedVendorRoute.tsx` (component, request-response)

**Analog:** `apps/web-storefront/src/components/layout/ProtectedRoute.tsx` — extend with role prop

**Base pattern** (lines 1-38 of ProtectedRoute.tsx):
```typescript
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return null;  // Wait for session probe — prevents flash
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
```

**EXTEND for role check** (from RESEARCH.md Pattern 6):
```typescript
export function ProtectedVendorRoute({ requiredRole }: { requiredRole?: VendorRole }) {
  const { isAuthenticated, isLoading } = useVendorAuth();
  const { role } = useVendorAuthStore();
  const location = useLocation();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  if (requiredRole && !hasRole(role, requiredRole)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
```

---

### `apps/web-vendor/src/components/layout/PanelLayout.tsx` (component)

**Analog:** `apps/web-storefront/src/components/layout/AppLayout.tsx`

**AnimatePresence Outlet pattern** (lines 1-42 of AppLayout.tsx):
```typescript
import { AnimatePresence } from 'motion/react';  // web-vendor uses motion/react (App.tsx line 1 confirms)
import { Outlet, useLocation } from 'react-router-dom';

export function PanelLayout() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <AnimatePresence mode="wait">
            <div key={location.pathname}>
              <Outlet />
            </div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
```

**Note on imports:** `apps/web-vendor/src/App.tsx` line 1 uses `import { motion } from 'motion/react'` — the alias works. Use `import { AnimatePresence } from 'motion/react'` in web-vendor.

For `apps/web-admin` PanelLayout, use `import { AnimatePresence, motion } from 'framer-motion'` — confirmed by `apps/web-admin/src/App.tsx` line 1.

---

### `apps/web-vendor/src/router.tsx` (config)

**Analog:** `apps/web-storefront/src/router.tsx` — createBrowserRouter pattern

**Full createBrowserRouter pattern** (lines 54-116 of router.tsx):
```typescript
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PanelLayout } from './components/layout/PanelLayout.js';
import { ProtectedVendorRoute } from './components/layout/ProtectedVendorRoute.js';

export const router = createBrowserRouter([
  { path: '/auth/login', element: <LoginPage /> },
  { path: '/accept-invite', element: <AcceptInvitePage /> },
  {
    path: '/',
    element: <ProtectedVendorRoute />,
    children: [{
      element: <PanelLayout />,
      children: [
        { index: true, element: <Navigate to="/dashboard" replace /> },
        { path: 'dashboard', element: <DashboardPage /> },
        { path: 'products', element: <ProductsPage /> },
        { path: 'inventory', element: <InventoryPage /> },
        { path: 'orders', element: <OrdersPage /> },
        { path: 'returns', element: <ReturnsPage /> },
        { path: 'earnings', element: <EarningsPage /> },
        { path: 'coupons', element: <CouponsPage /> },
        { path: 'team', element: <TeamPage /> },
        { path: 'store-profile', element: <StoreProfilePage /> },
        { path: 'settings', element: <SettingsPage /> },
      ],
    }],
  },
]);
```

---

### `apps/web-admin/src/App.tsx` (UPDATE — config)

**Analog:** `apps/web-storefront/src/router.tsx` (migrate from `<Routes>` to `createBrowserRouter`)

**Current pattern to REPLACE** (lines 2-4 of App.tsx):
```typescript
// BEFORE: Phase 2 pattern
import { Navigate, Route, Routes } from 'react-router-dom';
// inline <Routes> inside App()
```

**New pattern** (from storefront router.tsx lines 54-56):
```typescript
// AFTER: Phase 6 pattern — createBrowserRouter with PanelLayout
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
export const router = createBrowserRouter([...]);
export default function App() { return <RouterProvider router={router} />; }
```

**Preserve existing category routes** — the existing `/categories` and `/categories/:id` routes from Phase 2 are kept and wrapped under the new `PanelLayout`. They must NOT be deleted.

---

### Admin panel pages pattern

**Analog:** `apps/web-admin/src/pages/categories/CategoryListPage.tsx`

**Imports pattern** (lines 1-14 of CategoryListPage.tsx):
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';  // web-admin uses framer-motion
import React, { useState } from 'react';
import { get, post, patch, del } from '../../lib/apiClient.js';
```

**Page entry animation** (lines 81-85 of CategoryListPage.tsx):
```typescript
return (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
  >
```

**Loading state** (lines 104-109 of CategoryListPage.tsx):
```typescript
{isLoading && (
  <div className="flex items-center justify-center py-16">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
  </div>
)}
```

**Error state** (lines 111-117 of CategoryListPage.tsx):
```typescript
{queryError && (
  <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
    Failed to load: {queryError instanceof Error ? queryError.message : 'Unknown error'}
  </div>
)}
```

**Empty state** (lines 123-131 of CategoryListPage.tsx):
```typescript
{data?.items?.length === 0 && (
  <div className="px-6 py-12 text-center text-sm text-grovio-text-muted">
    No items yet.
  </div>
)}
```

**Slide-over panel (modal)** (lines 139-248 of CategoryListPage.tsx) — AnimatePresence backdrop + slide from right:
```typescript
<AnimatePresence>
  {showPanel && (
    <>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-40 bg-black/30"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={() => setShowPanel(false)}
      />
      <motion.div
        key="panel"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-grovio-border bg-grovio-surface-raised shadow-xl"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
      >
        {/* form content */}
      </motion.div>
    </>
  )}
</AnimatePresence>
```

**Form input pattern** (lines 188-198 of CategoryListPage.tsx):
```typescript
<input
  type="text"
  className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:border-grovio-primary focus:outline-none"
/>
```

**Mutation submit button** (lines 236-241 of CategoryListPage.tsx):
```typescript
<button
  type="submit"
  disabled={mutation.isPending}
  className="flex-1 rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
>
  {mutation.isPending ? 'Saving…' : 'Save'}
</button>
```

---

## Shared Patterns

### Authentication Middleware (Backend)

**Source:** `apps/api/src/middleware/vendorAuth.ts`
**Apply to:** All `/vendor/*` route plugins (existing unchanged), all new `/admin/*` route plugins via `requireAdminAuth` (new middleware)

```typescript
// Vendor routes — existing (line 32 of vendor/orders.ts):
fastify.addHook("preHandler", requireVendorAuth);

// Admin routes — new (replaces X-Internal-Admin-Token placeholder):
fastify.addHook("preHandler", requireAdminAuth);
```

**Note:** The existing admin routes in `apps/api/src/routes/admin/categories.ts` use the `X-Internal-Admin-Token` placeholder preHandler. Phase 6 replaces that hook with `requireAdminAuth` in every admin route file (Pitfall 2 from RESEARCH.md).

### Error Envelope (Backend)

**Source:** `apps/api/src/routes/vendor/auth.ts` lines 44-59 and `apps/api/src/routes/admin/categories.ts` lines 86-101
**Apply to:** All new backend route handlers

```typescript
// Success:
return reply.status(200).send({ success: true, data: result });
return reply.status(201).send({ success: true, data: created });
return reply.send({ success: true, data: null });  // for void returns

// Error:
return reply.status(401).send({ success: false, error: { code: err.code, message: err.message } });
return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "..." } });
return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "..." } });
```

### DI Service Resolution (Backend)

**Source:** `apps/api/src/routes/vendor/orders.ts` lines 34-43
**Apply to:** All route plugin handlers

```typescript
function getService(): SomeService {
  return fastify.diContainer.resolve<SomeService>("someService");
}
```

### Redis-First Cache Pattern (Backend)

**Source:** `apps/api/src/modules/feature-flags/FeatureFlagService.ts` lines 39-87
**Apply to:** `SettingsService`, any new service that reads frequently-changing config

```typescript
// Read: check Redis first, fall back to DB, populate cache
const cached = await redis.get(redisKey);
if (cached !== null) return JSON.parse(cached);
const rows = await db.select().from(table).where(...).limit(1);
if (!rows[0]) return null;
await redis.setex(redisKey, env.FEATURE_FLAG_TTL_SECONDS, JSON.stringify(rows[0].value));
return rows[0].value;

// Write: update DB first, then invalidate cache
await db.update(table).set({...}).where(...);
await redis.del(redisKey);
```

### Append-Only Insert (Backend)

**Source:** `apps/api/src/db/schema/wallet-entries.ts` (table design) + `apps/api/src/modules/commissions/CommissionService.ts` (insert pattern)
**Apply to:** `vendor_payouts` inserts, `audit_log` inserts

```typescript
// INSERT only — never UPDATE existing rows
await db.insert(vendorPayouts).values({
  id: crypto.randomUUID(),
  vendorId,
  amountMinor,           // BIGINT — never float
  settlementReference,
  settledByAdminEmail,
  settledAt: new Date(),
  createdAt: new Date(),
  // NO updatedAt — intentionally absent
});
```

### Zod Body Validation (Backend)

**Source:** `apps/api/src/routes/vendor/auth.ts` lines 25-32 and `apps/api/src/routes/admin/categories.ts` lines 86-88
**Apply to:** All route handlers with a request body

```typescript
const InputSchema = z.object({ ... });
// In handler:
const body = InputSchema.parse(request.body);  // throws ZodError → 400
```

### Page Entry Animation (Frontend)

**Source:** `apps/web-admin/src/pages/categories/CategoryListPage.tsx` lines 81-85
**Apply to:** All new admin and vendor panel pages (root return element)

```typescript
return (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
  >
    {/* page content */}
  </motion.div>
);
```

### React Query Data Fetching (Frontend)

**Source:** `apps/web-admin/src/pages/categories/CategoryListPage.tsx` lines 36-53
**Apply to:** All panel pages with server data

```typescript
const { data, isLoading, error: queryError } = useQuery({
  queryKey: ['resourceName', optionalParam],
  queryFn: () => get<ResponseType>('/endpoint'),
});

const mutation = useMutation({
  mutationFn: (body: InputType) => post<ResultType>('/endpoint', body),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['resourceName'] });
  },
  onError: (err: unknown) => {
    setError(err instanceof Error ? err.message : 'Unknown error');
  },
});
```

### Tailwind CSS Design Token Usage (Frontend)

**Source:** `apps/web-admin/src/pages/categories/CategoryListPage.tsx` throughout
**Apply to:** All new frontend components

Key tokens used consistently:
- `bg-grovio-surface` / `bg-grovio-surface-raised` — backgrounds
- `border-grovio-border` — borders
- `text-grovio-text` / `text-grovio-text-muted` — typography
- `bg-grovio-primary` / `text-white` — primary action buttons
- `text-grovio-error` / `bg-grovio-error/10` / `border-grovio-error/20` — error states

---

## Special Notes

### Motion Import Inconsistency

- `apps/web-vendor/src/App.tsx` line 1: `import { motion } from 'motion/react'` — confirmed working
- `apps/web-admin/src/App.tsx` line 1: `import { motion } from 'framer-motion'` — confirmed working
- `apps/web-vendor/vite.config.ts`: NO `motion/react` alias configured — but `apps/web-vendor/src/App.tsx` already imports from `'motion/react'` and the app runs (port 5175). The alias is NOT needed because `motion/react` is an actual export path of the `framer-motion` package at v12. Both import paths work.
- **Conclusion for planner:** web-vendor pages use `import { ... } from 'motion/react'`; web-admin pages use `import { ... } from 'framer-motion'`.

### react-router-dom Missing from web-vendor

`apps/web-vendor/package.json` does NOT include `react-router-dom`. The planner must add it as a Wave 0 task before any routing code is written. It is already installed workspace-wide at `7.16.0`.

### vendor_users Migration — JWT Sub Change

All existing Phase 3/4/5 vendor route handlers that read `request.vendorId` from the JWT currently receive `vendors.id`. After the Phase 6 migration, the JWT `sub` will be `vendor_users.id` and the `vendorId` claim will carry `vendors.id`. The `requireVendorAuth` middleware sets `request.vendorId` from the JWT `vendorId` claim — this MUST remain the FK to `vendors.id` after migration. The migration changes VendorAuthService JWT issuance only; all existing ownership checks using `request.vendorId` as a FK to `vendors.id` remain valid as long as the middleware extracts `payload["vendorId"]` (not `payload["sub"]`).

### Admin apiClient Must Be Updated First

`apps/web-admin/src/lib/apiClient.ts` uses `X-Internal-Admin-Token` header. This MUST be updated to `credentials: 'include'` before any admin panel page makes API calls against Phase 6 protected endpoints. This is a Wave 0 prerequisite for all admin panel page work.

---

## No Analog Found

All files have analogs. No entries for this section.

---

## Metadata

**Analog search scope:** `apps/api/src/`, `apps/web-storefront/src/`, `apps/web-admin/src/`, `apps/web-vendor/src/`
**Files scanned:** 28 source files read directly
**Pattern extraction date:** 2026-06-04
