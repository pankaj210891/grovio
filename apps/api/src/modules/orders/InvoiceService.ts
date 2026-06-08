import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { TDocumentDefinitions, StyleDictionary, Content } from "pdfmake/interfaces.js";
import {
  orders,
  vendorOrders,
  orderItems,
  customers,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

interface InvoiceServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
}

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

export class InvoiceOrderNotFoundError extends Error {
  readonly code = "INVOICE_ORDER_NOT_FOUND";
  constructor(orderId: string) {
    super(`Order not found: ${orderId}`);
    this.name = "InvoiceOrderNotFoundError";
  }
}

export class InvoiceOrderOwnershipError extends Error {
  readonly code = "INVOICE_ORDER_OWNERSHIP_ERROR";
  constructor() {
    super("You do not have permission to download this invoice.");
    this.name = "InvoiceOrderOwnershipError";
  }
}

// ---------------------------------------------------------------------------
// InvoiceService
// ---------------------------------------------------------------------------

/**
 * InvoiceService
 *
 * Generates PDF invoices for orders using pdfmake (zero native binary).
 *
 * pdfmake v0.3.x uses a singleton API: `require('pdfmake').createPdf(docDef).getBuffer(cb)`.
 * This differs from the older PdfPrinter class API used in v0.1.x.
 *
 * Key design decisions:
 * - Minor units are displayed as: (amount_minor / 100).toFixed(2) — never parseFloat (plan note).
 * - Ownership is validated: customer can only download their own orders; admin bypass passes null customerId.
 * - Font defaults to Roboto (pdfmake v0.3 built-in).
 *
 * Plan 11-05 T7.
 */
export class InvoiceService {
  constructor(private deps: InvoiceServiceDeps) {}

  /**
   * Generate a PDF invoice buffer for an order.
   *
   * @param orderId - The order ID to generate the invoice for.
   * @param customerId - Customer ID for ownership check. Pass null for admin (no ownership check).
   * @returns Buffer containing the PDF bytes.
   */
  async generateInvoicePdf(
    orderId: string,
    customerId: string | null
  ): Promise<Buffer> {
    const { db } = this.deps;

    // Load order
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      throw new InvoiceOrderNotFoundError(orderId);
    }

    // Customer ownership check (admin passes null to bypass)
    if (customerId !== null && order.customerId !== customerId) {
      throw new InvoiceOrderOwnershipError();
    }

    // Load customer
    const [customer] = await db
      .select({ name: customers.name, email: customers.email })
      .from(customers)
      .where(eq(customers.id, order.customerId))
      .limit(1);

    // Load vendor orders + items with product names
    const vendorOrderRows = await db
      .select({ id: vendorOrders.id })
      .from(vendorOrders)
      .where(eq(vendorOrders.orderId, orderId));

    const lineItems: Array<{
      productName: string;
      quantity: number;
      unitPriceMinor: number;
      lineSubtotalMinor: number;
    }> = [];

    for (const vo of vendorOrderRows) {
      const items = await db
        .select({
          productName: orderItems.productName,
          quantity: orderItems.quantity,
          unitPriceMinor: orderItems.unitPriceMinor,
          lineSubtotalMinor: orderItems.lineSubtotalMinor,
        })
        .from(orderItems)
        .where(eq(orderItems.vendorOrderId, vo.id));

      lineItems.push(...items);
    }

    // Build the PDF document definition
    const docDef = this.buildDocumentDefinition({
      orderId,
      displayId: order.displayId,
      placedDate: order.createdAt,
      customerName: customer?.name ?? "Customer",
      customerEmail: customer?.email ?? "",
      lineItems,
      subtotalMinor: order.subtotalMinor,
      shippingMinor: order.shippingMinor,
      discountMinor: order.discountMinor,
      walletAppliedMinor: order.walletAppliedMinor,
      grandTotalMinor: order.grandTotalMinor,
    });

