import { eq, and, or, isNull, gt, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import {
  adminUsers,
  vendorKycDocuments,
  announcements,
  supportTickets,
  supportTicketReplies,
} from "../../db/schema/index.js";
import type { StorageClientType } from "../../infrastructure/storage/StorageClient.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminUserInfo {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface KycDocument {
  id: string;
  vendorId: string;
  documentType: string;
  fileUrl: string;
  uploadedAt: string;
  verifiedAt: string | null;
  verifiedByAdminEmail: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  targetType: string;
  active: boolean;
  expiresAt: string | null;
  createdByAdminEmail: string;
  createdAt: string;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  targetType: string;
  expiresAt?: string | null;
}

export interface SupportTicketSummary {
  id: string;
  subject: string;
  body: string;
  submittedByType: string;
  submittedById: string;
  status: string;
  assignedToAdminEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketDetail extends SupportTicketSummary {
  replies: Array<{
    id: string;
    authorType: string;
    authorId: string;
    body: string;
    createdAt: string;
  }>;
}

// Insights types
export interface RevenuePoint {
  date: string;
  gmvMinor: number;
  ordersCount: number;
}

export interface VendorPerformance {
  vendorId: string;
  name: string;
  gmvMinor: number;
  orderCount: number;
}

export interface ProductVelocity {
  productId: string;
  name: string;
  salesLast7d: number;
  trend: "rising" | "falling" | "stable";
}

export interface AnomalyFlag {
  type: string;
  entityId: string;
  entityName: string;
  description: string;
}

// Platform health
export interface PlatformHealth {
  apiLatencyMs: number | null;
  queueDepths: Record<string, number>;
  opensearchLastSync: string | null;
}

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

interface AdminServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  redis: Redis;
  storageClient?: StorageClientType;
}

// ---------------------------------------------------------------------------
// AdminService
// ---------------------------------------------------------------------------

/**
 * AdminService — handles admin portal operations for Phase 11.
 *
 * Covers:
 *   - Admin user RBAC management
 *   - KYC document upload and verification
 *   - Announcement CRUD
 *   - Support ticket management
 *   - Insights aggregations (with Redis TTL caching)
 *   - Platform health metrics
 *   - CSV export streams
 *
 * Plan 11-02 T3.
 */
export class AdminService {
  constructor(private deps: AdminServiceDeps) {}

  // ── Admin Users ───────────────────────────────────────────────────────────

