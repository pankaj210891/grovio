import { describe, expect, it, vi } from "vitest";
import type { SelectProductTemplate } from "../../db/schema/index.js";
import { ProductTemplateService } from "./ProductTemplateService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Build a chainable Drizzle SELECT mock.
 * ProductTemplateService uses:
 *   db.select().from().where().limit(1)   ← getTemplate
 */
function makeSelectDbMock(rows: SelectProductTemplate[]) {
  const chain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
  return { select: vi.fn().mockReturnValue(chain) };
}

/**
 * Build a Drizzle INSERT + ON CONFLICT mock for upsertTemplate.
 * ProductTemplateService uses:
 *   db.insert(productTemplates).values(...).onConflictDoUpdate({ target, set }).returning()
 */
function makeUpsertDbMock(returnRow: SelectProductTemplate) {
  const insertChain = {
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([returnRow]),
      }),
    }),
  };
  return {
    ...makeSelectDbMock([]),
    insert: vi.fn().mockReturnValue(insertChain),
  };
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const categoryId = "cat-uuid-1";

const templateRow: SelectProductTemplate = {
  id: "tpl-uuid-1",
  categoryId,
  templateFields: [
    { key: "color", default: "red", hint: "Choose product color" },
    { key: "size", hint: "Enter size in cm" },
  ],
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests — CAT-05
// ---------------------------------------------------------------------------

describe("ProductTemplateService", () => {
  // ── getTemplate ────────────────────────────────────────────────────────────

  describe("getTemplate", () => {
    it("returns null when no template row exists for the category", async () => {
      const db = makeSelectDbMock([]); // empty result → no row for this category
      const svc = new ProductTemplateService({ db: db as never });
      const result = await svc.getTemplate(categoryId);

      expect(result).toBeNull();
      expect(db.select).toHaveBeenCalledOnce();
    });

    it("returns the stored template when a row exists", async () => {
      const db = makeSelectDbMock([templateRow]);
      const svc = new ProductTemplateService({ db: db as never });
      const result = await svc.getTemplate(categoryId);

      expect(result).not.toBeNull();
      expect(result!.categoryId).toBe(categoryId);
      expect(result!.templateFields).toHaveLength(2);
      expect(result!.templateFields[0]!.key).toBe("color");
    });
  });

  // ── upsertTemplate ─────────────────────────────────────────────────────────

  describe("upsertTemplate", () => {
    it("upserts and round-trips templateFields JSONB", async () => {
      const fields = [{ key: "material", default: "wood", hint: "Material type" }];
      const updatedRow: SelectProductTemplate = {
        ...templateRow,
        templateFields: fields,
      };

      const db = makeUpsertDbMock(updatedRow);
      const svc = new ProductTemplateService({ db: db as never });
      const result = await svc.upsertTemplate(categoryId, fields);

      expect(result.categoryId).toBe(categoryId);
      expect(result.templateFields).toHaveLength(1);
      expect(result.templateFields[0]!.key).toBe("material");
      // insert was called (upsert path)
      expect(db.insert).toHaveBeenCalledOnce();
    });

    it("upsert overwrites existing template fields on second call (one template per category)", async () => {
      const newFields = [{ key: "brand", hint: "Manufacturer brand" }];
      const secondRow: SelectProductTemplate = {
        ...templateRow,
        templateFields: newFields,
      };

      const db = makeUpsertDbMock(secondRow);
      const svc = new ProductTemplateService({ db: db as never });
      const result = await svc.upsertTemplate(categoryId, newFields);

      // Only the new fields should be on the returned template
      expect(result.templateFields).toHaveLength(1);
      expect(result.templateFields[0]!.key).toBe("brand");
    });
  });
});
