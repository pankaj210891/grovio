import { and, eq } from "drizzle-orm";
import type { Job } from "bullmq";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Client } from "@opensearch-project/opensearch";
import type { Env } from "../../config/env.js";
import {
  products,
  attributeDefinitions,
  categories,
} from "../../db/schema/index.js";
import { getIndexName } from "../search/opensearch-mapping.js";

// ---------------------------------------------------------------------------
// Job payload type
// ---------------------------------------------------------------------------

export interface ProductIndexJobData {
  productId: string;
  action: "index" | "delete";
}

// ---------------------------------------------------------------------------
// Document shape for the index body
// ---------------------------------------------------------------------------

export interface ProductSearchDocument {
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  vendorId: string;
  status: string;
  basePriceMinor: number;
  /** Only is_searchable=true attribute values are included (D-15, Anti-Pattern 6). */
  attributes: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Pure helper: buildSearchDocument
// ---------------------------------------------------------------------------

/**
 * Builds the OpenSearch document body from a product and the list of
 * attribute keys that are marked is_searchable=true.
 *
 * CRITICAL: Only the `searchableAttrKeys` keys are picked from `product.attributes`.
 * Raw JSONB attribute keys are NEVER spread directly — this prevents the mapping
 * explosion described in Anti-Pattern 6 / Pitfall 2 and implements D-15 / SRCH-04.
 *
 * Pure function — no I/O side effects. Can be unit-tested in isolation.
 *
 * @param product - Product data including its raw JSONB attributes and metadata.
 * @param searchableAttrKeys - Attribute definition keys where is_searchable=true.
 * @returns OpenSearch document body.
 */
export function buildSearchDocument(
  product: {
    name: string;
    description: string | null;
    categoryId: string;
    categoryName: string;
    vendorId: string;
    status: string;
    basePriceMinor: number;
    attributes: Record<string, unknown>;
  },
  searchableAttrKeys: string[]
): ProductSearchDocument {
  // Project ONLY the is_searchable attribute values — never spread raw JSONB.
  // This is the core of Anti-Pattern 6 / D-15 / SRCH-04 protection.
  const filteredAttributes: Record<string, unknown> = {};
  for (const key of searchableAttrKeys) {
    if (Object.prototype.hasOwnProperty.call(product.attributes, key)) {
      filteredAttributes[key] = product.attributes[key];
    }
  }

  return {
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
    vendorId: product.vendorId,
    status: product.status,
    basePriceMinor: product.basePriceMinor,
    attributes: filteredAttributes,
  };
}

// ---------------------------------------------------------------------------
// Job processor dependencies
// ---------------------------------------------------------------------------

interface ProductIndexJobDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  opensearch: Client;
  env: Pick<Env, "NODE_ENV">;
}

// ---------------------------------------------------------------------------
// processProductIndexJob
// ---------------------------------------------------------------------------

/**
 * BullMQ job processor for product indexing and deletion.
 *
 * Handles two actions:
 * - `delete`: Removes the product document from OpenSearch (D-13, Pitfall 7).
 *   Tolerates 404 (document already absent — idempotent).
 * - `index`: Loads the product from PostgreSQL (with category + searchable
 *   attribute definitions), builds a document using ONLY is_searchable=true
 *   attribute keys (D-15, Anti-Pattern 6, SRCH-04), and upserts it into
 *   the NODE_ENV-scoped index.
 *
 * The index name is derived from env.NODE_ENV — dev/test/prod are isolated.
 *
 * Retry-safe: if the job is re-queued (e.g. on OpenSearch timeout), the
 * same upsert/delete is applied idempotently.
 *
 * @param job - BullMQ Job with data: { productId, action }.
 * @param deps - Injected dependencies (db, opensearch, env).
 */
export async function processProductIndexJob(
  job: Job,
  deps: ProductIndexJobDeps
): Promise<void> {
  const { db, opensearch, env: jobEnv } = deps;
  const { productId, action } = job.data as ProductIndexJobData;
  const indexName = getIndexName(jobEnv);

  // ── Action: delete ────────────────────────────────────────────────────────
  if (action === "delete") {
    try {
      await opensearch.delete({ index: indexName, id: productId });
    } catch (err) {
      // Tolerate 404 — document was already absent (idempotent delete)
      const anyErr = err as { statusCode?: number; meta?: { statusCode?: number } };
      const statusCode =
        anyErr.statusCode ?? anyErr.meta?.statusCode;
      if (statusCode !== 404) {
        throw err;
      }
    }
    return;
  }

  // ── Action: index ─────────────────────────────────────────────────────────
  //
  // Load product + its category name + the category's attribute_definitions
  // filtered to is_searchable=true. This is done in a single joined SELECT
  // that returns one row per searchable attribute definition.
  //
  // If the product has no searchable attributes, the join still returns
  // the product row (LEFT JOIN) so we can build a minimal document.

  const rows = await db
    .select({
      p_id: products.id,
      p_name: products.name,
      p_description: products.description,
      p_category_id: products.categoryId,
      p_vendor_id: products.vendorId,
      p_status: products.status,
      p_base_price_minor: products.basePriceMinor,
      p_attributes: products.attributes,
      cat_name: categories.name,
      ad_key: attributeDefinitions.key,
      ad_is_searchable: attributeDefinitions.isSearchable,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(
      attributeDefinitions,
      and(
        eq(attributeDefinitions.categoryId, products.categoryId),
        eq(attributeDefinitions.isSearchable, true)
      )
    )
    .where(eq(products.id, productId));

  if (rows.length === 0) {
    // Product not found — nothing to index. This can happen if the product
    // was deleted between job enqueue and processing. Skip silently.
    return;
  }

  // The first row always carries the product fields (LEFT JOIN guarantees it).
  const firstRow = rows[0]!;

  // Collect all is_searchable attribute keys from the joined attribute rows.
  // Rows where ad_key is null mean no searchable attributes exist (LEFT JOIN null).
  const searchableAttrKeys = rows
    .filter((r) => r.ad_key !== null && r.ad_is_searchable === true)
    .map((r) => r.ad_key as string);

  const doc = buildSearchDocument(
    {
      name: firstRow.p_name,
      description: firstRow.p_description,
      categoryId: firstRow.p_category_id,
      categoryName: firstRow.cat_name ?? "",
      vendorId: firstRow.p_vendor_id,
      status: firstRow.p_status,
      basePriceMinor: firstRow.p_base_price_minor,
      attributes: firstRow.p_attributes,
    },
    searchableAttrKeys
  );

  await opensearch.index({
    index: indexName,
    id: productId,
    body: doc,
  });
}
