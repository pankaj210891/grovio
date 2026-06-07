import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Admin auth store — tracks the authenticated admin's identity and RBAC role.
 *
 * Persisted to sessionStorage so the session survives page refreshes
 * without requiring an API round-trip on every load.
 *
 * Role values (Phase 11 RBAC):
 *   'super_admin'   — full access to all sections
 *   'moderator'     — catalog, vendors, support (no finance, settings)
 *   'finance_admin' — finance only (no vendors, catalog, settings, support)
 */

export interface AdminUser {
  id: string;
  email: string;
  role: 'super_admin' | 'moderator' | 'finance_admin';
}

interface AdminAuthState {
  admin: AdminUser | null;
  isAuthenticated: boolean;
  setAdmin: (admin: AdminUser) => void;
  clearAdmin: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      admin: null,
      isAuthenticated: false,

      setAdmin: (admin) => set({ admin, isAuthenticated: true }),
      clearAdmin: () => set({ admin: null, isAuthenticated: false }),
    }),
    {
      name: 'grovio-admin-auth',
      storage: {
        getItem: (name) => {
          const val = sessionStorage.getItem(name);
          return val ? JSON.parse(val) : null;
        },
        setItem: (name, value) => sessionStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => sessionStorage.removeItem(name),
      },
    }
  )
);
