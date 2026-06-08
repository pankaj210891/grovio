import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  supportTickets,
  supportTicketReplies,
  type InsertSupportTicket,
  type InsertSupportTicketReply,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

interface SupportServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface SupportTicketSummary {
  id: string;
  subject: string;
  body: string;
  status: string;
  submittedByType: string;
  submittedById: string;
  assignedToAdminEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupportTicketDetail extends SupportTicketSummary {
  replies: SupportTicketReply[];
}

export interface SupportTicketReply {
  id: string;
  ticketId: string;
  authorType: string;
  authorId: string;
  body: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

export class SupportTicketNotFoundError extends Error {
  readonly code = "SUPPORT_TICKET_NOT_FOUND";
  constructor(id: string) {
    super(`Support ticket not found: ${id}`);
    this.name = "SupportTicketNotFoundError";
  }
}

export class SupportTicketOwnershipError extends Error {
  readonly code = "SUPPORT_TICKET_OWNERSHIP_ERROR";
  constructor() {
    super("You do not have permission to access this support ticket.");
    this.name = "SupportTicketOwnershipError";
  }
}

// ---------------------------------------------------------------------------
// SupportService
// ---------------------------------------------------------------------------

/**
 * SupportService
 *
 * Manages customer/vendor support ticket submission and replies.
 * Complements the admin support ticket management endpoints from Wave 2 T3.4.
 *
 * submittedByType + submittedById: polymorphic reference (no FK constraint)
 * to allow both customers and vendors to submit tickets.
 *
 * Plan 11-05 T6.
 */
export class SupportService {
  constructor(private deps: SupportServiceDeps) {}

  /**
   * Creates a new support ticket submitted by a customer or vendor.
   */
  async createTicket(params: {
    submittedByType: "customer" | "vendor";
    submittedById: string;
    subject: string;
    body: string;
  }): Promise<{ id: string }> {
    const { db } = this.deps;

    const row: InsertSupportTicket = {
      submittedByType: params.submittedByType,
      submittedById: params.submittedById,
      subject: params.subject,
      body: params.body,
      status: "open",
    };

    const [inserted] = await db
      .insert(supportTickets)
      .values(row)
      .returning({ id: supportTickets.id });

    return { id: inserted!.id };
  }

  /**
   * Lists all tickets submitted by a specific user (customer or vendor).
   */
  async listTicketsBySubmitter(params: {
    submittedByType: "customer" | "vendor";
    submittedById: string;
  }): Promise<SupportTicketSummary[]> {
    const { db } = this.deps;

    const rows = await db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        body: supportTickets.body,
        status: supportTickets.status,
        submittedByType: supportTickets.submittedByType,
        submittedById: supportTickets.submittedById,
        assignedToAdminEmail: supportTickets.assignedToAdminEmail,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
      })
      .from(supportTickets)
      .where(
        and(
          eq(supportTickets.submittedByType, params.submittedByType),
          eq(supportTickets.submittedById, params.submittedById)
        )
      )
      .orderBy(desc(supportTickets.createdAt));

    return rows;
  }

  /**
   * Gets a ticket by ID, validating ownership.
   * Includes all replies.
   */
  async getTicketWithReplies(params: {
    ticketId: string;
    submittedByType: "customer" | "vendor";
    submittedById: string;
  }): Promise<SupportTicketDetail> {
    const { db } = this.deps;

    const [ticket] = await db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        body: supportTickets.body,
        status: supportTickets.status,
        submittedByType: supportTickets.submittedByType,
        submittedById: supportTickets.submittedById,
        assignedToAdminEmail: supportTickets.assignedToAdminEmail,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
      })
      .from(supportTickets)
      .where(eq(supportTickets.id, params.ticketId))
      .limit(1);

    if (!ticket) {
      throw new SupportTicketNotFoundError(params.ticketId);
    }

    // Ownership check
    if (
      ticket.submittedByType !== params.submittedByType ||
      ticket.submittedById !== params.submittedById
    ) {
      throw new SupportTicketOwnershipError();
    }

    const replies = await db
      .select({
        id: supportTicketReplies.id,
        ticketId: supportTicketReplies.ticketId,
        authorType: supportTicketReplies.authorType,
        authorId: supportTicketReplies.authorId,
        body: supportTicketReplies.body,
        createdAt: supportTicketReplies.createdAt,
      })
      .from(supportTicketReplies)
      .where(eq(supportTicketReplies.ticketId, params.ticketId))
      .orderBy(supportTicketReplies.createdAt);

    return { ...ticket, replies };
  }

  /**
   * Adds a reply to a ticket, validating ownership.
   */
  async addReply(params: {
    ticketId: string;
    authorType: "customer" | "vendor" | "admin";
    authorId: string;
    body: string;
    // For ownership validation (non-admin callers must own the ticket)
    ownerType?: "customer" | "vendor";
    ownerId?: string;
  }): Promise<{ id: string }> {
    const { db } = this.deps;

    // For non-admin callers, validate ticket ownership
    if (params.ownerType && params.ownerId) {
      const [ticket] = await db
        .select({ submittedByType: supportTickets.submittedByType, submittedById: supportTickets.submittedById })
        .from(supportTickets)
        .where(eq(supportTickets.id, params.ticketId))
        .limit(1);

      if (!ticket) {
        throw new SupportTicketNotFoundError(params.ticketId);
      }

      if (
        ticket.submittedByType !== params.ownerType ||
        ticket.submittedById !== params.ownerId
      ) {
        throw new SupportTicketOwnershipError();
      }
    }

    const row: InsertSupportTicketReply = {
      ticketId: params.ticketId,
      authorType: params.authorType,
      authorId: params.authorId,
      body: params.body,
    };

    const [inserted] = await db
      .insert(supportTicketReplies)
      .values(row)
      .returning({ id: supportTicketReplies.id });

    return { id: inserted!.id };
  }
}
