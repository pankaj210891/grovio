/**
 * Demo catalog seed script — creates minimal data for browser-testing the
 * storefront basket and checkout flows.
 *
 * Inserts (idempotent — safe to run multiple times):
 *   - 1 vendor account  (vendor@demo.grovio)
 *   - 2 categories      (Electronics, Apparel)
 *   - 4 products        (2 with variants, 2 without)
 *   - Inventory rows    (100 units each variant)
 *   - Indexes products  into OpenSearch  (grovio-products-development)
 *
 * Run: pnpm --filter @grovio/api db:seed:demo
 */

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { Client } from "@opensearch-project/opensearch";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import * as schema from "./schema/index.js";
import { getIndexName, ensureIndex } from "../modules/search/opensearch-mapping.js";

// ---------------------------------------------------------------------------
// DB + OpenSearch setup
// ---------------------------------------------------------------------------

const DATABASE_URL =
  process.env["DATABASE_DIRECT_URL"] ?? process.env["DATABASE_URL"];
const OPENSEARCH_URL = process.env["OPENSEARCH_URL"];

if (!DATABASE_URL) {
  console.error("[seed:demo] ERROR: DATABASE_URL must be set.");
  process.exit(1);
}

const usesSsl =
  DATABASE_URL.includes(".neon.tech") || DATABASE_URL.includes("sslmode=require");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ...(usesSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = drizzle({ client: pool }) as any;

const opensearch = OPENSEARCH_URL
  ? new Client({ node: OPENSEARCH_URL, ssl: { rejectUnauthorized: false } })
  : null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Fake argon2 hash — dev only, never for real auth. */
function fakeHash(pw: string): string {
  return "$argon2id$v=19$m=65536,t=3,p=4$" + createHash("sha256").update(pw).digest("base64");
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  console.log("[seed:demo] Connecting...");
  await pool.query("SELECT 1");
  console.log("[seed:demo] Connected.");

  // ── 1. Vendor ────────────────────────────────────────────────────────────
  let vendorId: string;
  const existingVendors = await db
    .select({ id: schema.vendors.id })
    .from(schema.vendors)
    .where(eq(schema.vendors.email, "vendor@demo.grovio"))
    .limit(1);

  if (existingVendors.length > 0) {
    vendorId = existingVendors[0].id;
    console.log(`[seed:demo] Vendor already exists (id=${vendorId})`);
  } else {
    const [v] = await db
      .insert(schema.vendors)
      .values({
        email: "vendor@demo.grovio",
        passwordHash: fakeHash("demo1234"),
        name: "Demo Store",
      })
      .returning({ id: schema.vendors.id });
    vendorId = v.id;
    console.log(`[seed:demo] Vendor created (id=${vendorId})`);
  }

  // ── 2. Categories ─────────────────────────────────────────────────────────
  const categoryData = [
    { name: "Electronics", slug: "electronics" },
    { name: "Apparel", slug: "apparel" },
  ];

  const categoryIds: Record<string, string> = {};
  for (const cat of categoryData) {
    const existing = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(eq(schema.categories.slug, cat.slug))
      .limit(1);

    if (existing.length > 0) {
      categoryIds[cat.slug] = existing[0].id;
      console.log(`[seed:demo] Category '${cat.name}' already exists`);
    } else {
      const [c] = await db
        .insert(schema.categories)
        .values({ name: cat.name, slug: cat.slug, sortOrder: 0, isRestricted: false })
        .returning({ id: schema.categories.id });
      categoryIds[cat.slug] = c.id;
      console.log(`[seed:demo] Category '${cat.name}' created (id=${c.id})`);
    }
  }

  // ── 3. Products ───────────────────────────────────────────────────────────
  type ProductSeed = {
    name: string;
    description: string;
    categorySlug: string;
    basePriceMinor: number;
    variants: { sku: string; options: Record<string, string>; priceMinor: number }[];
  };

  const products: ProductSeed[] = [
    {
      name: "Wireless Bluetooth Headphones",
      description: "Premium over-ear headphones with active noise cancellation and 30-hour battery life.",
      categorySlug: "electronics",
      basePriceMinor: 299900, // ₹2999
      variants: [
        { sku: "WBH-BLK", options: { color: "Black" }, priceMinor: 299900 },
        { sku: "WBH-WHT", options: { color: "White" }, priceMinor: 299900 },
        { sku: "WBH-BLU", options: { color: "Blue" }, priceMinor: 319900 },
      ],
    },
    {
      name: "Mechanical Keyboard",
      description: "Compact TKL mechanical keyboard with RGB backlighting and Cherry MX switches.",
      categorySlug: "electronics",
      basePriceMinor: 549900, // ₹5499
      variants: [
        { sku: "MKB-RED", options: { switch_type: "Red" }, priceMinor: 549900 },
        { sku: "MKB-BRN", options: { switch_type: "Brown" }, priceMinor: 549900 },
      ],
    },
    {
      name: "Cotton Crew-Neck T-Shirt",
      description: "100% organic cotton, pre-shrunk, unisex fit. Available in multiple sizes.",
      categorySlug: "apparel",
      basePriceMinor: 89900, // ₹899
      variants: [
        { sku: "TSH-S-BLK", options: { size: "S", color: "Black" }, priceMinor: 89900 },
        { sku: "TSH-M-BLK", options: { size: "M", color: "Black" }, priceMinor: 89900 },
        { sku: "TSH-L-BLK", options: { size: "L", color: "Black" }, priceMinor: 89900 },
        { sku: "TSH-S-WHT", options: { size: "S", color: "White" }, priceMinor: 89900 },
        { sku: "TSH-M-WHT", options: { size: "M", color: "White" }, priceMinor: 89900 },
      ],
    },
    {
      name: "Running Shoes",
      description: "Lightweight mesh running shoes with responsive cushioning. Great for daily training.",
      categorySlug: "apparel",
      basePriceMinor: 249900, // ₹2499
      variants: [
        { sku: "RUN-40", options: { size: "40", color: "Grey" }, priceMinor: 249900 },
        { sku: "RUN-41", options: { size: "41", color: "Grey" }, priceMinor: 249900 },
        { sku: "RUN-42", options: { size: "42", color: "Grey" }, priceMinor: 249900 },
        { sku: "RUN-43", options: { size: "43", color: "Grey" }, priceMinor: 249900 },
      ],
    },
  ];

  const indexedDocs: Array<{ index: { _index: string; _id: string } } | Record<string, unknown>> = [];
  const indexName = getIndexName({ NODE_ENV: "development" });

  for (const p of products) {
    const productSlug = slug(p.name);
    const categoryId = categoryIds[p.categorySlug]!;

    // Check if product already exists
    const existing = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.slug, productSlug))
      .limit(1);

    let productId: string;

    if (existing.length > 0) {
      productId = existing[0].id;
      console.log(`[seed:demo] Product '${p.name}' already exists — skipping`);
    } else {
      const [prod] = await db
        .insert(schema.products)
        .values({
          vendorId,
          categoryId,
          name: p.name,
          slug: productSlug,
          description: p.description,
          status: "approved",
          basePriceMinor: p.basePriceMinor,
          attributes: {},
        })
        .returning({ id: schema.products.id });

      productId = prod.id;
      console.log(`[seed:demo] Product '${p.name}' created (id=${productId})`);

      // Variants + inventory
      for (const v of p.variants) {
        const [variant] = await db
          .insert(schema.productVariants)
          .values({
            productId,
            sku: v.sku,
            optionValues: v.options,
            priceMinor: v.priceMinor,
            sortOrder: 0,
          })
          .returning({ id: schema.productVariants.id });

        await db.insert(schema.inventoryItems).values({
          productVariantId: variant.id,
          productId,
          vendorId,
          quantityAvailable: 100,
          quantityReserved: 0,
        });
      }

      console.log(`[seed:demo]   → ${p.variants.length} variants + inventory rows`);
    }

    // Queue for OpenSearch bulk index (approved products only)
    indexedDocs.push(
      { index: { _index: indexName, _id: productId } },
      {
        name: p.name,
        description: p.description,
        categoryId,
        categoryName: p.categorySlug === "electronics" ? "Electronics" : "Apparel",
        vendorId,
        status: "approved",
        basePriceMinor: p.basePriceMinor,
        attributes: {},
      }
    );
  }

  // ── 4. OpenSearch ─────────────────────────────────────────────────────────
  if (opensearch && indexedDocs.length > 0) {
    await ensureIndex(opensearch, { NODE_ENV: "development" });
    const bulkRes = await opensearch.bulk({ body: indexedDocs });
    const errors = (bulkRes.body.items as Array<{ index?: { error?: unknown } }>)
      .filter((i) => i.index?.error)
      .map((i) => i.index?.error);

    if (errors.length > 0) {
      console.warn(`[seed:demo] OpenSearch bulk index had ${errors.length} error(s):`, errors[0]);
    } else {
      console.log(`[seed:demo] Indexed ${products.length} products into OpenSearch (${indexName})`);
    }
  } else if (!opensearch) {
    console.warn("[seed:demo] OPENSEARCH_URL not set — skipping search index. Products won't appear in search.");
  }

  console.log("[seed:demo] Done.");
}

seed()
  .catch((err) => {
    console.error("[seed:demo] Fatal:", err);
    process.exit(1);
  })
  .finally(() => {
    pool.end().catch(() => {});
  });
