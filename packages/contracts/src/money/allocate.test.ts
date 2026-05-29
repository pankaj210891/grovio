import { describe, it, expect } from "vitest";

// These imports will fail (RED) until implementations are created
import { allocate } from "./allocate.js";

describe("allocate()", () => {
  it("splits 100 evenly into [50n, 50n]", () => {
    expect(allocate(100n, [1, 1])).toEqual([50n, 50n]);
  });

  it("handles remainder distribution: 100 into 3 equal parts gives [34n, 33n, 33n]", () => {
    expect(allocate(100n, [1, 1, 1])).toEqual([34n, 33n, 33n]);
  });

  it("handles remainder distribution: 7 into 3 equal parts gives [3n, 2n, 2n]", () => {
    expect(allocate(7n, [1, 1, 1])).toEqual([3n, 2n, 2n]);
  });

  it("returns [0n, 0n] for zero total", () => {
    expect(allocate(0n, [1, 1])).toEqual([0n, 0n]);
  });

  it("splits 100 in 3:1 ratio giving [75n, 25n]", () => {
    expect(allocate(100n, [3, 1])).toEqual([75n, 25n]);
  });

  it("handles remainder in 3:1 split: 101 gives [76n, 25n]", () => {
    expect(allocate(101n, [3, 1])).toEqual([76n, 25n]);
  });

  it("throws RangeError for empty ratios array", () => {
    expect(() => allocate(100n, [])).toThrow(RangeError);
    expect(() => allocate(100n, [])).toThrow("ratios must be non-empty");
  });

  it("throws RangeError for negative total", () => {
    expect(() => allocate(-1n, [1])).toThrow(RangeError);
    expect(() => allocate(-1n, [1])).toThrow("total must be non-negative");
  });

  it("sum invariant: parts always sum exactly to total", () => {
    const cases: [bigint, number[]][] = [
      [100n, [1, 1]],
      [100n, [1, 1, 1]],
      [7n, [1, 1, 1]],
      [0n, [1, 1]],
      [100n, [3, 1]],
      [101n, [3, 1]],
      [1n, [1, 1, 1]],
      [999n, [7, 3, 2, 1]],
      [1000000n, [1, 2, 3, 4, 5]],
    ];

    for (const [total, ratios] of cases) {
      const parts = allocate(total, ratios);
      const sum = parts.reduce((acc, part) => acc + part, 0n);
      expect(sum).toBe(total);
    }
  });

  it("property test: 10 varied totals always sum correctly", () => {
    const totals = [1n, 2n, 3n, 99n, 100n, 101n, 1000n, 9999n, 10000n, 123456n];
    const ratios = [1, 2, 3];
    for (const total of totals) {
      const parts = allocate(total, ratios);
      const sum = parts.reduce((acc, part) => acc + part, 0n);
      expect(sum).toBe(total);
    }
  });
});
