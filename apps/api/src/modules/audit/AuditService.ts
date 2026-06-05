import { and, asc, count, desc, eq, gte, lte } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { auditLog } from "../../db/schema/index.js";
import type { AuditLogEntry, AuditLogQuery } from "@grovio/contracts/admin/audit";

interface AuditServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  // NO redis — AuditService is append-only with no caching (T-06-13, D-13)
}

/**
 * Log parameters for a single audit event.
 */
export interface AuditLogParams {
  /** Type of actor who performed this action ('admin' | 'vendor' | 'system') */
  actorType: "admin" | "vendor" | "system";
  /** UUID of the actor (admin_users.id, vendor_users.id, or job name for system) */
  actorId: string;
  /** Email of the actor — denormalized for audit record self-containment */
  actorEmail: string;
  /** Dot-namespaced action (e.g., 'vendor.approved', 'product.rejected') */
  action: string;
  /** Type of entity affected (e.g., 'vendor', 'product', 'commission_rule') */
  entityType: string;
  /** ID of the affected entity (UUID string — no FK constraint) */
  entityId: string;
  /** State before action — null for create events (optional, defaults to null) */
  before?: unknown;
  /** State after action — null for delete events (optional, defaults to null) */
  after?: unknown;
  /** IP address of the request — null for system-generated events (optional) */
  ipAddress?: string;
}

/**
 * AuditService
 *
 * Append-only audit log writer (D-13, ADM-07, T-06-13).
 *
 * Design constraints:
 * - INSERT only — no UPDATE method exists. Every write creates a new row.
 * - No Redis dependency — audit log is not cached; every event is durably committed.
 * - Action convention enforced by callers (Wave 5 services), not by AuditService.
 *   AuditService stores whatever action string it receives.
 *
 * Methods:
 * - log(params) → inserts one audit_log row (append-only, no return value)
 * - query(filter) → filtered/paginated read of audit_log (admin audit log page)
 *
 * The dot-namespaced action convention ({entity}.{verb}) is enforced at the caller
 * level. Examples: vendor.approved, payout.settled, feature_flag.toggled.
 *
 * Covers D-13, ADM-07, T-06-13.
 */
export class AuditService {
  constructor(private deps: AuditServiceDeps) {}

  /**
   * Append a single event to the audit log (D-13, T-06-13).
   *
   * INSERT only — this method never issues an UPDATE. The audit_log table has
   * no updatedAt column; rows are immutable once inserted (T-06-04).
   *
   * @param params - Log entry fields (see AuditLogParams)
   */
  async log(params: AuditLogParams): Promise<void> {
    const { db } = this.deps;

    await db.insert(auditLog).values({
      actorType: params.actorType,
      actorId: params.actorId,
      actorEmail: params.actorEmail,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      before: params.before ?? null,
      after: params.after ?? null,
      ipAddress: params.ipAddress ?? null,
    });
  }

  /**
   * Query the audit log with optional filters and offset pagination.
   *
   * Supports filters: actorType, action (exact match), entityType, from, to (date range).
   * Ordered by createdAt descending (newest first).
   * Returns items + total count for the admin pagination UI (D-13, ADM-07).
   *
   * @param filter - AuditLogQuery filter options from @grovio/contracts
   * @returns Paginated result { items, total, limit, offset }
   */
  async query(
    filter: AuditLogQuery,
  ): Promise<{ items: AuditLogEntry[]; total: number; limit: number; offset: number }> {
    const { db } = this.deps;

    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    // Build WHERE conditions from optional filter fields
    const conditions = [];
    if (filter.actorType) conditions.push(eq(auditLog.actorType, filter.actorType));
    if (filter.action) conditions.push(eq(auditLog.action, filter.action));
    if (filter.entityType) conditions.push(eq(auditLog.entityType, filter.entityType));
    if (filter.from) conditions.push(gte(auditLog.createdAt, new Date(filter.from)));
    if (filter.to) conditions.push(lte(auditLog.createdAt, new Date(filter.to)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Execute count and items queries concurrently
    const [countResult, rows] = await Promise.all([
      db
        .select({ count: count() })
        .from(auditLog)
        .where(whereClause),
      db
        .select()
        .from(auditLog)
        .where(whereClause)
        .orderBy(desc(auditLog.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    // Map DB rows to AuditLogEntry contract shape
    const items: AuditLogEntry[] = rows.map((row) => ({
      id: row.id,
      actorType: row.actorType as AuditLogEntry["actorType"],
      actorId: row.actorId,
      actorEmail: row.actorEmail,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      before: row.before as unknown ?? null,
      after: row.after as unknown ?? null,
      ipAddress: row.ipAddress ?? null,
      createdAt: row.createdAt.toISOString(),
    }));

    return { items, total, limit, offset };
  }
}
