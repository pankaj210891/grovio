import { z } from "zod";

/**
 * Admin audit log contract types for Phase 6: Vendor & Admin Tools.
 *
 * Per ADM-07, D-13: audit_log table — id, actor_type (admin/vendor/system),
 *   actor_id, actor_email, action (dot-namespaced e.g. "vendor.approved"),
 *   entity_type, entity_id, before JSONB, after JSONB, ip_address, created_at.
 *
 * Events are written by service-layer methods — not middleware — so only
 *   meaningful semantic actions are logged.
 *
 * Action namespace convention (D-13):
 *   {entity}.{verb} — e.g., vendor.approved, vendor.suspended, product.approved,
 *   commission_rule.updated, payout.settled, feature_flag.toggled, etc.
 */

// ---------------------------------------------------------------------------
// Audit Actor Type (D-13, ADM-07)
// ---------------------------------------------------------------------------

/**
 * Actor type for audit log entries.
 * Values MUST exactly match the actor_type check constraint on the audit_log table.
 */
export const AuditActorTypeSchema = z.enum(["admin", "vendor", "system"]);

/** TypeScript type inferred from AuditActorTypeSchema */
export type AuditActorType = z.infer<typeof AuditActorTypeSchema>;

// ---------------------------------------------------------------------------
// Audit Log Entry (D-13, ADM-07)
// ---------------------------------------------------------------------------

/**
 * A single audit log entry as returned by the admin audit log API.
 */
export const AuditLogEntrySchema = z.object({
  /** audit_log row ID (UUID) */
  id: z.string().uuid(),
  /** Type of actor who performed the action */
  actorType: AuditActorTypeSchema,
  /** UUID of the actor (admin_users.id or vendor_users.id or "system") */
  actorId: z.string(),
  /** Email of the actor at time of action (denormalized for display) */
  actorEmail: z.string(),
  /**
   * Dot-namespaced action identifier (e.g., "vendor.approved", "product.rejected").
   * Convention: {entity}.{verb} per D-13 specifics.
   */
  action: z.string(),
  /** Entity type affected (e.g., "vendor", "product", "commission_rule") */
  entityType: z.string(),
  /** UUID of the affected entity */
  entityId: z.string(),
  /** State before the action (JSONB, null for creation events) */
  before: z.unknown().nullable(),
  /** State after the action (JSONB, null for deletion events) */
  after: z.unknown().nullable(),
  /** IP address of the request (nullable — may be null for system actions) */
  ipAddress: z.string().nullable(),
  /** ISO-8601 timestamp when the event was recorded */
  createdAt: z.string().datetime(),
});

/** TypeScript type inferred from AuditLogEntrySchema */
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

// ---------------------------------------------------------------------------
// Audit Log Query (D-13, ADM-07)
// ---------------------------------------------------------------------------

/**
 * Query parameters for the admin audit log endpoint (GET /admin/audit-log).
 * All filters are optional — returns all events when no filters specified.
 */
export const AuditLogQuerySchema = z.object({
  /** Filter by actor type */
  actorType: AuditActorTypeSchema.optional(),
  /** Filter by action (exact match, e.g., "vendor.approved") */
  action: z.string().optional(),
  /** Filter by entity type (e.g., "vendor", "product") */
  entityType: z.string().optional(),
  /** Filter by events on or after this ISO-8601 date-time */
  from: z.string().datetime().optional(),
  /** Filter by events on or before this ISO-8601 date-time */
  to: z.string().datetime().optional(),
  /** Maximum number of entries to return (default 50, max 200) */
  limit: z.number().int().min(1).max(200).optional(),
  /** Offset into the result set for pagination */
  offset: z.number().int().min(0).optional(),
});

/** TypeScript type inferred from AuditLogQuerySchema */
export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;

// ---------------------------------------------------------------------------
// Audit Log Response (D-13, ADM-07)
// ---------------------------------------------------------------------------

/**
 * Paginated audit log response returned by GET /admin/audit-log.
 */
export const AuditLogResponseSchema = z.object({
  /** Array of audit log entries (newest first) */
  items: z.array(AuditLogEntrySchema),
  /** Total count of matching entries (for pagination UI) */
  total: z.number().int(),
  /** Page size used */
  limit: z.number().int(),
  /** Offset into the result set */
  offset: z.number().int(),
});

/** TypeScript type inferred from AuditLogResponseSchema */
export type AuditLogResponse = z.infer<typeof AuditLogResponseSchema>;
