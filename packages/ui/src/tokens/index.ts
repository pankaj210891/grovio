export const tokens = {
  colors: {
    grovioPrimary: "oklch(55% 0.2 250)",
    grovioPrimaryHover: "oklch(48% 0.2 250)",
    grovioSecondary: "oklch(65% 0.15 190)",
    grovioSurface: "oklch(98% 0.005 250)",
    grovioSurfaceRaised: "oklch(100% 0 0)",
    grovioBorder: "oklch(90% 0.01 250)",
    grovioText: "oklch(20% 0.02 250)",
    grovioTextMuted: "oklch(50% 0.02 250)",
    grovioSuccess: "oklch(60% 0.15 145)",
    grovioError: "oklch(55% 0.2 30)",
    grovioWarning: "oklch(70% 0.15 80)",
  },
  fontFamily: {
    sans: "'Inter', ui-sans-serif, system-ui, sans-serif",
  },
  borderRadius: {
    sm: "0.375rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
  },
} as const;

export type Tokens = typeof tokens;
