import { describe, expect, it, vi } from "vitest";
import type { SelectAttributeDefinition } from "../../db/schema/index.js";
import { AttributeDefinitionService } from "./AttributeDefinitionService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Build a chainable Drizzle query mock for select().from().where().orderBy().
 * Resolves to `rows` when awaited.
 */
function makeDbMock(rows: SelectAttributeDefinition[]) {
  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(rows),
          limit: vi.fn().mockResolvedValue(rows),
          then: (resolve: (v: SelectAttributeDefinition[]) => void) =>
            resolve(rows),
          catch: vi.fn(),
          finally: vi.fn(),
        }),
      }),
    }),
  };
  return db;
}

/**
 * Build a chainable Drizzle insert mock: insert().values().returning().
 * Resolves returning() with [returnRow].
 */
function makeInsertDbMock(returnRow: SelectAttributeDefinition) {
  const insertChain = {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([returnRow]),
    }),
  };
  return { insert: vi.fn().mockReturnValue(insertChain) };
}

/**
 * Build a mock that supports:
 * - select().from().where().limit() for updateAttribute's current-row load
 * - update().set().where().returning() for the actual update write
 *
 * currentRow is the row returned by the initial select (the "before" state).
 * updatedRow is the row returned by the update returning() (the "after" state).
 */
