export const botanicalDesignTokens = {
  color: {
    background: {
      paper: '#F9F8F4',
      card: '#FFFCF8',
      muted: '#DCCFC2',
      deep: '#1F2722',
    },
    text: {
      primary: '#2D3A31',
      secondary: '#4F5D53',
      inverse: '#F6F3ED',
    },
    accent: {
      primary: '#8C9A84',
      emphasis: '#C27B66',
      success: '#6F8D73',
    },
    border: {
      subtle: '#E4DBD1',
      strong: '#CDBFB1',
    },
  },
  typography: {
    display: '"Playfair Display", "Times New Roman", Georgia, serif',
    body: '"Source Sans 3", "Segoe UI", system-ui, sans-serif',
  },
  radius: {
    control: 18,
    card: 24,
    arch: 40,
    pill: 999,
  },
  spacing: {
    touchMinHeight: 44,
    pagePadding: 24,
    sectionGap: 16,
    cardGap: 12,
  },
  shadow: {
    paper:
      '0 1px 1px rgba(45, 58, 49, 0.04), 0 8px 24px rgba(45, 58, 49, 0.06), 0 20px 44px rgba(45, 58, 49, 0.04)',
    paperRaised:
      '0 2px 2px rgba(45, 58, 49, 0.05), 0 14px 34px rgba(45, 58, 49, 0.09), 0 30px 58px rgba(45, 58, 49, 0.05)',
  },
  motion: {
    quick: '220ms',
    standard: '360ms',
    slow: '500ms',
    easeOut: 'cubic-bezier(0.2, 0.72, 0.2, 1)',
    easeSpring: 'cubic-bezier(0.18, 0.9, 0.22, 1.08)',
    pressScale: 0.98,
  },
} as const;

export type BotanicalDesignTokens = typeof botanicalDesignTokens;

export const BOTANICAL_THEME_COLOR = botanicalDesignTokens.color.background.paper;
export const BOTANICAL_APP_BACKGROUND = botanicalDesignTokens.color.background.paper;
export const BOTANICAL_DARK_THEME_COLOR = botanicalDesignTokens.color.text.primary;
export const BOTANICAL_DARK_APP_BACKGROUND = botanicalDesignTokens.color.background.deep;
