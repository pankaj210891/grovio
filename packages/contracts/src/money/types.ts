/**
 * Semantic alias for monetary amounts stored as integer minor units.
 *
 * CONVENTION: All monetary amounts are stored and transmitted as integer minor units.
 * - INR: paise (1 rupee = 100 paise)
 * - USD: cents (1 dollar = 100 cents)
 * - Never use float or decimal for money — PITFALLS.md Pitfall 1
 */
export type MinorUnitAmount = bigint;

/**
 * ISO-4217 three-letter currency code (e.g., "INR", "USD", "EUR").
 */
export type CurrencyCode = string;

/**
 * Money value object: an amount in minor units paired with its currency.
 *
 * Usage:
 *   const price: Money = { amount: 9999n, currency: "INR" }; // ₹99.99
 *   const price: Money = { amount: 1099n, currency: "USD" }; // $10.99
 */
export interface Money {
  /** Amount in minor units (paise, cents, etc.) — always a non-negative BigInt */
  amount: MinorUnitAmount;
  /** ISO-4217 currency code */
  currency: CurrencyCode;
}

/**
 * Buyer-facing convention constant.
 *
 * All monetary amounts in Grovio are stored and transmitted as integer minor units
 * (paise for INR, cents for USD). Never use float or decimal for money.
 *
 * @see packages/contracts/src/money/allocate.ts for split residual handling
 */
export const MINOR_UNIT_CONVENTION =
  "All monetary amounts are stored and transmitted as integer minor units (paise for INR, cents for USD). Never use float or decimal for money." as const;
