import { describe, it, expect } from "vitest";
import { z } from "zod";

// These imports will fail (RED) until implementations are created
import { HealthCheckResponseSchema } from "./health.js";
import { FeatureFlagSchema } from "./feature-flags.js";
import { ApiSuccessSchema, ApiErrorSchema } from "./envelope.js";
import { MarketplaceConfigSchema } from "./marketplace-config.js";
import { JwtPayloadSchema } from "./auth.js";

describe("HealthCheckResponseSchema", () => {
  it("parses a valid health check response with status ok", () => {
    const result = HealthCheckResponseSchema.parse({
      status: "ok",
      version: "1.0.0",
      timestamp: "2024-01-01T00:00:00Z",
    });
    expect(result.status).toBe("ok");
    expect(result.version).toBe("1.0.0");
  });

  it("throws ZodError for unknown status value", () => {
    expect(() =>
      HealthCheckResponseSchema.parse({ status: "unknown" })
    ).toThrow(z.ZodError);
  });
});

describe("FeatureFlagSchema", () => {
  it("parses a valid feature flag", () => {
    const result = FeatureFlagSchema.parse({
      key: "wallet_enabled",
      value: true,
      description: "enables wallet",
      enabled: true,
    });
    expect(result.key).toBe("wallet_enabled");
    expect(result.enabled).toBe(true);
  });
});

describe("ApiSuccessSchema", () => {
  it("parses a valid success envelope with string data", () => {
    const StringSuccessSchema = ApiSuccessSchema(z.string());
    const result = StringSuccessSchema.parse({ success: true, data: "hello" });
    expect(result.success).toBe(true);
    expect(result.data).toBe("hello");
  });
});

describe("ApiErrorSchema", () => {
  it("parses a valid error envelope", () => {
    const result = ApiErrorSchema.parse({
      success: false,
      error: { code: "NOT_FOUND", message: "not found" },
    });
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("NOT_FOUND");
  });
});

describe("MarketplaceConfigSchema", () => {
  it("parses a valid marketplace config with razorpay", () => {
    const result = MarketplaceConfigSchema.parse({
      currency: "INR",
      locale: "en-IN",
      activePaymentProviders: ["razorpay"],
    });
    expect(result.currency).toBe("INR");
    expect(result.activePaymentProviders).toContain("razorpay");
  });

  it("throws ZodError for invalid payment provider", () => {
    expect(() =>
      MarketplaceConfigSchema.parse({
        currency: "USD",
        locale: "en-US",
        activePaymentProviders: ["stripe", "invalid"],
      })
    ).toThrow(z.ZodError);
  });
});

describe("JwtPayloadSchema", () => {
  it("parses a valid JWT payload for a customer", () => {
    const result = JwtPayloadSchema.parse({
      sub: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      role: "customer",
      iat: 1700000000,
      exp: 1700003600,
    });
    expect(result.sub).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    expect(result.role).toBe("customer");
  });
});