    return this.renderPdf(docDef);
  }

  // ── Private: document definition builder ─────────────────────────────────

  private buildDocumentDefinition(params: {
    orderId: string;
    displayId: string;
    placedDate: Date;
    customerName: string;
    customerEmail: string;
    lineItems: Array<{
      productName: string;
      quantity: number;
      unitPriceMinor: number;
      lineSubtotalMinor: number;
    }>;
    subtotalMinor: number;
    shippingMinor: number;
    discountMinor: number;
    walletAppliedMinor: number;
    grandTotalMinor: number;
  }): TDocumentDefinitions {
    const fmt = (minor: number): string => (minor / 100).toFixed(2);

    const itemsTableBody: Content[][] = [
      // Header row
      [
        { text: "Item", bold: true, fillColor: "#f2f2f2" } as Content,
        { text: "Qty", bold: true, fillColor: "#f2f2f2" } as Content,
        { text: "Unit Price", bold: true, fillColor: "#f2f2f2" } as Content,
        { text: "Total", bold: true, fillColor: "#f2f2f2" } as Content,
      ],
      // Line items
      ...params.lineItems.map((item) => [
        item.productName as Content,
        String(item.quantity) as Content,
        `$${fmt(item.unitPriceMinor)}` as Content,
        `$${fmt(item.lineSubtotalMinor)}` as Content,
      ]),
    ];

    const styles: StyleDictionary = {
      header: { fontSize: 20, bold: true, margin: [0, 0, 0, 10] },
      subheader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
      totals: { alignment: "right" },
      footer: { fontSize: 10, color: "#666", italics: true, margin: [0, 20, 0, 0] },
    };

    const totalsStack: Content[] = [
      { text: `Subtotal: $${fmt(params.subtotalMinor)}`, style: "totals" },
    ];
    if (params.shippingMinor > 0) {
      totalsStack.push({ text: `Shipping: $${fmt(params.shippingMinor)}`, style: "totals" });
    }
    if (params.discountMinor > 0) {
      totalsStack.push({ text: `Discount: -$${fmt(params.discountMinor)}`, style: "totals" });
    }
    if (params.walletAppliedMinor > 0) {
      totalsStack.push({ text: `Wallet Credit: -$${fmt(params.walletAppliedMinor)}`, style: "totals" });
    }
    totalsStack.push({
      text: `Grand Total: $${fmt(params.grandTotalMinor)}`,
      bold: true,
      fontSize: 14,
      style: "totals",
    } as Content);

    return {
      content: [
        // Header
        { text: "INVOICE", style: "header" },
        { text: "Grovio Marketplace", fontSize: 12, margin: [0, 0, 0, 20] },

        // Order info
        { text: "Order Details", style: "subheader" },
        { text: `Order ID: ${params.displayId}`, margin: [0, 0, 0, 4] },
        {
          text: `Date: ${params.placedDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`,
          margin: [0, 0, 0, 4],
        },

        // Billing
        { text: "Bill To", style: "subheader" },
        { text: params.customerName, margin: [0, 0, 0, 2] },
        { text: params.customerEmail, margin: [0, 0, 0, 20] },

        // Items table
        { text: "Items", style: "subheader" },
        {
          table: {
            widths: ["*", "auto", "auto", "auto"],
            body: itemsTableBody,
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 20],
        },

        // Totals
        {
          columns: [
            { text: "", width: "*" },
            {
              width: "auto",
              stack: totalsStack,
            },
          ],
          margin: [0, 0, 0, 30],
        } as Content,

        // Footer
        {
          text: "Thank you for your order. For support, contact support@grovio.com",
          style: "footer",
        },
      ],
      styles,
      defaultStyle: { fontSize: 11 },
    };
  }

  // ── Private: render PDF to buffer ─────────────────────────────────────────

  private renderPdf(docDef: TDocumentDefinitions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // pdfmake v0.3.x uses a singleton module — require and use createPdf()
        // The module exports a singleton with createPdf() method.
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
        const pdfmake = require("pdfmake") as any;
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
        const vfs = require("pdfmake/build/vfs_fonts") as any;

        // Set virtual file system for fonts
        if (pdfmake.vfs === undefined) {
          pdfmake.vfs = vfs.pdfMake?.vfs ?? vfs;
        }

        const pdfDoc = pdfmake.createPdf(docDef);
        pdfDoc.getBuffer((buffer: Buffer) => {
          resolve(buffer);
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}
