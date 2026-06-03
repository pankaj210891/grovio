/**
 * PaymentService tests — PAY-01, PAY-02, PAY-03
 *
 * Tests:
 * 1. getEnabledProviders() reflects which env keys are present (PAY-02)
 * 2. getProvider() returns the adapter when configured (PAY-02)
 * 3. getProvider() throws ProviderNotConfiguredError when keys are absent (PAY-02)
 * 4. recordWebhookEvent() returns true on first insert (PAY-03, D-10)
 * 5. recordWebhookEvent() returns false on duplicate (PAY-03, D-10 idempotency)
 * 6. SDK abstraction: PaymentService.ts source does NOT import stripe or razorpay
 *
 * Pattern: mock Drizzle chain with an onConflictDoNothing().returning() mock
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PaymentService } from "../PaymentService.js";
import { ProviderNotConfiguredError } from "../PaymentProvider.js";
import type { WebhookEvent } from "../PaymentProvider.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal Drizzle insert mock that simulates:
 *   db.insert(table).values({...}).onConflictDoNothing({...}).returning({...})
 *
 * @param returnRows - Rows to return from .returning() (empty = conflict = duplicate)
 */
function makeDbInsertMock(returnRows: Array<{ id: string }>) {
  const returningMock = vi.fn().mockResolvedValue(returnRows);
  const onConflictDoNothingMock = vi.fn().mockReturnValue({ returning: returningMock });
  const valuesMock = vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock });
  const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

  return {
    db: { insert: insertMock } as never,
    insertMock,
    valuesMock,
    onConflictDoNothingMock,
    returningMock,
  };
}

function makeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  } as never;
}

// ---------------------------------------------------------------------------
// Env fixtures
// ---------------------------------------------------------------------------

/** Both providers configured */
const BOTH_PROVIDERS_ENV = {
  STRIPE_SECRET_KEY: "sk_test_stripe_key",
  STRIPE_WEBHOOK_SECRET: "whsec_stripe_secret",
  RAZORPAY_KEY_ID: "rzp_test_key_id",
  RAZORPAY_KEY_SECRET: "razorpay_key_secret",
  RAZORPAY_WEBHOOK_SECRET: "razorpay_webhook_secret",
} as never;

/** Only Stripe configured */
const STRIPE_ONLY_ENV = {
  STRIPE_SECRET_KEY: "sk_test_stripe_key",
  STRIPE_WEBHOOK_SECRET: "whsec_stripe_secret",
} as never;

/** Only Razorpay configured */
const RAZORPAY_ONLY_ENV = {
  RAZORPAY_KEY_ID: "rzp_test_key_id",
  RAZORPAY_KEY_SECRET: "razorpay_key_secret",
  RAZORPAY_WEBHOOK_SECRET: "razorpay_webhook_secret",
} as never;

/** No payment keys configured */
const NO_PROVIDERS_ENV = {} as never;

// ---------------------------------------------------------------------------
// Sample webhook event
// ---------------------------------------------------------------------------

