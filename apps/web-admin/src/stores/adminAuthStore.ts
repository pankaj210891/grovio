/**
 * Admin authentication store — Zustand slice for admin session state.
 *
 * Stores the current admin user profile after a successful login/session probe.
 * useAdminAuth hook reads and updates this store.
 */

import { create } from 'zustand';
import type { AdminProfile } from '@grovio/contracts';

interface AdminAuthState {
  /** Current authenticated admin user, or null if not authenticated */
  admin: AdminProfile | null;
  /** Update the admin user (called by useAdminAuth on login/session probe) */
  setAdmin: (admin: AdminProfile | null) => void;
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  admin: null,
  setAdmin: (admin) => set({ admin }),
}));
