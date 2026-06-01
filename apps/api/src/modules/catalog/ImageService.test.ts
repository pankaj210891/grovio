import { describe, expect, it, vi } from "vitest";
import type { SelectProduct, SelectProductImage } from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://r2.example.com/presigned-put-url"),
}));

vi.mock("@aws-sdk/client-s3", () => {
  // S3Client and PutObjectCommand must be classes (used with `new`)
  class MockS3Client {
    constructor(_config: unknown) {}
  }
  class MockPutObjectCommand {
    constructor(public params: unknown) {}
  }
  return {
    S3Client: MockS3Client,
    PutObjectCommand: MockPutObjectCommand,
  };
});

import {
  ImageService,
  ImageLimitError,
  ImageOwnershipError,
  ImageSizeError,
} from "./ImageService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Build a SELECT mock for products (ownership check) */
function makeProductSelectMock(rows: Partial<SelectProduct>[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        then: (resolve: (v: unknown[]) => void) => resolve(rows),
        catch: vi.fn(),
        finally: vi.fn(),
      }),
    }),
  };
}

/** Build a SELECT mock for product_images (count check) */
function makeImageCountSelectMock(rows: Partial<SelectProductImage>[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        then: (resolve: (v: unknown[]) => void) => resolve(rows),
        catch: vi.fn(),
        finally: vi.fn(),
      }),
    }),
  };
}

function makeDbMock(
  productRows: Partial<SelectProduct>[] = [],
  imageRows: Partial<SelectProductImage>[] = []
) {
  // First select() call → product ownership check
  // Second select() call → image count check
  const selectFn = vi.fn()
    .mockReturnValueOnce(makeProductSelectMock(productRows))
    .mockReturnValueOnce(makeImageCountSelectMock(imageRows));
  return {
    select: selectFn,
  };
}

function makeInsertDbMock(
  productRows: Partial<SelectProduct>[],
  imageRows: Partial<SelectProductImage>[],
  returnImageRow: Partial<SelectProductImage>
) {
  const selectFn = vi.fn()
    .mockReturnValueOnce(makeProductSelectMock(productRows))
    .mockReturnValueOnce(makeImageCountSelectMock(imageRows));
  const insertChain = {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([returnImageRow]),
    }),
  };
  return {
    select: selectFn,
    insert: vi.fn().mockReturnValue(insertChain),
  };
}

