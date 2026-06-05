import { z } from "zod";

/**
 * Admin authentication contract types for Phase 6: Vendor & Admin Tools.
 *
 * Per D-21: Admin panel auth uses a separate admin_users table (id, email, password_hash, created_at).
 *   Admin JWTs use role=admin (distinct from vendor JWTs which use role=vendor).
 *   A minimal AdminAuthService handles login at POST /admin/auth/login.
 *   httpOnly cookie pattern (Phase 4 D-09) applies to admin login too.
 */

// ---------------------------------------------------------------------------
// Admin Login (D-21)
// ---------------------------------------------------------------------------

/**
 * Input for admin login at POST /admin/auth/login.
 */
export const AdminLoginInputSchema = z.object({
  /** Admin account email */
  email: z.string().email(),
  /** Admin account password (non-empty) */
  password: z.string().min(1),
});

/** TypeScript type inferred from AdminLoginInputSchema */
export type AdminLoginInput = z.infer<typeof AdminLoginInputSchema>;

// ---------------------------------------------------------------------------
// Admin Profile (D-21)
// ---------------------------------------------------------------------------

/**
 * Admin user profile shape returned after successful authentication.
 */
export const AdminProfileSchema = z.object({
  /** admin_users row ID (UUID) */
  id: z.string().uuid(),
  /** Admin account email */
  email: z.string().email(),
  /** Role is always "admin" — discriminates from vendor and customer JWTs */
  role: z.literal("admin"),
});

/** TypeScript type inferred from AdminProfileSchema */
export type AdminProfile = z.infer<typeof AdminProfileSchema>;
