/**
 * SeoHead — reusable per-page SEO component (Phase 11 T10).
 *
 * Renders <title>, meta description, Open Graph, and Twitter Card tags
 * using react-helmet-async. Requires HelmetProvider at the root (main.tsx).
 *
 * Usage:
 *   <SeoHead
 *     title="Fresh Vegetables | Grovio"
 *     description="Order fresh vegetables online..."
 *     canonicalPath="/category/vegetables"
 *   />
 *
 * JSON-LD structured data is handled separately by product-specific
 * components (ProductJsonLd, BreadcrumbJsonLd) to keep this component focused.
 */

import { Helmet } from 'react-helmet-async';

const DEFAULT_SITE_NAME = import.meta.env['VITE_SITE_NAME'] as string | undefined ?? 'Grovio';
const ORIGIN = import.meta.env['VITE_STOREFRONT_ORIGIN'] as string | undefined ?? '';

interface SeoHeadProps {
  /** Page title (will be appended with site name if not including it) */
  title: string;
  /** Meta description — aim for 140-160 characters */
  description?: string;
  /** Canonical path relative to origin (e.g., "/category/vegetables") */
  canonicalPath?: string;
  /** Open Graph image URL (absolute) */
  ogImage?: string;
  /** Open Graph type — default "website" */
  ogType?: 'website' | 'product' | 'article';
  /** noindex: true to exclude this page from indexing (e.g., account pages) */
  noIndex?: boolean;
}

export function SeoHead({
  title,
  description,
  canonicalPath,
  ogImage,
  ogType = 'website',
  noIndex = false,
}: SeoHeadProps) {
  const canonicalUrl = canonicalPath ? `${ORIGIN}${canonicalPath}` : undefined;

  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {noIndex && <meta name="robots" content="noindex,nofollow" />}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph */}
      <meta property="og:site_name" content={DEFAULT_SITE_NAME} />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:type" content={ogType} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      {ogImage && <meta property="og:image" content={ogImage} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      {ogImage && <meta name="twitter:image" content={ogImage} />}
    </Helmet>
  );
}
