import { describe, expect, it, vi } from "vitest";
import type { SelectAttributeDefinition, SelectFilterSchemaDefinition } from "../../db/schema/index.js";
import type { FilterSchemaDef } from "@grovio/contracts";
import { FilterSchemaService } from "./FilterSchemaService.js";

// ---------------------------------------------------------------------------
// Redis mock factory
// ---------------------------------------------------------------------------

/**
 * Build a minimal Redis mock with only the methods FilterSchemaService uses.
 * Each test that expects cache invalidation asserts redis.del was called.
 */
function makeRedisMock() {
  return {
    del: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue("OK"),
  };
}

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Build a DB mock for attribute lookup: select().from().where().limit()
 * Resolves to `rows` when awaited.
 */
function makeAttrLookupDbMock(attrRows: Partial<SelectAttributeDefinition>[]) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(attrRows),
        }),
      }),
    }),
  };
}

/**
 * Build a DB mock for the getFilterSchema join query.
 * select().from().innerJoin().where().orderBy() — resolves to joinedRows.
 */
function makeJoinDbMock(joinedRows: Array<{
  fsd_id: string;
  fsd_category_id: string;
  fsd_attribute_def_id: string;
  fsd_display_type: string;
  fsd_sort_order: number;
  ad_key: string;
  ad_label: string;
  ad_attr_type: string;
  ad_options: Array<{ value: string; label: string }> | null;
}>) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(joinedRows),
          }),
        }),
      }),
    }),
  };
}

/**
 * Build a combined DB mock that supports:
 * - select().from().where().limit() for attribute lookup
 * - select().from().innerJoin().where().orderBy() for filter schema join
 * - insert().values().returning() for filter entry insert
 * - delete().where() for filter entry deletion
 * - update().set().where().returning() for filter entry update
 */
function makeFullDbMock(opts: {
  attrRows?: Partial<SelectAttributeDefinition>[];
  joinedRows?: unknown[];
  insertResult?: unknown[];
  deleteResult?: unknown[];
}) {
  let selectCallCount = 0;

  const db = {
    select: vi.fn().mockImplementation(() => {
      selectCallCount++;
      const callNum = selectCallCount;

      if (callNum === 1 && opts.attrRows !== undefined) {
        // First select = attribute lookup
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(opts.attrRows),
              orderBy: vi.fn().mockResolvedValue(opts.attrRows),
            }),
          }),
        };
      }

      // Other selects = join query for getFilterSchema
      return {
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(opts.joinedRows ?? []),
            }),
          }),
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(opts.attrRows ?? []),
            orderBy: vi.fn().mockResolvedValue(opts.attrRows ?? []),
          }),
        }),
      };
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(opts.insertResult ?? []),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(opts.deleteResult ?? []),
    }),
  };

  return db;
}

/**
 * Build a DB mock that supports removeFilterEntry's two-step pattern:
 * 1. select().from().where().limit() — for pre-delete entry lookup
 * 2. delete().where().returning() — for the actual delete
 */
function makeRemoveEntryDbMock(
  entryRow: Partial<SelectFilterSchemaDefinition> | null,
  deleteResult: SelectFilterSchemaDefinition | null = entryRow as SelectFilterSchemaDefinition | null
) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(entryRow ? [entryRow] : []),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(deleteResult ? [deleteResult] : []),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const filterableAttr: Partial<SelectAttributeDefinition> = {
  id: "attr-uuid-1",
  categoryId: "cat-uuid-1",
  key: "color",
  label: "Color",
  attrType: "enum",
  options: [{ value: "red", label: "Red" }],
  isFilterable: true,
};

const nonFilterableAttr: Partial<SelectAttributeDefinition> = {
  id: "attr-uuid-2",
  categoryId: "cat-uuid-1",
  key: "description",
  label: "Description",
  attrType: "text",
  options: null,
  isFilterable: false,
};

const joinedFilterRow = {
  fsd_id: "fsd-uuid-1",
  fsd_category_id: "cat-uuid-1",
  fsd_attribute_def_id: "attr-uuid-1",
  fsd_display_type: "checkbox",
  fsd_sort_order: 0,
  ad_key: "color",
  ad_label: "Color",
  ad_attr_type: "enum",
  ad_options: [{ value: "red", label: "Red" }],
};

