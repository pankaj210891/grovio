import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Job } from "bullmq";
import type { Client as OpenSearchClient } from "@opensearch-project/opensearch";
import {
  buildSearchDocument,
  processProductIndexJob,
} from "./product-index-job.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Minimal OpenSearch client mock shape — only the methods the job exercises. */
interface OpenSearchMock {
  index: Mock;
  delete: Mock;
}

/**
 * Build a minimal mock OpenSearch client with vi.fn() stubs.
 * The mock is cast to `OpenSearchClient` for passing to processProductIndexJob,
 * but stored as `OpenSearchMock` so assertions can access `.mock.calls`.
 */
function makeOpenSearchMock(): OpenSearchMock {
  return {
    index: vi.fn().mockResolvedValue({ statusCode: 200 }),
    delete: vi.fn().mockResolvedValue({ statusCode: 200 }),
  };
}

/** Helper to convert the mock to the OpenSearchClient type for passing to processProductIndexJob */
function asClient(mock: OpenSearchMock): OpenSearchClient {
  return mock as unknown as OpenSearchClient;
}

/**
 * Build a mock DB that returns a product with its category's attributeDefinitions.
 * The attributeDefinitions list represents only the is_searchable=true attributes.
 *
 * productAttributes is the raw JSONB on the product row (may contain non-searchable keys).
 * searchableAttrDefs are the attribute_definitions filtered to isSearchable=true.
 */
function makeDbMock(
  product: {
    id: string;
    name: string;
    description: string | null;
    categoryId: string;
    vendorId: string;
    status: string;
    basePriceMinor: number;
    attributes: Record<string, unknown>;
    category: {
      name: string;
      attributeDefinitions: Array<{ key: string; isSearchable: boolean }>;
    };
    variants: Array<{ id: string; priceMinor: number; sku: string }>;
  } | null
) {
  const selectChain = {
    from: vi.fn().mockReturnValue({
      leftJoin: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(
            product
              ? product.category.attributeDefinitions.map((ad) => ({
                  p_id: product.id,
                  p_name: product.name,
                  p_description: product.description,
                  p_category_id: product.categoryId,
                  p_vendor_id: product.vendorId,
                  p_status: product.status,
                  p_base_price_minor: product.basePriceMinor,
                  p_attributes: product.attributes,
                  cat_name: product.category.name,
                  ad_key: ad.key,
                  ad_is_searchable: ad.isSearchable,
                }))
              : []
          ),
        }),
      }),
    }),
  };
  return {
    select: vi.fn().mockReturnValue(selectChain),
  };
}

/** Build a BullMQ Job mock with given data */
function makeJob(data: { productId: string; action: "index" | "delete" }): Job {
  return { data } as unknown as Job;
}

// ---------------------------------------------------------------------------
// buildSearchDocument — pure function tests
// ---------------------------------------------------------------------------

describe("buildSearchDocument", () => {
  it("includes only keys from searchableAttrKeys array", () => {
    const product = {
      name: "Red Widget",
      description: "A fine widget",
      categoryId: "cat-1",
      categoryName: "Widgets",
      vendorId: "vendor-1",
      status: "approved" as const,
      basePriceMinor: 1999,
      attributes: {
        color: "red",
        size: "M",
        internal_sku: "WIDGET-001", // non-searchable — should NOT appear
        warehouse_zone: "A4",       // non-searchable — should NOT appear
      },
    };
    const searchableAttrKeys = ["color", "size"]; // only these two are is_searchable=true

    const doc = buildSearchDocument(product, searchableAttrKeys);

    // Searchable attrs must be present
    expect(doc.attributes["color"]).toBe("red");
    expect(doc.attributes["size"]).toBe("M");

    // Non-searchable attrs must be ABSENT (SRCH-04 / Anti-Pattern 6 / D-15)
    expect("internal_sku" in doc.attributes).toBe(false);
    expect("warehouse_zone" in doc.attributes).toBe(false);
  });

  it("includes standard product fields", () => {
    const product = {
      name: "Blue Gadget",
      description: "A gadget",
      categoryId: "cat-2",
      categoryName: "Gadgets",
      vendorId: "vendor-2",
      status: "approved" as const,
      basePriceMinor: 4999,
      attributes: { color: "blue" },
    };

    const doc = buildSearchDocument(product, ["color"]);

    expect(doc.name).toBe("Blue Gadget");
    expect(doc.description).toBe("A gadget");
    expect(doc.categoryId).toBe("cat-2");
    expect(doc.categoryName).toBe("Gadgets");
    expect(doc.vendorId).toBe("vendor-2");
    expect(doc.status).toBe("approved");
    expect(doc.basePriceMinor).toBe(4999);
  });

  it("produces empty attributes object when no searchable keys match", () => {
    const product = {
      name: "Hidden Product",
      description: null,
      categoryId: "cat-3",
      categoryName: "Test",
      vendorId: "vendor-3",
      status: "approved" as const,
      basePriceMinor: 0,
      attributes: { secret_field: "value" },
    };

    const doc = buildSearchDocument(product, []); // no searchable attrs

    expect(doc.attributes).toEqual({});
    expect(doc.name).toBe("Hidden Product");
  });
});

