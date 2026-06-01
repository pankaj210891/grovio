/**
 * Filter chip component.
 *
 * Active chips (selected filters) show bg-grovio-primary with a dismiss ×
 * button. Inactive chips (available filters) show the surface border style.
 *
 * Accessibility:
 *   - dismiss button: aria-label="Remove [label] filter"
 *   - inactive chips rendered as <button> for keyboard accessibility
 */
interface FilterChipProps {
  label: string;
  active?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
}

export function FilterChip({ label, active = false, onRemove, onClick }: FilterChipProps) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-grovio-primary text-white text-sm font-medium px-3 py-1">
        {label}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label} filter`}
          className="text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white rounded-full leading-none"
        >
          ×
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-full bg-grovio-surface border border-grovio-border text-grovio-text text-sm font-medium px-3 py-1 hover:border-grovio-primary hover:text-grovio-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
    >
      {label}
    </button>
  );
}
