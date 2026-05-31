import { describe, expect, it, vi } from "vitest";
import type { SelectCategoryMetadata } from "../../db/schema/index.js";
import { CategoryMetadataService } from "./CategoryMetadataService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Build a chainable Drizzle SELECT mock.
 * CategoryMetadataService uses:
 *   db.select().from().where().limit(1)   ← getMetadata
 */
function makeSelectDbMock(rows: SelectCategoryMetadata[]) {
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
 * Build a Drizzle INSERT + ON CONFLICT mock for upsertMetadata.
 * CategoryMetadataService uses:
 *   db.insert(categoryMetadata).values(...).onConflictDoUpdate({ target, set }).returning()
 */
function makeUpsertDbMock(returnRow: SelectCategoryMetadata) {
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

const metadataRow: SelectCategoryMetadata = {
  id: "meta-uuid-1",
  categoryId,
  seoTitle: "Electronics | GrovioShop",
  seoDescription: "Shop the best electronics online",
  seoKeywords: "electronics, gadgets, tech",
  canonicalUrl: "https://grovio.shop/categories/electronics",
  blocks: [
    {
      type: "banner",
      imageUrl: "https://cdn.grovio.shop/electronics-banner.jpg",
      title: "Electronics Sale",
      subtitle: "Up to 50% off",
    },
    {
      type: "product_grid",
      title: "Best Sellers",
      productIds: ["prod-uuid-1", "prod-uuid-2"],
      layout: "grid",
    },
    {
      type: "text_block",
      title: "About Electronics",
      content: "We carry the best brands in consumer electronics.",
    },
  ],
  description: "Full range of consumer electronics",
  imageUrl: "https://cdn.grovio.shop/electronics-hero.jpg",
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests — CAT-07
// ---------------------------------------------------------------------------

describe("CategoryMetadataService", () => {
  // ── getMetadata ────────────────────────────────────────────────────────────

  describe("getMetadata", () => {
    it("returns null when no metadata row exists (lazy-create — absence is valid)", async () => {
      const db = makeSelectDbMock([]); // no rows → category has no metadata yet
      const svc = new CategoryMetadataService({ db: db as never });
      const result = await svc.getMetadata(categoryId);

      expect(result).toBeNull();
      expect(db.select).toHaveBeenCalledOnce();
    });

    it("returns the metadata row when one exists", async () => {
      const db = makeSelectDbMock([metadataRow]);
      const svc = new CategoryMetadataService({ db: db as never });
      const result = await svc.getMetadata(categoryId);

      expect(result).not.toBeNull();
      expect(result!.categoryId).toBe(categoryId);
      expect(result!.seoTitle).toBe("Electronics | GrovioShop");
      expect(result!.blocks).toHaveLength(3);
    });
  });

  // ── upsertMetadata — block validation (Pitfall 5 / T-02-12) ───────────────

  describe("upsertMetadata — block validation", () => {
    it("throws a Zod validation error for a malformed block BEFORE any DB write", async () => {
      const db = makeUpsertDbMock(metadataRow);
      const svc = new CategoryMetadataService({ db: db as never });

      // product_grid missing required `productIds` and `layout` fields → should fail validation
      const malformedBlocks = [
        {
          type: "product_grid",
          title: "Featured Products",
          // productIds and layout intentionally omitted → malformed
        },
      ];

      await expect(
        svc.upsertMetadata(categoryId, { blocks: malformedBlocks as never })
      ).rejects.toThrow();

      // CRITICAL: DB insert must NOT have been called (validation happens before write)
      expect(db.insert).not.toHaveBeenCalled();
    });

    it("throws for an unknown block type (discriminated union rejection)", async () => {
      const db = makeUpsertDbMock(metadataRow);
      const svc = new CategoryMetadataService({ db: db as never });

      const unknownTypeBlock = [
        {
          type: "video_embed", // unknown type — rejected by discriminatedUnion
          url: "https://youtube.com/watch?v=abc",
        },
      ];

      await expect(
        svc.upsertMetadata(categoryId, { blocks: unknownTypeBlock as never })
      ).rejects.toThrow();

      // CRITICAL: DB insert must NOT have been called
      expect(db.insert).not.toHaveBeenCalled();
    });

    it("persists metadata with all 3 valid block types", async () => {
      const db = makeUpsertDbMock(metadataRow);
      const svc = new CategoryMetadataService({ db: db as never });

      const validBlocks = [
        {
          type: "banner" as const,
          imageUrl: "https://cdn.grovio.shop/banner.jpg",
          title: "Summer Sale",
        },
        {
          type: "product_grid" as const,
          title: "Trending",
          productIds: ["00000000-0000-4000-8000-000000000001"],
          layout: "carousel" as const,
        },
        {
          type: "text_block" as const,
          title: "Our Story",
          content: "We have been selling electronics since 2020.",
        },
      ];

      const result = await svc.upsertMetadata(categoryId, { blocks: validBlocks });

      // DB write should have occurred
      expect(db.insert).toHaveBeenCalledOnce();
      // Result contains the returned row
      expect(result.categoryId).toBe(categoryId);
    });
  });

  // ── upsertMetadata — lazy-create (one row per category) ───────────────────

  describe("upsertMetadata — lazy-create", () => {
    it("creates the metadata row on first call (lazy-create)", async () => {
      const firstRow: SelectCategoryMetadata = {
        ...metadataRow,
        seoTitle: "Furniture",
        blocks: [],
      };
      const db = makeUpsertDbMock(firstRow);
      const svc = new CategoryMetadataService({ db: db as never });

      const result = await svc.upsertMetadata(categoryId, { seoTitle: "Furniture" });

      expect(db.insert).toHaveBeenCalledOnce();
      expect(result.seoTitle).toBe("Furniture");
    });

    it("updates the metadata row on subsequent calls (one row per category)", async () => {
      const updatedRow: SelectCategoryMetadata = {
        ...metadataRow,
        seoTitle: "Updated Electronics Title",
      };
      const db = makeUpsertDbMock(updatedRow);
      const svc = new CategoryMetadataService({ db: db as never });

      const result = await svc.upsertMetadata(categoryId, {
        seoTitle: "Updated Electronics Title",
      });

      // insert was called (onConflictDoUpdate handles both create and update)
      expect(db.insert).toHaveBeenCalledOnce();
      expect(result.seoTitle).toBe("Updated Electronics Title");
    });
  });

  // ── MerchandisingBlockSchema validation guard ──────────────────────────────

  describe("MerchandisingBlockSchema guard (Pitfall 5 / T-02-12)", () => {
    it("skips block validation when no blocks are provided in input", async () => {
      // When blocks are not provided at all, validation is skipped — no throw
      const db = makeUpsertDbMock(metadataRow);
      const svc = new CategoryMetadataService({ db: db as never });

      const result = await svc.upsertMetadata(categoryId, { seoTitle: "SEO Only" });

      // Should reach DB without throwing
      expect(db.insert).toHaveBeenCalledOnce();
      expect(result.categoryId).toBe(categoryId);
    });
  });
});