// ---------------------------------------------------------------------------
// processProductIndexJob — integration tests with mocked deps
// ---------------------------------------------------------------------------

describe("processProductIndexJob", () => {
  let opensearch: ReturnType<typeof makeOpenSearchMock>;

  beforeEach(() => {
    opensearch = makeOpenSearchMock();
    vi.clearAllMocks();
  });

  describe("action: delete", () => {
    it("calls opensearch.delete with the product ID", async () => {
      const db = makeDbMock(null);
      const env = { NODE_ENV: "test" as const };
      const job = makeJob({ productId: "prod-123", action: "delete" });

      await processProductIndexJob(job, { db: db as never, opensearch: asClient(opensearch), env });

      expect(opensearch.delete).toHaveBeenCalledOnce();
      const call = opensearch.delete.mock.calls[0]![0];
      expect(call.index).toBe("grovio-products-test");
      expect(call.id).toBe("prod-123");
    });

    it("does NOT call opensearch.index on delete action", async () => {
      const db = makeDbMock(null);
      const env = { NODE_ENV: "test" as const };
      const job = makeJob({ productId: "prod-456", action: "delete" });

      await processProductIndexJob(job, { db: db as never, opensearch: asClient(opensearch), env });

      expect(opensearch.index).not.toHaveBeenCalled();
    });
  });

  describe("action: index", () => {
    const baseProduct = {
      id: "prod-789",
      name: "Test Product",
      description: "A test product",
      categoryId: "cat-abc",
      vendorId: "vendor-xyz",
      status: "approved",
      basePriceMinor: 2999,
      attributes: {
        color: "green",
        size: "L",
        internal_note: "do not index",   // non-searchable
        warehouse_bin: "B-14",            // non-searchable
      },
      category: {
        name: "Test Category",
        // Only color and size are is_searchable=true
        attributeDefinitions: [
          { key: "color", isSearchable: true },
          { key: "size", isSearchable: true },
          { key: "internal_note", isSearchable: false },
          { key: "warehouse_bin", isSearchable: false },
        ],
      },
      variants: [],
    };

    it("calls opensearch.index with the correct index name", async () => {
      const db = makeDbMock(baseProduct);
      const env = { NODE_ENV: "test" as const };
      const job = makeJob({ productId: baseProduct.id, action: "index" });

      await processProductIndexJob(job, { db: db as never, opensearch: asClient(opensearch), env });

      expect(opensearch.index).toHaveBeenCalledOnce();
      const call = opensearch.index.mock.calls[0]![0];
      expect(call.index).toBe("grovio-products-test");
      expect(call.id).toBe(baseProduct.id);
    });

    it("excludes non-searchable attribute keys from the index document (SRCH-04, D-15, Anti-Pattern 6)", async () => {
      const db = makeDbMock(baseProduct);
      const env = { NODE_ENV: "test" as const };
      const job = makeJob({ productId: baseProduct.id, action: "index" });

      await processProductIndexJob(job, { db: db as never, opensearch: asClient(opensearch), env });

      const call = opensearch.index.mock.calls[0]![0];
      const body = call.body as Record<string, unknown>;
      const attrs = body["attributes"] as Record<string, unknown>;

      // Searchable attrs MUST be present
      expect(attrs["color"]).toBe("green");
      expect(attrs["size"]).toBe("L");

      // Non-searchable attrs MUST NOT be present
      expect("internal_note" in attrs).toBe(false);
      expect("warehouse_bin" in attrs).toBe(false);
    });

    it("includes standard product fields in the index document", async () => {
      const db = makeDbMock(baseProduct);
      const env = { NODE_ENV: "test" as const };
      const job = makeJob({ productId: baseProduct.id, action: "index" });

      await processProductIndexJob(job, { db: db as never, opensearch: asClient(opensearch), env });

      const call = opensearch.index.mock.calls[0]![0];
      const body = call.body as Record<string, unknown>;
      expect(body["name"]).toBe("Test Product");
      expect(body["categoryId"]).toBe("cat-abc");
      expect(body["vendorId"]).toBe("vendor-xyz");
      expect(body["basePriceMinor"]).toBe(2999);
      expect(body["categoryName"]).toBe("Test Category");
    });

    it("does NOT call opensearch.delete on index action", async () => {
      const db = makeDbMock(baseProduct);
      const env = { NODE_ENV: "test" as const };
      const job = makeJob({ productId: baseProduct.id, action: "index" });

      await processProductIndexJob(job, { db: db as never, opensearch: asClient(opensearch), env });

      expect(opensearch.delete).not.toHaveBeenCalled();
    });
  });
});