const sampleWebhookEvent: WebhookEvent = {
  type: "PAYMENT_CAPTURED",
  providerEventId: "evt_test_123",
  orderId: "order-uuid-abc",
  amountMinor: 99900n,
  provider: "stripe",
  rawPayload: { type: "payment_intent.succeeded", id: "evt_test_123" },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PaymentService", () => {
  // -------------------------------------------------------------------------
  describe("getEnabledProviders (PAY-02)", () => {
    it("returns {stripe: true, razorpay: true} when both providers are configured", () => {
      const { db } = makeDbInsertMock([]);
      const svc = new PaymentService({ db, env: BOTH_PROVIDERS_ENV, logger: makeLogger() });

      const result = svc.getEnabledProviders();

      expect(result).toEqual({ stripe: true, razorpay: true });
    });

    it("returns {stripe: true, razorpay: false} when only Stripe is configured", () => {
      const { db } = makeDbInsertMock([]);
      const svc = new PaymentService({ db, env: STRIPE_ONLY_ENV, logger: makeLogger() });

      const result = svc.getEnabledProviders();

      expect(result).toEqual({ stripe: true, razorpay: false });
    });

    it("returns {stripe: false, razorpay: true} when only Razorpay is configured", () => {
      const { db } = makeDbInsertMock([]);
      const svc = new PaymentService({ db, env: RAZORPAY_ONLY_ENV, logger: makeLogger() });

      const result = svc.getEnabledProviders();

      expect(result).toEqual({ stripe: false, razorpay: true });
    });

    it("returns {stripe: false, razorpay: false} when no providers are configured", () => {
      const { db } = makeDbInsertMock([]);
      const svc = new PaymentService({ db, env: NO_PROVIDERS_ENV, logger: makeLogger() });

      const result = svc.getEnabledProviders();

      expect(result).toEqual({ stripe: false, razorpay: false });
    });
  });

  // -------------------------------------------------------------------------
  describe("getProvider (PAY-02)", () => {
    it("returns a PaymentProvider for 'stripe' when Stripe is configured", () => {
      const { db } = makeDbInsertMock([]);
      const svc = new PaymentService({ db, env: STRIPE_ONLY_ENV, logger: makeLogger() });

      const provider = svc.getProvider("stripe");

      expect(provider).toBeDefined();
      expect(typeof provider.createPaymentOrder).toBe("function");
      expect(typeof provider.handleWebhook).toBe("function");
      expect(typeof provider.initiateRefund).toBe("function");
    });

    it("returns a PaymentProvider for 'razorpay' when Razorpay is configured", () => {
      const { db } = makeDbInsertMock([]);
      const svc = new PaymentService({ db, env: RAZORPAY_ONLY_ENV, logger: makeLogger() });

      const provider = svc.getProvider("razorpay");

      expect(provider).toBeDefined();
      expect(typeof provider.createPaymentOrder).toBe("function");
    });

    it("throws ProviderNotConfiguredError for 'stripe' when keys are absent", () => {
      const { db } = makeDbInsertMock([]);
      const svc = new PaymentService({ db, env: NO_PROVIDERS_ENV, logger: makeLogger() });

      expect(() => svc.getProvider("stripe")).toThrow(ProviderNotConfiguredError);
      expect(() => svc.getProvider("stripe")).toThrow(
        /stripe.*is not configured/i
      );
    });

    it("throws ProviderNotConfiguredError for 'razorpay' when keys are absent", () => {
      const { db } = makeDbInsertMock([]);
      const svc = new PaymentService({ db, env: NO_PROVIDERS_ENV, logger: makeLogger() });

      expect(() => svc.getProvider("razorpay")).toThrow(ProviderNotConfiguredError);
      expect(() => svc.getProvider("razorpay")).toThrow(
        /razorpay.*is not configured/i
      );
    });

    it("throws ProviderNotConfiguredError for 'stripe' when only Razorpay is configured", () => {
      const { db } = makeDbInsertMock([]);
      const svc = new PaymentService({ db, env: RAZORPAY_ONLY_ENV, logger: makeLogger() });

      expect(() => svc.getProvider("stripe")).toThrow(ProviderNotConfiguredError);
    });
  });

  // -------------------------------------------------------------------------
  describe("recordWebhookEvent (PAY-03, D-10)", () => {
    it("returns true on first insert (new event)", async () => {
      // onConflictDoNothing returns a row → newly inserted
      const { db } = makeDbInsertMock([{ id: "payment-event-uuid-1" }]);
      const svc = new PaymentService({ db, env: NO_PROVIDERS_ENV, logger: makeLogger() });

      const result = await svc.recordWebhookEvent("stripe", sampleWebhookEvent);

      expect(result).toBe(true);
    });

    it("returns false on duplicate delivery (idempotency — D-10)", async () => {
      // onConflictDoNothing returns empty array → unique constraint fired → duplicate
      const { db } = makeDbInsertMock([]);
      const svc = new PaymentService({ db, env: NO_PROVIDERS_ENV, logger: makeLogger() });

      const result = await svc.recordWebhookEvent("stripe", sampleWebhookEvent);

      expect(result).toBe(false);
    });

    it("calls db.insert with correct provider and providerEventId", async () => {
      const { db, valuesMock } = makeDbInsertMock([{ id: "uuid-1" }]);
      const svc = new PaymentService({ db, env: NO_PROVIDERS_ENV, logger: makeLogger() });

      await svc.recordWebhookEvent("stripe", sampleWebhookEvent);

      expect(valuesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "stripe",
          providerEventId: "evt_test_123",
          eventType: "PAYMENT_CAPTURED",
        })
      );
    });

    it("calls onConflictDoNothing with provider and providerEventId columns", async () => {
      const { db, onConflictDoNothingMock } = makeDbInsertMock([{ id: "uuid-1" }]);
      const svc = new PaymentService({ db, env: NO_PROVIDERS_ENV, logger: makeLogger() });

      await svc.recordWebhookEvent("stripe", sampleWebhookEvent);

      expect(onConflictDoNothingMock).toHaveBeenCalledWith(
        expect.objectContaining({ target: expect.any(Array) })
      );
    });

    it("works for razorpay provider events", async () => {
      const { db } = makeDbInsertMock([{ id: "uuid-2" }]);
      const svc = new PaymentService({ db, env: NO_PROVIDERS_ENV, logger: makeLogger() });

      const razorpayEvent: WebhookEvent = {
        ...sampleWebhookEvent,
        provider: "razorpay",
        providerEventId: "pay_razorpay_123",
      };

      const result = await svc.recordWebhookEvent("razorpay", razorpayEvent);
      expect(result).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("SDK abstraction guard (PAY-01)", () => {
    it("PaymentService.ts source does NOT import stripe or razorpay SDKs directly", async () => {
      // Use fileURLToPath for cross-platform compatibility (handles Windows drive letters)
      const { fileURLToPath } = await import("node:url");
      const testDir = fileURLToPath(new URL(".", import.meta.url));
      const serviceFilePath = resolve(testDir, "../PaymentService.ts");
      const source = readFileSync(serviceFilePath, "utf-8");

      // Must NOT contain any direct SDK import (Pitfall 9, PAY-01)
      expect(source).not.toMatch(/from ["']stripe["']/);
      expect(source).not.toMatch(/require\(["']stripe["']\)/);
      expect(source).not.toMatch(/from ["']razorpay["']/);
      expect(source).not.toMatch(/require\(["']razorpay["']\)/);
    });
  });
});
