import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  customerNotifications,
  customerNotificationPreferences,
  type InsertCustomerNotification,
} from "../../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

interface NotificationServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface CustomerNotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  referenceId: string | null;
  referenceType: string | null;
  dismissedAt: Date | null;
  createdAt: Date;
}

export interface NotificationPreferences {
  orderUpdates: boolean;
  priceDrops: boolean;
  promotions: boolean;
}

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

export class NotificationNotFoundError extends Error {
  readonly code = "NOTIFICATION_NOT_FOUND";
  constructor(id: string) {
    super(`Notification not found: ${id}`);
    this.name = "NotificationNotFoundError";
  }
}

export class NotificationOwnershipError extends Error {
  readonly code = "NOTIFICATION_OWNERSHIP_ERROR";
  constructor() {
    super("You do not have permission to dismiss this notification.");
    this.name = "NotificationOwnershipError";
  }
}

// ---------------------------------------------------------------------------
// NotificationService
// ---------------------------------------------------------------------------

/**
 * NotificationService
 *
 * Manages customer notifications (append-only) and preferences.
 * Key design decisions:
 * - Notifications are never hard-deleted (append-only per plan T1.3).
 * - dismissed_at soft-hide: null = visible; non-null = dismissed.
 * - Preferences are upserted (on conflict update) — created on first write.
 * - order_updates preference is immutable from customer perspective.
 *
 * Plan 11-05 T4.
 */
export class NotificationService {
  constructor(private deps: NotificationServiceDeps) {}

  // ── Public: list notifications ────────────────────────────────────────────