const filterSchemaEntry: SelectFilterSchemaDefinition = {
  id: "fsd-uuid-1",
  categoryId: "cat-uuid-1",
  attributeDefId: "attr-uuid-1",
  displayType: "checkbox",
  sortOrder: 0,
  createdAt: new Date("2025-01-01T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FilterSchemaService", () => {
  // -------------------------------------------------------------------------
  describe("upsertFilterEntry — is_filterable gate (CAT-04, T-02-10)", () => {
    it("throws when referenced attribute has is_filterable=false", async () => {
      const db = makeAttrLookupDbMock([nonFilterableAttr]);
      const redis = makeRedisMock();
      const svc = new FilterSchemaService({ db: db as never, redis: redis as never });

      await expect(
        svc.upsertFilterEntry({
          categoryId: "cat-uuid-1",
          attributeDefId: "attr-uuid-2",
          displayType: "checkbox",
          sortOrder: 0,
        })
      ).rejects.toThrow(/not filterable|is_filterable/i);

      // Cache should NOT be invalidated on rejected writes.
      expect(redis.del).not.toHaveBeenCalled();
    });

    it("succeeds when referenced attribute has is_filterable=true", async () => {
      const insertedRow = filterSchemaEntry;

      const db = makeFullDbMock({
        attrRows: [filterableAttr],
        insertResult: [insertedRow],
      });
      const redis = makeRedisMock();
      const svc = new FilterSchemaService({ db: db as never, redis: redis as never });

      const result = await svc.upsertFilterEntry({
        categoryId: "cat-uuid-1",
        attributeDefId: "attr-uuid-1",
        displayType: "checkbox",
        sortOrder: 0,
      });

      expect(result).toEqual(insertedRow);
      expect(db.insert).toHaveBeenCalledOnce();
    });

    it("invalidates category_filter_schema:{categoryId} after successful upsert", async () => {
      const insertedRow = filterSchemaEntry;

      const db = makeFullDbMock({
        attrRows: [filterableAttr],
        insertResult: [insertedRow],
      });
      const redis = makeRedisMock();
      const svc = new FilterSchemaService({ db: db as never, redis: redis as never });

      await svc.upsertFilterEntry({
        categoryId: "cat-uuid-1",
        attributeDefId: "attr-uuid-1",
        displayType: "checkbox",
        sortOrder: 0,
      });

      expect(redis.del).toHaveBeenCalledOnce();
      expect(redis.del).toHaveBeenCalledWith("category_filter_schema:cat-uuid-1");
    });
  });

  // -------------------------------------------------------------------------
  describe("replaceFilterSchema — cache invalidation (Pitfall 6, T-03-G2)", () => {
    it("invalidates category_filter_schema:{categoryId} after replace", async () => {
      const db = makeFullDbMock({
        attrRows: [filterableAttr],
        insertResult: [filterSchemaEntry],
        deleteResult: [],
      });
      const redis = makeRedisMock();
      const svc = new FilterSchemaService({ db: db as never, redis: redis as never });

      await svc.replaceFilterSchema("cat-uuid-1", [
        {
          categoryId: "cat-uuid-1",
          attributeDefId: "attr-uuid-1",
          displayType: "checkbox",
        },
      ]);

      expect(redis.del).toHaveBeenCalledOnce();
      expect(redis.del).toHaveBeenCalledWith("category_filter_schema:cat-uuid-1");
    });
  });

  // -------------------------------------------------------------------------
  describe("getFilterSchema — join query (CAT-04)", () => {
    it("returns filter entries joined with attribute key/label/attrType/options", async () => {
      const db = makeJoinDbMock([joinedFilterRow]);
      const redis = makeRedisMock();
      const svc = new FilterSchemaService({ db: db as never, redis: redis as never });

      const result = await svc.getFilterSchema("cat-uuid-1");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "fsd-uuid-1",
        categoryId: "cat-uuid-1",
        attributeDefId: "attr-uuid-1",
        attribute: {
          key: "color",
          label: "Color",
          attrType: "enum",
          options: [{ value: "red", label: "Red" }],
        },
        displayType: "checkbox",
        sortOrder: 0,
      } satisfies FilterSchemaDef);
    });

    it("returns entries ordered by sortOrder (innerJoin query uses orderBy)", async () => {
      const row1 = { ...joinedFilterRow, fsd_sort_order: 0 };
      const row2 = {
        ...joinedFilterRow,
        fsd_id: "fsd-uuid-2",
        fsd_attribute_def_id: "attr-uuid-3",
        fsd_sort_order: 1,
        ad_key: "size",
        ad_label: "Size",
        ad_attr_type: "enum",
        ad_options: null,
      };
      const db = makeJoinDbMock([row1, row2]);
      const redis = makeRedisMock();
      const svc = new FilterSchemaService({ db: db as never, redis: redis as never });

      const result = await svc.getFilterSchema("cat-uuid-1");

      expect(result).toHaveLength(2);
      expect(result[0]?.sortOrder).toBe(0);
      expect(result[1]?.sortOrder).toBe(1);
    });

    it("does NOT call redis.del on a read-only getFilterSchema call", async () => {
      const db = makeJoinDbMock([joinedFilterRow]);
      const redis = makeRedisMock();
      const svc = new FilterSchemaService({ db: db as never, redis: redis as never });

      await svc.getFilterSchema("cat-uuid-1");

      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe("removeFilterEntry — cache invalidation (Pitfall 6, T-03-G2)", () => {
    it("invalidates cache using the deleted entry's categoryId", async () => {
      const db = makeRemoveEntryDbMock(filterSchemaEntry);
      const redis = makeRedisMock();
      const svc = new FilterSchemaService({ db: db as never, redis: redis as never });

      const result = await svc.removeFilterEntry("fsd-uuid-1");

      expect(result).toEqual(filterSchemaEntry);
      expect(redis.del).toHaveBeenCalledOnce();
      expect(redis.del).toHaveBeenCalledWith("category_filter_schema:cat-uuid-1");
    });

    it("returns null and does not invalidate cache when entry not found", async () => {
      const db = makeRemoveEntryDbMock(null);
      const redis = makeRedisMock();
      const svc = new FilterSchemaService({ db: db as never, redis: redis as never });

      const result = await svc.removeFilterEntry("nonexistent-id");

      expect(result).toBeNull();
      expect(redis.del).not.toHaveBeenCalled();
    });
  });
});
