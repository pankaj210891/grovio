import { describe, expect, it } from "vitest";
import { requiresSsl } from "./drizzle.js";

describe("requiresSsl", () => {
  it("returns true for a Neon pooled URL with .neon.tech hostname and sslmode=require", () => {
    expect(
      requiresSsl(
        "postgresql://user:pass@ep-xxx-pooler.neon.tech/grovio?sslmode=require",
      ),
    ).toBe(true);
  });

  it("returns true for a URL with sslmode=require only (no .neon.tech host)", () => {
    expect(
      requiresSsl("postgresql://user:pass@host/db?sslmode=require"),
    ).toBe(true);
  });

  it("returns false for a local Postgres URL with no SSL indicators", () => {
    expect(
      requiresSsl("postgresql://grovio:grovio@localhost:5432/grovio"),
    ).toBe(false);
  });

  it("returns false for a local Postgres URL on a non-standard port", () => {
    expect(requiresSsl("postgresql://user:pass@127.0.0.1:5433/mydb")).toBe(
      false,
    );
  });

  it("returns true for a Neon direct (non-pooled) URL", () => {
    expect(
      requiresSsl(
        "postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/grovio",
      ),
    ).toBe(true);
  });

  it("returns true for a URL with sslmode=verify-full (e.g. Supabase, RDS)", () => {
    expect(
      requiresSsl("postgresql://user:pass@host/db?sslmode=verify-full"),
    ).toBe(true);
  });

  it("returns true for a URL with sslmode=verify-ca", () => {
    expect(
      requiresSsl("postgresql://user:pass@host/db?sslmode=verify-ca"),
    ).toBe(true);
  });
});
