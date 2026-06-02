import type { MerchandisingBlock } from '@grovio/contracts';
import { BannerBlock } from './BannerBlock.js';
import { ProductGridBlock } from './ProductGridBlock.js';
import { TextBlock } from './TextBlock.js';
import { FeaturedCategoriesBlock } from './FeaturedCategoriesBlock.js';

interface BlockRendererProps {
  block: MerchandisingBlock;
}

/**
 * Discriminating block renderer.
 *
 * Switches on block.type and renders the matching block component.
 * Unknown block types render nothing (defensive — TypeScript discriminated union
 * catches this at compile time; the defensive check guards against future API
 * additions before the frontend is updated).
 *
 * D-01: Renders in API order — this component has no positioning logic.
 * T-04-24: No dangerouslySetInnerHTML; block content is rendered as JSX nodes.
 */
export function BlockRenderer({ block }: BlockRendererProps) {
  switch (block.type) {
    case 'banner':
      return <BannerBlock block={block} />;
    case 'product_grid':
      return <ProductGridBlock block={block} />;
    case 'text_block':
      return <TextBlock block={block} />;
    case 'featured_categories':
      return <FeaturedCategoriesBlock block={block} />;
    default:
      // Unknown block type — render nothing (defensive)
      // This branch is unreachable with the current union but guards against
      // future block types added to the API before the frontend is updated.
      return null;
  }
}
