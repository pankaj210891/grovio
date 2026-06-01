import { Link } from 'react-router-dom';

/**
 * Site footer — semantic <footer> landmark.
 *
 * Layout: link columns grid + copyright row below.
 * Design tokens (no hardcoded hex).
 */

const footerLinks = [
  {
    heading: 'Shop',
    links: [
      { label: 'All Categories', to: '/search' },
      { label: 'New Arrivals', to: '/search?sort=newest' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Sign In', to: '/auth/login' },
      { label: 'Create Account', to: '/auth/signup' },
      { label: 'My Profile', to: '/account/profile' },
      { label: 'My Addresses', to: '/account/addresses' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Contact Us', to: '/contact' },
      { label: 'FAQ', to: '/faq' },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-grovio-surface-raised border-t border-grovio-border mt-auto">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-10">
          {footerLinks.map((col) => (
            <div key={col.heading}>
              <h3 className="text-sm font-semibold text-grovio-text mb-3 uppercase tracking-wider">
                {col.heading}
              </h3>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-grovio-text-muted hover:text-grovio-text transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-grovio-primary rounded"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Copyright row */}
        <div className="border-t border-grovio-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-sm text-grovio-text-muted">
            &copy; {year} Grovio. All rights reserved.
          </p>
          <p className="text-xs text-grovio-text-muted">
            Powered by Grovio Marketplace Platform
          </p>
        </div>
      </div>
    </footer>
  );
}