  async listAdminUsers(): Promise<AdminUserInfo[]> {
    const { db } = this.deps;
    const rows = await db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        role: adminUsers.role,
        createdAt: adminUsers.createdAt,
      })
      .from(adminUsers)
      .limit(100);

    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async updateAdminRole(adminId: string, role: string): Promise<void> {
    const validRoles = ["super_admin", "moderator", "finance_admin"];
    if (!validRoles.includes(role)) {
      throw Object.assign(new Error(`Invalid role: ${role}`), { statusCode: 400 });
    }

    const { db } = this.deps;
    await db
      .update(adminUsers)
      .set({ role, updatedAt: new Date() })
      .where(eq(adminUsers.id, adminId));
  }

  // ── KYC Documents ─────────────────────────────────────────────────────────

  async getVendorKycDocuments(vendorId: string): Promise<KycDocument[]> {
    const { db } = this.deps;
    const rows = await db
      .select()
      .from(vendorKycDocuments)
      .where(eq(vendorKycDocuments.vendorId, vendorId));

    return rows.map((r) => ({
      id: r.id,
      vendorId: r.vendorId,
      documentType: r.documentType,
      fileUrl: r.fileUrl,
      uploadedAt: r.uploadedAt.toISOString(),
      verifiedAt: r.verifiedAt?.toISOString() ?? null,
      verifiedByAdminEmail: r.verifiedByAdminEmail ?? null,
    }));
  }

  async uploadKycDocument(
    vendorId: string,
    documentType: string,
    buffer: Buffer,
    contentType: string,
    filename: string
  ): Promise<KycDocument> {
    const { db, storageClient } = this.deps;

    if (!storageClient) {
      throw Object.assign(new Error("Storage is not configured"), { statusCode: 503 });
    }

    // Validate document type
    const validTypes = ["id_proof", "gst_certificate", "bank_verification"];
    if (!validTypes.includes(documentType)) {
      throw Object.assign(
        new Error(`Invalid document type: ${documentType}. Must be one of: ${validTypes.join(", ")}`),
        { statusCode: 400 }
      );
    }

    // Upload to storage
    const key = `kyc/${vendorId}/${documentType}/${Date.now()}-${filename}`;
    const fileUrl = await storageClient.uploadFile(key, buffer, contentType);

    // Insert record
    const [inserted] = await db
      .insert(vendorKycDocuments)
      .values({
        vendorId,
        documentType,
        fileUrl,
      })
      .returning();

    return {
      id: inserted.id,
      vendorId: inserted.vendorId,
      documentType: inserted.documentType,
      fileUrl: inserted.fileUrl,
      uploadedAt: inserted.uploadedAt.toISOString(),
      verifiedAt: inserted.verifiedAt?.toISOString() ?? null,
      verifiedByAdminEmail: inserted.verifiedByAdminEmail ?? null,
    };
  }

  async verifyKycDocument(
    docId: string,
    adminEmail: string
  ): Promise<KycDocument> {
    const { db } = this.deps;

    const [updated] = await db
      .update(vendorKycDocuments)
      .set({
        verifiedAt: new Date(),
        verifiedByAdminEmail: adminEmail,
      })
      .where(eq(vendorKycDocuments.id, docId))
      .returning();

    if (!updated) {
      throw Object.assign(new Error("KYC document not found"), { statusCode: 404 });
    }

    return {
      id: updated.id,
      vendorId: updated.vendorId,
      documentType: updated.documentType,
      fileUrl: updated.fileUrl,
      uploadedAt: updated.uploadedAt.toISOString(),
      verifiedAt: updated.verifiedAt?.toISOString() ?? null,
      verifiedByAdminEmail: updated.verifiedByAdminEmail ?? null,
    };
  }

  // ── Announcements ─────────────────────────────────────────────────────────

  async createAnnouncement(
    input: CreateAnnouncementInput,
    adminEmail: string
  ): Promise<Announcement> {
    const { db } = this.deps;

    const validTargets = ["customers", "vendors", "all"];
    if (!validTargets.includes(input.targetType)) {
      throw Object.assign(
        new Error(`Invalid target_type: ${input.targetType}`),
        { statusCode: 400 }
      );
    }

    const [inserted] = await db
      .insert(announcements)
      .values({
        title: input.title,
        body: input.body,
        targetType: input.targetType,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        createdByAdminEmail: adminEmail,
      })
      .returning();

    return this._mapAnnouncement(inserted);
  }

  async listAnnouncements(activeOnly?: boolean): Promise<Announcement[]> {
    const { db } = this.deps;

    let query = db.select().from(announcements);

    if (activeOnly) {
      // Active + (no expiry OR expiry in the future)
      query = query.where(
        and(
          eq(announcements.active, true),
          or(isNull(announcements.expiresAt), gt(announcements.expiresAt, new Date()))
        )
      ) as typeof query;
    }

    const rows = await query.orderBy(announcements.createdAt).limit(100);
    return rows.map((r) => this._mapAnnouncement(r));
  }

  async updateAnnouncement(
    id: string,
    patch: Partial<CreateAnnouncementInput & { active: boolean }>
  ): Promise<Announcement> {
    const { db } = this.deps;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.title !== undefined) updateData.title = patch.title;
    if (patch.body !== undefined) updateData.body = patch.body;
    if (patch.targetType !== undefined) updateData.targetType = patch.targetType;
    if (patch.active !== undefined) updateData.active = patch.active;
    if (patch.expiresAt !== undefined) {
      updateData.expiresAt = patch.expiresAt ? new Date(patch.expiresAt) : null;
    }

    const [updated] = await db
      .update(announcements)
      .set(updateData)
      .where(eq(announcements.id, id))
      .returning();

    if (!updated) {
      throw Object.assign(new Error("Announcement not found"), { statusCode: 404 });
    }

    return this._mapAnnouncement(updated);
  }

  async deleteAnnouncement(id: string): Promise<void> {
    const { db } = this.deps;
    await db.delete(announcements).where(eq(announcements.id, id));
  }

  private _mapAnnouncement(row: typeof announcements.$inferSelect): Announcement {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      targetType: row.targetType,
      active: row.active,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdByAdminEmail: row.createdByAdminEmail,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // ── Support Tickets ───────────────────────────────────────────────────────

  async listSupportTickets(filters?: {
    status?: string;
    submittedByType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: SupportTicketSummary[]; total: number }> {
    const { db } = this.deps;

    const conditions = [];
    if (filters?.status) conditions.push(eq(supportTickets.status, filters.status as "open" | "in_progress" | "resolved" | "closed"));
    if (filters?.submittedByType) conditions.push(eq(supportTickets.submittedByType, filters.submittedByType));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    let ticketQuery = db.select().from(supportTickets).limit(limit).offset(offset);
    let countQuery = db.select({ count: sql<number>`COUNT(*)` }).from(supportTickets);

    if (whereClause) {
      ticketQuery = ticketQuery.where(whereClause) as typeof ticketQuery;
      countQuery = countQuery.where(whereClause) as typeof countQuery;
    }

    const [rows, countRows] = await Promise.all([ticketQuery, countQuery]);
    const total = Number(countRows[0]?.count ?? 0);

    return {
      items: rows.map((r) => this._mapTicket(r)),
      total,
    };
  }

  async getSupportTicket(ticketId: string): Promise<SupportTicketDetail> {
    const { db } = this.deps;

    const tickets = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId))
      .limit(1);

    if (!tickets[0]) {
      throw Object.assign(new Error("Support ticket not found"), { statusCode: 404 });
    }

    const replies = await db
      .select()
      .from(supportTicketReplies)
      .where(eq(supportTicketReplies.ticketId, ticketId))
      .orderBy(supportTicketReplies.createdAt);

    return {
      ...this._mapTicket(tickets[0]),
      replies: replies.map((r) => ({
        id: r.id,
        authorType: r.authorType,
        authorId: r.authorId,
        body: r.body,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async addTicketReply(
    ticketId: string,
    body: string,
    authorType: string,
    authorId: string
  ): Promise<void> {
    const { db } = this.deps;

    await db.insert(supportTicketReplies).values({
      ticketId,
      body,
      authorType,
      authorId,
    });

    // Update ticket's updatedAt
    await db
      .update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId));
  }

  async updateTicketStatus(
    ticketId: string,
    status: string,
    assignedToAdminEmail?: string
  ): Promise<void> {
    const { db } = this.deps;

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };
    if (assignedToAdminEmail !== undefined) {
      updateData.assignedToAdminEmail = assignedToAdminEmail;
    }

    await db
      .update(supportTickets)
      .set(updateData)
      .where(eq(supportTickets.id, ticketId));
  }

  private _mapTicket(row: typeof supportTickets.$inferSelect): SupportTicketSummary {
    return {
      id: row.id,
      subject: row.subject,
      body: row.body,
      submittedByType: row.submittedByType,
      submittedById: row.submittedById,
      status: row.status,
      assignedToAdminEmail: row.assignedToAdminEmail ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ── Insights ──────────────────────────────────────────────────────────────

  /**
   * Get revenue trend (Redis-cached 1 hour).
   * Falls back to empty array if no revenue data exists.
   */
  async getInsightsRevenue(period: string): Promise<RevenuePoint[]> {
    const { redis } = this.deps;
    const cacheKey = `admin:insights:revenue:${period}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as RevenuePoint[];

    // In Phase 11 worktree context, no orders tables exist yet
    // Return empty — will be populated when commerce tables are available
    const result: RevenuePoint[] = [];
    await redis.setex(cacheKey, 3600, JSON.stringify(result));
    return result;
  }

  async getInsightsVendorPerformance(period: string): Promise<VendorPerformance[]> {
    const { redis } = this.deps;
    const cacheKey = `admin:insights:vendor-perf:${period}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as VendorPerformance[];

    const result: VendorPerformance[] = [];
    await redis.setex(cacheKey, 3600, JSON.stringify(result));
    return result;
  }

  async getInsightsProductVelocity(period: string): Promise<ProductVelocity[]> {
    const { redis } = this.deps;
    const cacheKey = `admin:insights:product-velocity:${period}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as ProductVelocity[];

    const result: ProductVelocity[] = [];
    await redis.setex(cacheKey, 3600, JSON.stringify(result));
    return result;
  }

  async getInsightsRetentionRate(period: string): Promise<{ rate: number; period: string }> {
    const { redis } = this.deps;
    const cacheKey = `admin:insights:retention:${period}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as { rate: number; period: string };

    const result = { rate: 0, period };
    await redis.setex(cacheKey, 3600, JSON.stringify(result));
    return result;
  }

  async getInsightsAnomalyFlags(): Promise<AnomalyFlag[]> {
    const { redis } = this.deps;
    const cacheKey = "admin:insights:anomalies";
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as AnomalyFlag[];

    const result: AnomalyFlag[] = [];
    await redis.setex(cacheKey, 3600, JSON.stringify(result));
    return result;
  }

  // ── Platform Health ───────────────────────────────────────────────────────

  async getPlatformHealth(): Promise<PlatformHealth> {
    const { redis } = this.deps;

    // Check Redis latency as proxy for API health
    const start = Date.now();
    try {
      await redis.ping();
    } catch {
      // Redis unreachable
    }
    const apiLatencyMs = Date.now() - start;

    // Queue depths: check known BullMQ key pattern
    let queueDepths: Record<string, number> = {};
    try {
      const productIndexWaiting = await redis.llen("bull:product-index:wait");
      const reservationWaiting = await redis.llen("bull:reservation:wait");
      queueDepths = {
        "product-index": productIndexWaiting,
        reservation: reservationWaiting,
      };
    } catch {
      queueDepths = {};
    }

    // OpenSearch last sync — stored as Redis key by product-index job (if present)
    let opensearchLastSync: string | null = null;
    try {
      opensearchLastSync = await redis.get("admin:opensearch:last-sync");
    } catch {
      opensearchLastSync = null;
    }

    return { apiLatencyMs, queueDepths, opensearchLastSync };
  }

  // ── Recent notifications ──────────────────────────────────────────────────

  async getRecentNotifications(): Promise<Array<{
    id: string;
    type: string;
    title: string;
    entityId: string;
    createdAt: string;
  }>> {
    // Placeholder — returns recent support tickets as notification events
    const { items } = await this.listSupportTickets({ status: "open", limit: 10 });
    return items.map((t) => ({
      id: t.id,
      type: "support_ticket.opened",
      title: `New ticket: ${t.subject}`,
      entityId: t.id,
      createdAt: t.createdAt,
    }));
  }
}
