/**
 * JSON-LD structured data components (Phase 11 T10).
 *
 * Uses react-helmet-async to inject <script type="application/ld+json"> in the <head>.
 * Each component encodes a specific schema.org type.
 *
 * Usage:
 *   <ProductJsonLd product={product} />
 *   <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Electronics' }]} />
 */

import { Helmet } from 'react-helmet-async';

// ---------------------------------------------------------------------------
// Product JSON-LD (schema.org/Product)
// ---------------------------------------------------------------------------

interface ProductJsonLdProps {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  priceMajor: number;
  /** ISO 4217 currency code — default INR */
  currency?: string;
  /** schema.org availability — default InStock */
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  /** Vendor / brand name */
  brandName?: string;
  /** Product URL slug for canonical */
  slug: string;
}

export function ProductJsonLd({
  id,
  name,
  description,
  imageUrl,
  priceMajor,
  currency = 'INR',
  availability = 'InStock',
  brandName,
  slug,
}: ProductJsonLdProps) {
  const origin = import.meta.env['VITE_STOREFRONT_ORIGIN'] as string | undefined ?? '';

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${origin}/products/${slug}`,
    name,
    ...(description ? { description } : {}),
    ...(imageUrl ? { image: imageUrl } : {}),
    ...(brandName ? { brand: { '@type': 'Brand', name: brandName } } : {}),
    offers: {
      '@type': 'Offer',
      url: `${origin}/products/${slug}`,
      priceCurrency: currency,
      price: priceMajor.toFixed(2),
      availability: `https://schema.org/${availability}`,
      seller: brandName ? { '@type': 'Organization', name: brandName } : undefined,
    },
    // productID for Google Merchant Center compatibility
    productID: id,
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumb JSON-LD (schema.org/BreadcrumbList)
// ---------------------------------------------------------------------------

interface BreadcrumbItem {
  /** Display name for this breadcrumb level */
  name: string;
  /** Path relative to origin — omit for the last (current) item */
  path?: string;
}

interface BreadcrumbJsonLdProps {
  items: BreadcrumbItem[];
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const origin = import.meta.env['VITE_STOREFRONT_ORIGIN'] as string | undefined ?? '';

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.path ? { item: `${origin}${item.path}` } : {}),
    })),
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
}
