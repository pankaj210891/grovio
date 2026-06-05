/**
 * Header — breadcrumb + admin email + logout shortcut.
 *
 * Uses framer-motion (web-admin convention per PATTERNS.md).
 * Reads admin profile from the adminAuthStore via useAdminAuth.
 */

import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth.js';

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  vendors: 'Vendors',
  'catalog-moderation': 'Catalog Moderation',
  'commission-rules': 'Commission Rules',
  'payout-management': 'Payout Management',
  cms: 'CMS / Homepage',
  'feature-flags': 'Feature Flags',
  settings: 'Settings & Branding',
  'audit-log': 'Audit Log',
  categories: 'Categories',
};

function getBreadcrumb(pathname: string): string {
  const segment = pathname.replace(/^\//, '').split('/')[0] ?? '';
  return ROUTE_LABELS[segment] ?? segment;
}

export function Header() {
  const { admin } = useAdminAuth();
  const location = useLocation();
  const breadcrumb = getBreadcrumb(location.pathname);

  return (
    <motion.header
      className="flex h-14 items-center justify-between border-b border-grovio-border bg-grovio-surface-raised px-6"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-grovio-text-muted">Admin</span>
        {breadcrumb && (
          <>
            <span className="text-grovio-text-muted">/</span>
            <span className="font-medium text-grovio-text">{breadcrumb}</span>
          </>
        )}
      </div>

      {/* Admin email */}
      {admin && (
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-grovio-primary/10 text-xs font-semibold text-grovio-primary">
            {admin.email.charAt(0).toUpperCase()}
          </span>
          <span className="text-sm text-grovio-text-muted">{admin.email}</span>
        </div>
      )}
    </motion.header>
  );
}