function makeEnv(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    S3_BUCKET_URL: "https://account.r2.cloudflarestorage.com",
    S3_ACCESS_KEY_ID: "test-key-id",
    S3_SECRET_ACCESS_KEY: "test-secret-key",
    S3_REGION: "auto",
    S3_BUCKET_NAME: "grovio-bucket",
    S3_PUBLIC_URL: "https://pub.r2.dev",
    MAX_IMAGES_PER_PRODUCT: 8,
    MAX_IMAGE_SIZE_BYTES: 5242880, // 5MB
    ...overrides,
  } as never;
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const baseProduct: SelectProduct = {
  id: "product-uuid-1",
  vendorId: "vendor-uuid-1",
  categoryId: "category-uuid-1",
  name: "Test Product",
  slug: "test-product",
  description: null,
  status: "draft",
  basePriceMinor: 9999,
  attributes: {},
  rejectionReason: null,
  archivedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const baseImage: SelectProductImage = {
  id: "image-uuid-1",
  productId: "product-uuid-1",
  url: "https://pub.r2.dev/products/product-uuid-1/some-key.jpg",
  sortOrder: 0,
  altText: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ImageService", () => {
  // ── generatePresignedUpload ───────────────────────────────────────────────

  describe("generatePresignedUpload", () => {
    it("returns { uploadUrl, cdnUrl, key } and writes nothing to the DB", async () => {
      const db = makeDbMock([baseProduct], []); // 0 existing images
      const svc = new ImageService({ db: db as never, env: makeEnv() });

      const result = await svc.generatePresignedUpload(
        "product-uuid-1",
        "vendor-uuid-1",
        { contentType: "image/jpeg", fileSizeBytes: 100000 }
      );

      expect(result).toHaveProperty("uploadUrl");
      expect(result).toHaveProperty("cdnUrl");
      expect(result).toHaveProperty("key");
      // No insert should happen
      expect((db as unknown as { insert?: unknown }).insert).toBeUndefined();
    });

    it("cdnUrl is constructed from S3_PUBLIC_URL and key", async () => {
      const db = makeDbMock([baseProduct], []);
      const svc = new ImageService({ db: db as never, env: makeEnv() });

      const result = await svc.generatePresignedUpload(
        "product-uuid-1",
        "vendor-uuid-1",
        { contentType: "image/jpeg", fileSizeBytes: 100000 }
      );

      expect(result.cdnUrl).toMatch(/^https:\/\/pub\.r2\.dev\//);
      expect(result.cdnUrl).toContain(result.key);
    });

    it("rejects with ImageSizeError when fileSizeBytes > MAX_IMAGE_SIZE_BYTES", async () => {
      const db = makeDbMock([baseProduct], []);
      const svc = new ImageService({ db: db as never, env: makeEnv() });

      await expect(
        svc.generatePresignedUpload(
          "product-uuid-1",
          "vendor-uuid-1",
          { contentType: "image/jpeg", fileSizeBytes: 10_000_000 } // 10MB > 5MB limit
        )
      ).rejects.toThrow(ImageSizeError);
    });

    it("rejects with ImageLimitError when image count >= MAX_IMAGES_PER_PRODUCT", async () => {
      // 8 images already (limit is 8)
      const eightImages = Array.from({ length: 8 }, (_, i) => ({
        ...baseImage,
        id: `image-uuid-${i + 1}`,
      }));
      const db = makeDbMock([baseProduct], eightImages);
      const svc = new ImageService({ db: db as never, env: makeEnv() });

      await expect(
        svc.generatePresignedUpload(
          "product-uuid-1",
          "vendor-uuid-1",
          { contentType: "image/jpeg", fileSizeBytes: 100000 }
        )
      ).rejects.toThrow(ImageLimitError);
    });

    it("rejects with ImageOwnershipError when product does not belong to vendor", async () => {
      const db = makeDbMock([], []); // no product rows = ownership failure
      const svc = new ImageService({ db: db as never, env: makeEnv() });

      await expect(
        svc.generatePresignedUpload(
          "product-uuid-1",
          "other-vendor-uuid",
          { contentType: "image/jpeg", fileSizeBytes: 100000 }
        )
      ).rejects.toThrow(ImageOwnershipError);
    });

    it("the presigned uploadUrl comes from getSignedUrl mock", async () => {
      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
      const db = makeDbMock([baseProduct], []);
      const svc = new ImageService({ db: db as never, env: makeEnv() });

      const result = await svc.generatePresignedUpload(
        "product-uuid-1",
        "vendor-uuid-1",
        { contentType: "image/jpeg", fileSizeBytes: 100000 }
      );

      expect(getSignedUrl).toHaveBeenCalled();
      expect(result.uploadUrl).toBe("https://r2.example.com/presigned-put-url");
    });
  });

  // ── confirmUpload ─────────────────────────────────────────────────────────

  describe("confirmUpload", () => {
    it("inserts a product_images row (the only DB-write method — Pitfall 4)", async () => {
      const db = makeInsertDbMock([baseProduct], [], baseImage);
      const svc = new ImageService({ db: db as never, env: makeEnv() });

      const result = await svc.confirmUpload(
        "product-uuid-1",
        "vendor-uuid-1",
        { key: "products/product-uuid-1/some-key.jpg", altText: "Product front" }
      );

      expect(db.insert).toHaveBeenCalled();
      expect(result.url).toContain("product-uuid-1");
    });

    it("throws ImageOwnershipError when product does not belong to vendor", async () => {
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeProductSelectMock([])); // no rows = not owned
      const db = { select: selectFn };
      const svc = new ImageService({ db: db as never, env: makeEnv() });

      await expect(
        svc.confirmUpload(
          "product-uuid-1",
          "other-vendor-uuid",
          { key: "products/product-uuid-1/some-key.jpg" }
        )
      ).rejects.toThrow(ImageOwnershipError);
    });
  });

  // ── reorderImages ─────────────────────────────────────────────────────────

  describe("reorderImages", () => {
    it("updates sortOrder for each image and enforces ownership", async () => {
      const updateSetMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([baseImage]),
      });
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeProductSelectMock([baseProduct])); // ownership check
      const db = {
        select: selectFn,
        update: vi.fn().mockReturnValue({ set: updateSetMock }),
      };
      const svc = new ImageService({ db: db as never, env: makeEnv() });

      await svc.reorderImages("product-uuid-1", "vendor-uuid-1", [
        "image-uuid-1",
        "image-uuid-2",
      ]);

      // update should be called once per image ID
      expect(db.update).toHaveBeenCalledTimes(2);
    });

    it("throws ImageOwnershipError when product does not belong to vendor", async () => {
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeProductSelectMock([]));
      const db = { select: selectFn };
      const svc = new ImageService({ db: db as never, env: makeEnv() });

      await expect(
        svc.reorderImages("product-uuid-1", "other-vendor-uuid", ["image-uuid-1"])
      ).rejects.toThrow(ImageOwnershipError);
    });
  });

  // ── deleteImage ───────────────────────────────────────────────────────────

  describe("deleteImage", () => {
    it("deletes the image row and enforces ownership", async () => {
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeProductSelectMock([baseProduct]));
      const db = {
        select: selectFn,
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([baseImage]),
        }),
      };
      const svc = new ImageService({ db: db as never, env: makeEnv() });

      await svc.deleteImage("image-uuid-1", "product-uuid-1", "vendor-uuid-1");

      expect(db.delete).toHaveBeenCalled();
    });

    it("throws ImageOwnershipError when product does not belong to vendor", async () => {
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeProductSelectMock([]));
      const db = { select: selectFn };
      const svc = new ImageService({ db: db as never, env: makeEnv() });

      await expect(
        svc.deleteImage("image-uuid-1", "product-uuid-1", "other-vendor-uuid")
      ).rejects.toThrow(ImageOwnershipError);
    });
  });
});