function makeUpdateDbMock(
  currentRow: SelectAttributeDefinition | null,
  updatedRow: SelectAttributeDefinition | null = currentRow
) {
  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(currentRow ? [currentRow] : []),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue(updatedRow ? [updatedRow] : []),
        }),
      }),
    }),
  };
  return db;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const baseAttr: SelectAttributeDefinition = {
  id: "attr-uuid-1",
  categoryId: "cat-uuid-1",
  key: "material",
  label: "Material",
  attrType: "text",
  options: null,
  isRequired: false,
  isFilterable: false,
  isSearchable: false,
  isVariant: false,
  sortOrder: 0,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

const enumAttr: SelectAttributeDefinition = {
  ...baseAttr,
  id: "attr-uuid-2",
  key: "size",
  label: "Size",
  attrType: "enum",
  options: [
    { value: "S", label: "Small" },
    { value: "M", label: "Medium" },
  ],
};

const multiSelectAttr: SelectAttributeDefinition = {
  ...baseAttr,
  id: "attr-uuid-3",
  key: "color",
  label: "Color",
  attrType: "multi_select",
  options: [{ value: "red", label: "Red" }],
};

/** Attribute that already has isVariant=true (simulates an existing variant axis row). */
const variantAttr: SelectAttributeDefinition = {
  ...baseAttr,
  id: "attr-uuid-5",
  key: "size",
  label: "Size",
  attrType: "enum",
  options: [{ value: "S", label: "Small" }],
  isVariant: true,
  isFilterable: false,
};

/** Attribute that already has isFilterable=true (simulates an existing filterable row). */
const filterableAttr: SelectAttributeDefinition = {
  ...baseAttr,
  id: "attr-uuid-6",
  key: "brand",
  label: "Brand",
  attrType: "enum",
  options: [{ value: "nike", label: "Nike" }],
  isVariant: false,
  isFilterable: true,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AttributeDefinitionService", () => {
  // -------------------------------------------------------------------------
  describe("createAttribute — options validation (CAT-03, D-05, D-07)", () => {
    it('throws when attrType is "enum" and options is empty', async () => {
      const db = makeInsertDbMock(enumAttr);
      const svc = new AttributeDefinitionService({ db: db as never });

      await expect(
        svc.createAttribute({
          categoryId: "cat-uuid-1",
          key: "size",
          label: "Size",
          attrType: "enum",
          options: [],
        })
      ).rejects.toThrow(/enum.*requires at least one option/i);
    });

    it('throws when attrType is "enum" and options is undefined', async () => {
      const db = makeInsertDbMock(enumAttr);
      const svc = new AttributeDefinitionService({ db: db as never });

      await expect(
        svc.createAttribute({
          categoryId: "cat-uuid-1",
          key: "size",
          label: "Size",
          attrType: "enum",
        })
      ).rejects.toThrow(/enum.*requires at least one option/i);
    });

    it('throws when attrType is "multi_select" and options is undefined', async () => {
      const db = makeInsertDbMock(multiSelectAttr);
      const svc = new AttributeDefinitionService({ db: db as never });

      await expect(
        svc.createAttribute({
          categoryId: "cat-uuid-1",
          key: "color",
          label: "Color",
          attrType: "multi_select",
        })
      ).rejects.toThrow(/multi_select.*requires at least one option/i);
    });

    it('throws when attrType is "boolean" and options is provided (non-null)', async () => {
      const db = makeInsertDbMock(baseAttr);
      const svc = new AttributeDefinitionService({ db: db as never });

      await expect(
        svc.createAttribute({
          categoryId: "cat-uuid-1",
          key: "in_stock",
          label: "In Stock",
          attrType: "boolean",
          options: [{ value: "yes", label: "Yes" }],
        })
      ).rejects.toThrow(/boolean.*must not have options/i);
    });

    it('succeeds when attrType is "text" and no options are provided', async () => {
      const db = makeInsertDbMock(baseAttr);
      const svc = new AttributeDefinitionService({ db: db as never });

      const result = await svc.createAttribute({
        categoryId: "cat-uuid-1",
        key: "material",
        label: "Material",
        attrType: "text",
      });

      expect(result).toEqual(baseAttr);
      expect(db.insert).toHaveBeenCalledOnce();
    });

    it('succeeds when attrType is "enum" and a non-empty options array is provided', async () => {
      const db = makeInsertDbMock(enumAttr);
      const svc = new AttributeDefinitionService({ db: db as never });

      const result = await svc.createAttribute({
        categoryId: "cat-uuid-1",
        key: "size",
        label: "Size",
        attrType: "enum",
        options: [
          { value: "S", label: "Small" },
          { value: "M", label: "Medium" },
        ],
      });

      expect(result).toEqual(enumAttr);
      expect(db.insert).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  describe(
    "createAttribute — is_variant/is_filterable mutual exclusivity (D-02, Pitfall 5, T-03-G1)",
    () => {
      it("throws when isVariant=true AND isFilterable=true (both set)", async () => {
        const db = makeInsertDbMock(baseAttr);
        const svc = new AttributeDefinitionService({ db: db as never });

        await expect(
          svc.createAttribute({
            categoryId: "cat-uuid-1",
            key: "size",
            label: "Size",
            attrType: "text",
            isVariant: true,
            isFilterable: true,
          })
        ).rejects.toThrow(/is_variant.*is_filterable|variant.*filter facet/i);
      });

      it("succeeds when isVariant=true and isFilterable is not set (defaults false)", async () => {
        const variantOnlyAttr: SelectAttributeDefinition = {
          ...baseAttr,
          isVariant: true,
          isFilterable: false,
        };
        const db = makeInsertDbMock(variantOnlyAttr);
        const svc = new AttributeDefinitionService({ db: db as never });

        const result = await svc.createAttribute({
          categoryId: "cat-uuid-1",
          key: "size",
          label: "Size",
          attrType: "text",
          isVariant: true,
        });

        expect(result).toEqual(variantOnlyAttr);
        expect(db.insert).toHaveBeenCalledOnce();
      });

      it("succeeds when isFilterable=true and isVariant is not set (defaults false)", async () => {
        const filterableOnlyAttr: SelectAttributeDefinition = {
          ...baseAttr,
          isVariant: false,
          isFilterable: true,
        };
        const db = makeInsertDbMock(filterableOnlyAttr);
        const svc = new AttributeDefinitionService({ db: db as never });

        const result = await svc.createAttribute({
          categoryId: "cat-uuid-1",
          key: "brand",
          label: "Brand",
          attrType: "text",
          isFilterable: true,
        });

        expect(result).toEqual(filterableOnlyAttr);
        expect(db.insert).toHaveBeenCalledOnce();
      });
    }
  );

  // -------------------------------------------------------------------------
  describe(
    "updateAttribute — is_variant/is_filterable mutual exclusivity on merged values (D-02, Pitfall 5)",
    () => {
      it("throws when setting isFilterable=true on an attribute that already has isVariant=true", async () => {
        // Current row: isVariant=true, isFilterable=false
        const db = makeUpdateDbMock(variantAttr);
        const svc = new AttributeDefinitionService({ db: db as never });

        await expect(
          svc.updateAttribute("attr-uuid-5", { isFilterable: true })
        ).rejects.toThrow(/is_variant.*is_filterable|variant.*filter facet/i);
      });

      it("throws when setting isVariant=true on an attribute that already has isFilterable=true", async () => {
        // Current row: isFilterable=true, isVariant=false
        const db = makeUpdateDbMock(filterableAttr);
        const svc = new AttributeDefinitionService({ db: db as never });

        await expect(
          svc.updateAttribute("attr-uuid-6", { isVariant: true })
        ).rejects.toThrow(/is_variant.*is_filterable|variant.*filter facet/i);
      });

      it("returns null (not throws) when the attribute is not found", async () => {
        const db = makeUpdateDbMock(null);
        const svc = new AttributeDefinitionService({ db: db as never });

        const result = await svc.updateAttribute("nonexistent-id", {
          label: "New Label",
        });

        expect(result).toBeNull();
      });

      it("succeeds when setting isVariant=false on an attribute that has isFilterable=true", async () => {
        // No conflict: incoming isVariant=false, current isFilterable=true
        const updatedRow: SelectAttributeDefinition = {
          ...filterableAttr,
          isVariant: false,
        };
        const db = makeUpdateDbMock(filterableAttr, updatedRow);
        const svc = new AttributeDefinitionService({ db: db as never });

        const result = await svc.updateAttribute("attr-uuid-6", {
          isVariant: false,
        });

        expect(result).toEqual(updatedRow);
      });
    }
  );

  // -------------------------------------------------------------------------
  describe("getAttributesByCategory — ordering (CAT-03)", () => {
    it("returns rows ordered by sortOrder asc for the given categoryId", async () => {
      const attr1: SelectAttributeDefinition = { ...baseAttr, sortOrder: 0 };
      const attr2: SelectAttributeDefinition = {
        ...baseAttr,
        id: "attr-uuid-4",
        sortOrder: 1,
      };
      const db = makeDbMock([attr1, attr2]);
      const svc = new AttributeDefinitionService({ db: db as never });

      const result = await svc.getAttributesByCategory("cat-uuid-1");

      expect(result).toEqual([attr1, attr2]);
      expect(db.select).toHaveBeenCalledOnce();
    });
  });
});
