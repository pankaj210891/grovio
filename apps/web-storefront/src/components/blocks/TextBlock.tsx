import type { TextBlock } from '@grovio/contracts';

interface TextBlockProps {
  block: TextBlock;
}

/**
 * Text block renderer.
 *
 * Renders a heading + prose body content (plain text) in a readable
 * editorial section. Content is rendered as a text node (React escapes
 * by default — T-04-24 compliance: no dangerouslySetInnerHTML).
 */
export function TextBlock({ block }: TextBlockProps) {
  return (
    <section aria-label={block.title} className="w-full">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl font-semibold text-grovio-text mb-4">
          {block.title}
        </h2>
        <p className="text-sm text-grovio-text leading-relaxed whitespace-pre-line">
          {block.content}
        </p>
      </div>
    </section>
  );
}
