import { describe, expect, it } from "vitest";
import { detectRedisTls } from "./redis.js";

describe("detectRedisTls", () => {
  it("returns true for an Upstash TLS URL using the rediss:// scheme", () => {
    expect(detectRedisTls("rediss://:token@xxx.upstash.io:6380")).toBe(true);
  });

  it("returns false for a local Redis URL using the redis:// scheme", () => {
    expect(detectRedisTls("redis://localhost:6379")).toBe(false);
  });

  it("returns false for a local Redis URL with a password but no TLS", () => {
    expect(detectRedisTls("redis://:password@host:6379")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(detectRedisTls("")).toBe(false);
  });

  it("returns false for redis:// with multiple s characters that don't match scheme", () => {
    // Confirm matching is scheme-prefix only, not a substring anywhere in the URL
    expect(detectRedisTls("redis://my-redis-server:6379")).toBe(false);
  });
});
