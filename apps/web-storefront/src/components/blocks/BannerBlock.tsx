import { Link } from 'react-router-dom';
import { Button } from '../ui/Button.js';
import type { BannerBlock } from '@grovio/contracts';

interface BannerBlockProps {
  block: BannerBlock;
}

/**
 * Banner block renderer.
 *
 * Renders a full-width hero with title (Display typography), optional subtitle,
 * and optional CTA button linking to ctaUrl. Banner image is decorative (alt="")
 * unless a title provides context — in that case alt is sourced from title.
 *
 * Typography: title uses `text-[1.75rem] font-semibold` (Display — UI-SPEC).
 * T-04-24: block content is rendered as JSX text nodes (React escapes by default).
 */
export function BannerBlock({ block }: BannerBlockProps) {
  return (
    <section
      aria-label={block.title}
      className="relative w-full overflow-hidden rounded-xl"
    >
      {/* Banner image */}
      <div className="relative aspect-[16/7] sm:aspect-[21/7] w-full bg-grovio-border">
        <img
          src={block.imageUrl}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover"
          loading="eager"
        />
        {/* Gradient overlay for text legibility */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent"
          aria-hidden="true"
        />
        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-center px-8 sm:px-12 lg:px-16 max-w-2xl">
          <h2 className="text-[1.75rem] font-semibold text-white leading-[1.15]">
            {block.title}
          </h2>
          {block.subtitle && (
            <p className="mt-3 text-base text-white/85">{block.subtitle}</p>
          )}
          {block.ctaText && block.ctaUrl && (
            <div className="mt-6">
              <Link to={block.ctaUrl}>
                <Button variant="primary" className="shadow-md">
                  {block.ctaText}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
