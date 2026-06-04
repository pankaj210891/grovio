import { describe, expect, it, vi } from "vitest";
import type { SelectAuditLog } from "../../db/schema/index.js";
import type { AuditLogEntry, AuditLogQuery } from "@grovio/contracts/admin/audit";
import { AuditService } from "./AuditService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Build a Drizzle mock that supports:
 * - db.insert(table).values({...})           → append-only log()
 * - db.select().from().where(...).orderBy(...).limit(...).offset(...)  → items query
 * - db.select({count: ...}).from().where(...)  → total count query
 *
 * query() calls db.select twice via Promise.all:
 *   1st call: count query  → [{ count: total }]
 *   2nd call: data query   → rows
 */
function makeDbMock(rows: SelectAuditLog[], total = rows.length) {
  // Capture inserted values for assertion
  const insertedValues: unknown[] = [];

  const insertChain = {
    values: vi.fn().mockImplementation((vals: unknown) => {
      insertedValues.push(vals);
      return Promise.resolve([]);
    }),
  };

  // Count select chain: .from().where() → resolves to [{ count: N }]
  const countChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ count: total }]),
    }),
  };

  // Data select chain: .from().where().orderBy().limit().offset() → resolves to rows
  const dataChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    }),
  };

  const db = {
    insert: vi.fn().mockReturnValue(insertChain),
    // First select call = count query, second = data query
    select: vi.fn()
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(dataChain)
      // For insert-only tests, provide fallback to avoid exhausted mock errors
      .mockReturnValue(dataChain),
    _insertedValues: insertedValues,
  };
  return db;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const now = new Date("2026-06-01T12:00:00Z");

const baseAuditRow: SelectAuditLog = {
  id: "audit-uuid-1",
  actorType: "admin",
  actorId: "admin-uuid-1",
  actorEmail: "admin@example.com",
  action: "vendor.approved",
  entityType: "vendor",
  entityId: "vendor-uuid-1",
  before: null,
  after: { onboarding_status: "approved" },
  ipAddress: "127.0.0.1",
  createdAt: now,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AuditService", () => {
  // -------------------------------------------------------------------------
  describe("log()", () => {
    it("inserts exactly one audit_log row with all required fields", async () => {
      const db = makeDbMock([]);

      const svc = new AuditService({ db: db as never });
      await svc.log({
        actorType: "admin",
        actorId: "admin-uuid-1",
        actorEmail: "admin@example.com",
        action: "vendor.approved",
        entityType: "vendor",
        entityId: "vendor-uuid-1",
        before: null,
        after: { onboarding_status: "approved" },
        ipAddress: "127.0.0.1",
      });

      expect(db.insert).toHaveBeenCalledOnce();
      const valuesChain = db.insert.mock.results[0].value;
      expect(valuesChain.values).toHaveBeenCalledOnce();

      const insertedRow = (db._insertedValues[0] as Record<string, unknown>);
      expect(insertedRow).toMatchObject({
        actorType: "admin",
        actorId: "admin-uuid-1",
        actorEmail: "admin@example.com",
        action: "vendor.approved",
        entityType: "vendor",
        entityId: "vendor-uuid-1",
        ipAddress: "127.0.0.1",
      });
    });

    it("stores before/after as JSONB values when provided", async () => {
      const db = makeDbMock([]);

      const svc = new AuditService({ db: db as never });
      await svc.log({
        actorType: "vendor",
        actorId: "vendor-user-uuid-1",
        actorEmail: "vendor@example.com",
        action: "product.updated",
        entityType: "product",
        entityId: "product-uuid-1",
        before: { price: 100 },
        after: { price: 200 },
      });

      const insertedRow = (db._insertedValues[0] as Record<string, unknown>);
      expect(insertedRow["before"]).toEqual({ price: 100 });
      expect(insertedRow["after"]).toEqual({ price: 200 });
    });

    it("stores null for before/after when omitted", async () => {
      const db = makeDbMock([]);

      const svc = new AuditService({ db: db as never });
      await svc.log({
        actorType: "system",
        actorId: "inventory-expiry-job",
        actorEmail: "system@internal",
        action: "inventory.released",
        entityType: "inventory_reservation",
        entityId: "reservation-uuid-1",
      });

      const insertedRow = (db._insertedValues[0] as Record<string, unknown>);
      expect(insertedRow["before"]).toBeNull();
      expect(insertedRow["after"]).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe("AuditService has NO update method", () => {
    it("does not expose any method that could issue an UPDATE", () => {
      const db = makeDbMock([]);
      const svc = new AuditService({ db: db as never });

      // The service must not have any method name suggesting update/modify
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(svc)).filter(
        (m) => m !== "constructor",
      );
      const updateMethods = methods.filter((m) =>
        /update|modify|edit|set|patch/i.test(m),
      );
      expect(updateMethods).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("query()", () => {
    it("returns items and total with offset pagination", async () => {
      const db = makeDbMock([baseAuditRow], 1);

      const svc = new AuditService({ db: db as never });
      const result = await svc.query({ limit: 50, offset: 0 });

      expect(result.total).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.id).toBe("audit-uuid-1");
    });

    it("defaults limit to 50 and offset to 0 when not specified", async () => {
      const db = makeDbMock([]);

      const svc = new AuditService({ db: db as never });
      const result = await svc.query({});

      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it("returns empty items and total 0 when no rows match", async () => {
      const db = makeDbMock([], 0);

      const svc = new AuditService({ db: db as never });
      const result = await svc.query({ actorType: "admin" });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("deps interface", () => {
    it("does not require redis in deps — AuditService is append-only with no caching", () => {
      // If this compiles and runs, the AuditService accepts { db } without redis
      const db = makeDbMock([]);
      // Should not throw — redis is not in deps
      const svc = new AuditService({ db: db as never });
      expect(svc).toBeInstanceOf(AuditService);
    });
  });
});
