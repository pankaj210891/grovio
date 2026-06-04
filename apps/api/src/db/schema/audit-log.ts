import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * audit_log table — append-only action event log (D-13, ADM-07, T-06-04).
 *
 * Records meaningful semantic actions performed by admin, vendor, or system actors.
 * Written by service-layer methods (not middleware) — only intentional actions are logged.
 *
 * Action namespace convention (D-13 specifics section):
 *   {entity}.{verb} — e.g.:
 *   - vendor.approved, vendor.suspended, vendor.reinstated
 *   - product.approved, product.rejected
 *   - commission_rule.created, commission_rule.updated, commission_rule.deleted
 *   - payout.settled
 *   - feature_flag.toggled
 *   - homepage_block.created, homepage_block.updated, homepage_block.deleted
 *   - return_request.approved, return_request.rejected
 *   - vendor_payout_info.updated
 *
 * Key design decisions:
 * - NO updatedAt column — APPEND-ONLY. Existing rows are NEVER modified (T-06-04).
 *   This makes the audit trail tamper-evident.
 * - before/after: JSONB nullable — captures the state change for each logged action.
 *   Both null for create/delete events where the full snapshot is less relevant.
 *   Both non-null for update events (capturing what changed).
 * - actorEmail: denormalized — stored directly to ensure the audit record is
 *   self-contained even if the actor account is later deleted.
 * - actorType: 'admin' | 'vendor' | 'system' — matches AuditActorTypeSchema in contracts.
 * - entityId: text (not uuid FK) — avoids tight coupling to specific entity tables.
 *   Service layer provides the UUID string; AuditService does not validate FK existence.
 * - ipAddress: nullable — captured from request for admin/vendor actions, null for system.
 *
 * Admin audit log page: filterable table (by actor, action type, entity type, date range).
 * Covers D-13, ADM-07, T-06-04.
 */
export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * Type of actor who performed this action (D-13).
   * 'admin': admin panel action via AdminAuthService JWT
   * 'vendor': vendor panel action via VendorAuthService JWT
   * 'system': background job or automated process (no human actor)
   * Matches AuditActorTypeSchema z.enum in @grovio/contracts.
   */
  actorType: text("actor_type").notNull(),

  /**
   * ID of the actor. For admin/vendor, this is their UUID from admin_users/vendor_users.
   * For system, a descriptive identifier (e.g., 'inventory-expiry-job').
   * Stored as text (not uuid FK) for flexibility across actor types.
   */
  actorId: text("actor_id").notNull(),

  /**
   * Email of the actor who performed this action.
   * Denormalized — stored directly so the audit record is self-contained
   * even if the actor account is later deleted or email changes.
   */
  actorEmail: text("actor_email").notNull(),

  /**
   * Dot-namespaced action identifier (D-13 specifics section).
   * Format: '{entity}.{verb}' — e.g., 'vendor.approved', 'payout.settled'.
   * Used for filtering in the admin audit log page.
   */
  action: text("action").notNull(),

  /**
   * Type of the entity affected by this action.
   * e.g., 'vendor', 'product', 'commission_rule', 'feature_flag', 'homepage_block'.
   * Used for filtering in the admin audit log page.
   */
  entityType: text("entity_type").notNull(),

  /**
   * ID of the entity affected by this action.
   * Stored as text (UUID string or other identifier) — no FK constraint.
   * Service layer provides the correct ID; AuditService does not validate it.
   */
  entityId: text("entity_id").notNull(),

  /**
   * State of the entity BEFORE this action was applied (D-13).
   * JSONB: captures the relevant fields that were changed.
   * null for create events (no prior state) or when before-state capture is not applicable.
   */
  before: jsonb("before"),

  /**
   * State of the entity AFTER this action was applied (D-13).
   * JSONB: captures the resulting state of changed fields.
   * null for delete events (entity no longer exists) or when after-state capture is not applicable.
   */
  after: jsonb("after"),

  /**
   * IP address of the request that triggered this action.
   * null for system-generated events (background jobs, scheduled tasks).
   * Extracted from request.ip in the route handler and passed to AuditService.
   */
  ipAddress: text("ip_address"),

  /**
   * Row creation timestamp.
   * NO updatedAt — APPEND-ONLY constraint (T-06-04, D-13).
   * Once inserted, audit log rows are immutable.
   */
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // NO updatedAt — intentionally absent (append-only constraint, T-06-04)
});

/** TypeScript type for inserting a new audit_log row */
export type InsertAuditLog = typeof auditLog.$inferInsert;

/** TypeScript type for selecting an audit_log row */
export type SelectAuditLog = typeof auditLog.$inferSelect;
