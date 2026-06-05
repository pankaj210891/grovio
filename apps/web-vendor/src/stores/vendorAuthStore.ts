/**
 * Vendor auth Zustand store.
 *
 * Holds the authenticated vendor user object and their role.
 * The session probe in useVendorAuth populates this store on successful auth check.
 */

import { create } from 'zustand';
import type { VendorRole } from '@grovio/contracts';

export interface VendorUser {
  id: string;
  email: string;
  role: VendorRole;
  vendorId: string;
}

interface VendorAuthState {
  vendorUser: VendorUser | null;
  role: VendorRole | null;
  setVendorUser: (user: VendorUser | null) => void;
}

export const useVendorAuthStore = create<VendorAuthState>((set) => ({
  vendorUser: null,
  role: null,
  setVendorUser: (user) =>
    set({ vendorUser: user, role: user?.role ?? null }),
}));