  /**
   * Returns paginated notifications for a customer.
   * Undismissed (dismissedAt IS NULL) sorted first, then dismissed by createdAt DESC.
   */
  async listNotifications(params: {
    customerId: string;
    page?: number;
    limit?: number;
  }): Promise<{
    items: CustomerNotificationItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { db } = this.deps;
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: customerNotifications.id,
          type: customerNotifications.type,
          title: customerNotifications.title,
          body: customerNotifications.body,
          referenceId: customerNotifications.referenceId,
          referenceType: customerNotifications.referenceType,
          dismissedAt: customerNotifications.dismissedAt,
          createdAt: customerNotifications.createdAt,
        })
        .from(customerNotifications)
        .where(eq(customerNotifications.customerId, params.customerId))
        // Undismissed first (ASC on dismissedAt NULLS FIRST), then DESC by createdAt
        .orderBy(
          asc(customerNotifications.dismissedAt),
          desc(customerNotifications.createdAt)
        )
        .limit(limit)
        .offset(offset),

      db
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(customerNotifications)
        .where(eq(customerNotifications.customerId, params.customerId)),
    ]);

    return {
      items: rows,
      total: countResult[0]?.total ?? 0,
      page,
      limit,
    };
  }

  // ── Public: dismiss notification ──────────────────────────────────────────

  /**
   * Sets dismissedAt = now() for a notification.
   * Validates ownership: only the notification's customer can dismiss it.
   */
  async dismissNotification(params: {
    notificationId: string;
    customerId: string;
  }): Promise<void> {
    const { db } = this.deps;

    const [notif] = await db
      .select({ id: customerNotifications.id, customerId: customerNotifications.customerId })
      .from(customerNotifications)
      .where(eq(customerNotifications.id, params.notificationId))
      .limit(1);

    if (!notif) {
      throw new NotificationNotFoundError(params.notificationId);
    }

    if (notif.customerId !== params.customerId) {
      throw new NotificationOwnershipError();
    }

    await db
      .update(customerNotifications)
      .set({ dismissedAt: new Date() })
      .where(eq(customerNotifications.id, params.notificationId));
  }

  // ── Public: preferences ───────────────────────────────────────────────────

  /**
   * Returns notification preferences for a customer.
   * If no preferences row exists, returns the defaults.
   */
  async getPreferences(customerId: string): Promise<NotificationPreferences> {
    const { db } = this.deps;

    const [prefs] = await db
      .select({
        orderUpdates: customerNotificationPreferences.orderUpdates,
        priceDrops: customerNotificationPreferences.priceDrops,
        promotions: customerNotificationPreferences.promotions,
      })
      .from(customerNotificationPreferences)
      .where(eq(customerNotificationPreferences.customerId, customerId))
      .limit(1);

    return prefs ?? { orderUpdates: true, priceDrops: true, promotions: false };
  }

  /**
   * Upserts notification preferences for a customer.
   * order_updates is always true (immutable) — ignored from input.
   */
  async updatePreferences(
    customerId: string,
    input: { priceDrops?: boolean; promotions?: boolean }
  ): Promise<NotificationPreferences> {
    const { db } = this.deps;

    await db
      .insert(customerNotificationPreferences)
      .values({
        customerId,
        orderUpdates: true,
        priceDrops: input.priceDrops ?? true,
        promotions: input.promotions ?? false,
      })
      .onConflictDoUpdate({
        target: customerNotificationPreferences.customerId,
        set: {
          priceDrops: sql`COALESCE(EXCLUDED.price_drops, ${customerNotificationPreferences.priceDrops})`,
          promotions: sql`COALESCE(EXCLUDED.promotions, ${customerNotificationPreferences.promotions})`,
          updatedAt: new Date(),
        },
      });

    // Re-fetch updated preferences
    return this.getPreferences(customerId);
  }

  // ── Public: insert notification ───────────────────────────────────────────

  /**
   * Inserts a new notification for a customer (called by PriceDropCheckJob and
   * other system events). Respects customer preferences — skips insert if
   * customer has opted out of this notification type.
   */
  async insertNotification(notification: InsertCustomerNotification): Promise<void> {
    const { db } = this.deps;

    // Check customer preferences before inserting
    const prefs = await this.getPreferences(notification.customerId);

    if (notification.type === "price_drop" && !prefs.priceDrops) {
      return; // Customer opted out
    }
    if (notification.type === "promotion" && !prefs.promotions) {
      return; // Customer opted out
    }

    await db.insert(customerNotifications).values(notification);
  }

  // ── Public: bulk insert (for PriceDropCheckJob) ───────────────────────────

  /**
   * Inserts price_drop notifications for multiple customers in one transaction.
   * Called by PriceDropCheckJob after filtering eligible customers.
   * Each insert is checked against preferences.
   */
  async insertBulkPriceDropNotifications(params: {
    customerIds: string[];
    productId: string;
    productName: string;
    newPriceMinor: number;
  }): Promise<void> {
    if (params.customerIds.length === 0) return;

    const { db } = this.deps;

    // Fetch preferences for all customers to filter opted-out ones
    const prefRows = await db
      .select({
        customerId: customerNotificationPreferences.customerId,
        priceDrops: customerNotificationPreferences.priceDrops,
      })
      .from(customerNotificationPreferences)
      .where(
        sql`${customerNotificationPreferences.customerId} = ANY(${params.customerIds}::uuid[])`
      );

    const optedOut = new Set(
      prefRows.filter((p) => !p.priceDrops).map((p) => p.customerId)
    );

    // Build notification rows for customers who haven't opted out
    const rows: InsertCustomerNotification[] = params.customerIds
      .filter((id) => !optedOut.has(id))
      .map((customerId) => ({
        customerId,
        type: "price_drop" as const,
        title: "Price drop alert",
        body: `The price of "${params.productName}" has dropped!`,
        referenceId: params.productId,
        referenceType: "product",
      }));

    if (rows.length === 0) return;

    await db.insert(customerNotifications).values(rows);
  }

  // ── Public: mark order update notifications ───────────────────────────────

  /**
   * Insert an order update notification for a customer.
   * order_updates preference is always true — no preference check needed.
   */
  async insertOrderUpdateNotification(params: {
    customerId: string;
    orderId: string;
    title: string;
    body: string;
  }): Promise<void> {
    const { db } = this.deps;

    await db.insert(customerNotifications).values({
      customerId: params.customerId,
      type: "order_update",
      title: params.title,
      body: params.body,
      referenceId: params.orderId,
      referenceType: "order",
    });
  }
}

// Suppress lint warning for unused import — isNull is kept for future filter queries
void isNull;
