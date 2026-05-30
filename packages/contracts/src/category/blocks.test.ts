import { describe, it, expect } from "vitest";
import { MerchandisingBlockSchema } from "./blocks.js";

describe("MerchandisingBlockSchema", () => {
  it("accepts a valid banner block", () => {
    const result = MerchandisingBlockSchema.parse({
      type: "banner",
      imageUrl: "https://example.com/image.jpg",
      title: "Summer Sale",
    });
    expect(result.type).toBe("banner");
    expect((result as { imageUrl: string }).imageUrl).toBe(
      "https://example.com/image.jpg"
    );
  });

  it("accepts a valid product_grid block", () => {
    const result = MerchandisingBlockSchema.parse({
      type: "product_grid",
      title: "Featured Products",
      productIds: ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
      layout: "grid",
    });
    expect(result.type).toBe("product_grid");
    expect((result as { layout: string }).layout).toBe("grid");
  });

  it("accepts a valid text_block", () => {
    const result = MerchandisingBlockSchema.parse({
      type: "text_block",
      title: "About This Category",
      content: "Explore our wide range of products.",
    });
    expect(result.type).toBe("text_block");
    expect((result as { content: string }).content).toBe(
      "Explore our wide range of products."
    );
  });

  it("rejects an unknown block type", () => {
    const result = MerchandisingBlockSchema.safeParse({
      type: "unknown_type",
      title: "Oops",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a product_grid block missing productIds", () => {
    const result = MerchandisingBlockSchema.safeParse({
      type: "product_grid",
      title: "Featured Products",
      layout: "grid",
    });
    expect(result.success).toBe(false);
  });
});
