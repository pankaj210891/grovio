import {
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * vendor_kyc_documents table — KYC document uploads for vendor verification (Phase 11, T1).
 *
 * Stores uploaded KYC documents per vendor. Admin can verify each document.
 * document_type: 'id_proof' | 'gst_certificate' | 'bank_verification'
 *
 * Plan 11-02 T1.
 */
export const vendorKycDocuments = pgTable("vendor_kyc_documents", {
  id: uuid("id").defaultRandom().primaryKey(),

  /** Vendor this document belongs to. */
  vendorId: uuid("vendor_id").notNull(),

  /**
   * Type of document: 'id_proof', 'gst_certificate', 'bank_verification'
   */
  documentType: text("document_type").notNull(),

  /**
   * Public URL of the uploaded file (from StorageClient).
   */
  fileUrl: text("file_url").notNull(),

  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  /** When an admin verified this document. null = not yet verified. */
  verifiedAt: timestamp("verified_at", { withTimezone: true }),

  /** Email of the admin who verified this document. null = not verified. */
  verifiedByAdminEmail: text("verified_by_admin_email"),
});

export type InsertVendorKycDocument = typeof vendorKycDocuments.$inferInsert;
export type SelectVendorKycDocument = typeof vendorKycDocuments.$inferSelect;
