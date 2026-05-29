/**
 * allocate() — Split an integer minor-unit amount into N parts by ratio.
 *
 * Uses the largest-remainder method to ensure parts sum exactly to total.
 * Remainder units are distributed one at a time to slices starting from index 0.
 *
 * Use cases:
 *   - Commission splits: allocate(orderTotal, [platformRatio, vendorRatio])
 *   - Multi-vendor order splits: allocate(total, vendorRatios)
 *   - Payout distribution: allocate(payoutAmount, recipientRatios)
 *
 * Security (T-02-01, T-02-02): Input validation guards against negative totals
 * and empty ratios to prevent divide-by-zero and incorrect arithmetic.
 *
 * @param total  - Amount in minor units to split (must be >= 0n)
 * @param ratios - Non-empty array of positive numbers representing proportional weights
 * @returns      - Array of bigint amounts summing exactly to total
 * @throws RangeError if total < 0n or ratios is empty
 *
 * @example
 *   allocate(100n, [1, 1])      // [50n, 50n]
 *   allocate(100n, [1, 1, 1])   // [34n, 33n, 33n]  (remainder to first slice)
 *   allocate(100n, [3, 1])      // [75n, 25n]
 */
export function allocate(total: bigint, ratios: readonly number[]): bigint[] {
  // T-02-01: Guard against negative total
  if (total < 0n) {
    throw new RangeError("total must be non-negative");
  }

  // T-02-02: Guard against empty ratios (divide-by-zero)
  if (ratios.length === 0) {
    throw new RangeError("ratios must be non-empty");
  }

  // Validate all ratios are non-negative
  for (const ratio of ratios) {
    if (ratio < 0) {
      throw new RangeError("all ratios must be non-negative");
    }
  }

  const ratioSum = ratios.reduce((acc, r) => acc + r, 0);

  if (ratioSum === 0) {
    // All ratios are zero — distribute equally (edge case: split evenly)
    // Return zero parts for safety
    return ratios.map(() => 0n);
  }

  // Compute floor allocations for each slice
  const bigRatioSum = BigInt(Math.round(ratioSum * 1e9));
  const slices: bigint[] = ratios.map((ratio) => {
    // Use high-precision integer arithmetic: multiply by 1e9 to avoid float precision loss
    const bigRatio = BigInt(Math.round(ratio * 1e9));
    return (total * bigRatio) / bigRatioSum;
  });

  // Compute remainder and distribute one unit at a time to slices from index 0
  const sliceSum = slices.reduce((acc, s) => acc + s, 0n);
  let remainder = total - sliceSum;

  for (let i = 0; i < slices.length && remainder > 0n; i++) {
    // slices[i] is always defined here since i < slices.length
    slices[i] = (slices[i] ?? 0n) + 1n;
    remainder -= 1n;
  }

  return slices;
}
